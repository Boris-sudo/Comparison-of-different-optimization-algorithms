import { MappedCityInterface } from "../interfaces/city.interface";
import { PathResponseInterface } from "../interfaces/path.interface";
import { HouseInterface } from "../interfaces/house.interface";

/** Dijkstra algorithm for fast search of path between two points **/
export function dijkstra(
    city: MappedCityInterface,
    fromId: string,
    toId: string,
    forbidden: Set<string> = new Set(), // вершины которые нельзя посещать
): { distance: number; path: string[] } {
    const dist = new Map<string, number>();
    const prev = new Map<string, string | null>();
    const unvisited = new Set<string>();

    for (const house of city.houses) {
        if (forbidden.has(house.id) && house.id !== fromId && house.id !== toId) continue;
        dist.set(house.id, Infinity);
        prev.set(house.id, null);
    }

    unvisited.add(fromId);
    dist.set(fromId, 0);

    while (unvisited.size > 0) {
        let current: string | null = null;
        let minDist = Infinity;
        for (const id of unvisited) {
            const d = dist.get(id) ?? Infinity;
            if (d < minDist) { minDist = d; current = id; }
        }

        if (current === null || current === toId) break;
        unvisited.delete(current);

        const house = city.houseIndex.get(current);
        if (!house) continue;

        for (const street of house.edges) {
            const neighborId = street.from === current ? street.to : street.from;
            if (forbidden.has(neighborId)) continue;
            const newDist = minDist + street.length;
            if (newDist < (dist.get(neighborId) ?? Infinity)) {
                dist.set(neighborId, newDist);
                prev.set(neighborId, current);
                unvisited.add(neighborId);
            }
        }
    }

    const path: string[] = [];
    let current: string | null = toId;
    while (current !== null) {
        path.unshift(current);
        current = prev.get(current) ?? null;
    }

    return {
        distance: dist.get(toId) ?? Infinity,
        path: path[0] === fromId ? path : [],
    };
}

/** Function for building route in city with certain verticals in `waypoints` **/
export function buildRouteInOrder(
    city: MappedCityInterface,
    waypoints: string[],
    ignoreSimilarities: boolean = false
): PathResponseInterface {
    const fullPath: PathResponseInterface = {
        points: [],
        length: 0,
        duration: { network: 0, algo: 0, }
    };
    const visited = new Set<string>();

    for (const waypoint of waypoints) {
        visited.add(waypoint);
    }
    fullPath.points.push({
        id: waypoints[0],
        role: 'main',
    });

    for (let i = 0; i < waypoints.length - 1; i++) {
        const from = waypoints[i];
        const to = waypoints[i + 1];

        let forbidden: Set<string> = new Set();
        if (!ignoreSimilarities) {
            forbidden = new Set(visited);
            forbidden.delete(from);
            forbidden.delete(to);
        }

        let path = dijkstra(city, from, to, forbidden);
        let segment = path.path;

        if (segment.length === 0) {
            console.warn(`No path from ${from} to ${to} without revisiting nodes`);
            path = dijkstra(city, from, to);
            segment = path.path;
        }

        for (let index = 1; index < segment.length; index++) {
            if (!ignoreSimilarities) visited.add(segment[index]);
            fullPath.points.push({
                id: segment[index],
                role: 'outer',
            });
        }
        fullPath.length += path.distance;
        fullPath.points[fullPath.points.length - 1].role = 'main';
    }

    return fullPath;
}

export class DynamicAPSP {
    dist: Map<string, Map<string, number>> = new Map();
    city: MappedCityInterface;

    constructor(
        city: MappedCityInterface,
        distances: string[][] | undefined = undefined
    ) {
        this.city = city;
        if (distances)
            this.buildFromDistances(distances);
        else
            this.rebuild();
    }

    // ─── Полная перестройка O(V * (E + V) log V) ─────────────────────────────

    rebuild() {
        this.dist.clear();
        for (const house of this.city.houses) {
            this.dist.set(house.id, this.dijkstra(house.id));
        }
    }

    buildFromDistances(distances: string[][]) {
        for (const [from, to, distance_str] of distances) {
            const distance = Number(distance_str);
            if (this.dist.get(from) === undefined)
                this.dist.set(from, new Map());
            this.dist.get(from)?.set(to, distance);
        }
    }

    // ─── Запрос O(1) ──────────────────────────────────────────────────────────

    getDistance(fromId: string, toId: string): number {
        return this.dist.get(fromId)?.get(toId) ?? Infinity;
    }

    // ─── Добавление ребра O(V log V) ─────────────────────────────────────────
    // При добавлении ребра (u, v, w) расстояния могут только уменьшиться.
    // Достаточно проверить для каждой пары (s, t):
    // dist[s][t] = min(dist[s][t], dist[s][u] + w + dist[v][t])

    onEdgeAdded(fromId: string, toId: string, weight: number) {
        const nodes = this.city.houses.map(h => h.id);

        for (const s of nodes) {
            const distS = this.dist.get(s)!;
            for (const t of nodes) {
                // Через u→v
                const via_uv =
                    (distS.get(fromId) ?? Infinity) + weight +
                    (this.dist.get(toId)?.get(t) ?? Infinity);
                if (via_uv < (distS.get(t) ?? Infinity)) {
                    distS.set(t, via_uv);
                }

                // Через v→u (граф неориентированный)
                const via_vu =
                    (distS.get(toId) ?? Infinity) + weight +
                    (this.dist.get(fromId)?.get(t) ?? Infinity);
                if (via_vu < (distS.get(t) ?? Infinity)) {
                    distS.set(t, via_vu);
                }
            }
        }
    }

    // ─── Удаление ребра O(V * (E + V) log V) в худшем случае ─────────────────
    // При удалении расстояния могут только вырасти.
    // Нужно найти все пары (s, t) где кратчайший путь проходил через это ребро
    // и пересчитать их.

    onEdgeRemoved(fromId: string, toId: string, weight: number) {
        const nodes = this.city.houses.map(h => h.id);
        const affected = new Set<string>();

        for (const s of nodes) {
            const distS = this.dist.get(s)!;
            for (const t of nodes) {
                const d = distS.get(t) ?? Infinity;

                // Проверяем оба направления ребра
                const through_uv =
                    (distS.get(fromId) ?? Infinity) + weight +
                    (this.dist.get(toId)?.get(t) ?? Infinity);

                const through_vu =
                    (distS.get(toId) ?? Infinity) + weight +
                    (this.dist.get(fromId)?.get(t) ?? Infinity);

                if (d === through_uv || d === through_vu) {
                    affected.add(s);
                    break; // нашли хотя бы одну затронутую пару — достаточно
                }
            }
        }

        // Пересчитываем затронутые источники
        for (const s of affected) {
            this.dist.set(s, this.dijkstra(s));
        }

        // Синхронизируем обратные расстояния — граф симметричный
        // поэтому dist[s][t] === dist[t][s], копируем из пересчитанных
        for (const s of nodes) {
            if (affected.has(s)) continue;
            const distS = this.dist.get(s)!;
            for (const t of affected) {
                // dist[t][s] уже пересчитан, берём оттуда
                const newDist = this.dist.get(t)?.get(s) ?? Infinity;
                distS.set(t, newDist);
            }
        }
    }

    // ─── Добавление вершины O(V log V) ───────────────────────────────────────

    onNodeAdded(nodeId: string) {
        // Новая вершина изолирована — расстояния до всех Infinity кроме себя
        const newDist = new Map<string, number>();
        for (const house of this.city.houses) {
            newDist.set(house.id, Infinity);
            this.dist.get(house.id)?.set(nodeId, Infinity);
        }
        newDist.set(nodeId, 0);
        this.dist.set(nodeId, newDist);
    }

    // ─── Удаление вершины O(V) ────────────────────────────────────────────────

    onNodeRemoved(nodeId: string) {
        this.dist.delete(nodeId);
        for (const distMap of this.dist.values()) {
            distMap.delete(nodeId);
        }
    }

    // ─── Dijkstra O((E + V) log V) ────────────────────────────────────────────

    private dijkstra(sourceId: string): Map<string, number> {
        const dist = new Map<string, number>();
        for (const house of this.city.houses) {
            dist.set(house.id, Infinity);
        }
        dist.set(sourceId, 0);

        // Min-heap через простой массив с сортировкой
        // Для продакшена замени на настоящую priority queue
        const pq: { id: string; d: number }[] = [{ id: sourceId, d: 0 }];

        while (pq.length > 0) {
            pq.sort((a, b) => a.d - b.d);
            const { id: u, d: du } = pq.shift()!;

            if (du > (dist.get(u) ?? Infinity)) continue;

            const house = this.city.houseIndex.get(u);
            if (!house) continue;

            for (const street of house.edges) {
                const v = street.from === u ? street.to : street.from;
                const newDist = du + street.length;
                if (newDist < (dist.get(v) ?? Infinity)) {
                    dist.set(v, newDist);
                    pq.push({ id: v, d: newDist });
                }
            }
        }

        return dist;
    }
}