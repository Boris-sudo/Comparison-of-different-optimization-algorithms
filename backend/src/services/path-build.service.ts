import { MappedCityInterface } from "../interfaces/city.interface";
import { PathResponseInterface } from "../interfaces/path.interface";

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

export function getAllDistancesMatrix(
    city: MappedCityInterface,
): Map<string, Map<string, number>> {
    const result = new Map<string, Map<string, number>>();

    for (const house of city.houses) {
        const map = new Map<string, number>();
        for (const house1 of city.houses) {
            map.set(house1.id, Infinity);
            if (house1.id === house.id)
                map.set(house1.id, 0);
        }
        result.set(house.id, map);
    }

    for (const house of city.houses) {
        for (const edge of house.edges) {
            result.get(edge.from)?.set(edge.to, edge.length);
        }
    }

    const n = city.houses.length;
    for (let k = 0; k < n; k++)
        for (let i = 0; i < n; i++)
            for (let j = 0; j < n; j++) {
                if (k === i || k === j || i == j) continue;
                const a = city.houses[k].id;
                const b = city.houses[i].id;
                const c = city.houses[j].id;

                const d_ba = result.get(b)?.get(a) ?? Infinity;
                const d_ac = result.get(a)?.get(c) ?? Infinity;

                if (d_ba === Infinity || d_ac === Infinity) continue;

                const d_bc = result.get(b)?.get(c) ?? Infinity;
                result.get(b)?.set(c, Math.min(d_bc, d_ba + d_ac));
            }

    return result;
}