import { v4 as uuidv4 } from 'uuid';
import { getRandomInt, Queue } from "../utils/utils";

import { CityInterface, MappedCityInterface, RedisCityInterface } from "../interfaces/city.interface";
import { InternalServerError } from '../utils/errors';
import { HouseInterface } from "../interfaces/house.interface";
import { StreetInterface } from "../interfaces/street.interface";

import * as CategoryService from './category.service';
import * as StreetService from './street.service';
import { DynamicAPSP } from "./path-build.service";
import { getCategory, SINGLETON } from "./category.service";

// ─── Вспомогательные типы ────────────────────────────────────────────────────

interface Point2D {
    x: number;
    y: number;
    houseId: string;
}

interface Triangle {
    a: Point2D;
    b: Point2D;
    c: Point2D;
}

// ─── Экспортируемые функции (без изменений) ───────────────────────────────────

export const createCityInterface = function (apsp: DynamicAPSP): CityInterface {
    return { id: apsp.city.id, houses: apsp.city.houses };
}

export const createRedisInterface = function (apsp: DynamicAPSP): RedisCityInterface {
    let result: RedisCityInterface = {
        id: apsp.city.id,
        houses: apsp.city.houses,
        distances: []
    }
    for (const [from_id, distances] of apsp.dist)
        for (const [to_id, distance] of distances)
            result.distances.push([from_id, to_id, distance.toString()]);
    return result;
}

export const mapCity = async function (city: RedisCityInterface): Promise<DynamicAPSP> {
    let res: MappedCityInterface = {
        id: city.id,
        houses: city.houses,
        houseIndex: new Map<string, HouseInterface>(),
        streetIndex: new Map<string, StreetInterface>(),
    }
    for (const house of res.houses) {
        res.houseIndex.set(house.id, house);
        for (const edge of house.edges)
            res.streetIndex.set(edge.id, edge);
    }
    return new DynamicAPSP(res, city.distances);
}

export const createRandomCity = async function (count?: number): Promise<DynamicAPSP> {
    const categories_count = CategoryService.categoriesCount();
    let categories: Record<number, number> = {};
    for (let i = 0; i < categories_count; i++) categories[i] = 0;

    if (count === undefined) {
        for (let index = 0; index < categories_count; index++)
            categories[index] = (SINGLETON.has(getCategory(index).name) ? 1 : getRandomInt(1, 3));
    } else {
        while (count > 0)
            for (let index = 0; index < categories_count; index++) {
                const cnt = Math.min(count, (SINGLETON.has(getCategory(index).name) ? 1 : getRandomInt(1, 3)));
                if (SINGLETON.has(getCategory(index).name) && categories[index] == 1) continue;
                categories[index] += cnt;
                count -= cnt;
                if (count === 0) break;
            }
    }

    return generateCityByCategories(categories);
}

// ─── Генерация города ─────────────────────────────────────────────────────────

/** Генерация города по заданному интерфейсу **/
const generateCityByCategories = async function (
    categories: Record<number, number>
): Promise<DynamicAPSP> {
    const city: MappedCityInterface = {
        id: uuidv4(),
        houses: [],
        houseIndex: new Map(),
        streetIndex: new Map(),
    }

    for (const category of Object.keys(categories)) {
        const catNum = parseInt(category);
        if (isNaN(catNum)) throw new InternalServerError('wrong categories array type');

        for (let i = 0; i < categories[catNum]; i++) {
            const house: HouseInterface = {
                id: uuidv4(),
                category: catNum,
                edges: [],
                time: 0,
                price: 0,
                weather: false,
            }
            city.houses.push(house);
            city.houseIndex.set(house.id, house);
        }
    }

    createCityLikeEdges(city.houses, city.streetIndex, city.houseIndex);

    return new DynamicAPSP(city);
}

/** Создания рандомных ребер для города **/
const createCityLikeEdges = function (
    houses: HouseInterface[],
    streetIndex: Map<string, StreetInterface>,
    houseIndex: Map<string, HouseInterface>,
): void {
    const n = houses.length;
    if (n === 0) return;
    if (n === 1) return;
    if (n === 2) { StreetService.addEdge(houses[0], houses[1], streetIndex); return; }

    const points = placePointsCityGrid(houses);
    const triangles = bowierWatson(points);
    const triangulationEdges = extractEdges(triangles);

    for (const [a, b] of triangulationEdges) {
        const houseA = houses.find(h => h.id === a.houseId)!;
        const houseB = houses.find(h => h.id === b.houseId)!;
        StreetService.addEdge(houseA, houseB, streetIndex);
    }

    pruneEdges(houses, streetIndex, houseIndex);
    ensureConnected(houses, streetIndex, points);
    addExtraEdges(houses, streetIndex, points);
}

/** Размещение вершин в городской сетке с шумом **/
const placePointsCityGrid = function (houses: HouseInterface[]): Point2D[] {
    const n = houses.length;

    // Размер сетки: примерно квадратный корень с запасом
    const cols = Math.ceil(Math.sqrt(n * 1.3));
    const rows = Math.ceil(n / cols);

    const CELL_SIZE = 100;    // размер квартала
    const NOISE     = 25;     // максимальное отклонение от центра квартала

    const cells: { cx: number; cy: number }[] = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            cells.push({
                cx: c * CELL_SIZE + CELL_SIZE / 2,
                cy: r * CELL_SIZE + CELL_SIZE / 2,
            });
        }
    }

    for (let i = cells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cells[i], cells[j]] = [cells[j], cells[i]];
    }

    return houses.map((house, i) => {
        const x = cells[i].cx + (Math.random() - 0.5) * 2 * NOISE;
        const y = cells[i].cy + (Math.random() - 0.5) * 2 * NOISE;
        house.x = x;
        house.y = y;
        return { x, y, houseId: house.id };
    });
}

/** Триангуляция Боуэра-Ватсона **/
const bowierWatson = function (points: Point2D[]): Triangle[] {
    if (points.length < 3) return [];

    // Супертреугольник — содержит все точки
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs) - 10;
    const minY = Math.min(...ys) - 10;
    const maxX = Math.max(...xs) + 10;
    const maxY = Math.max(...ys) + 10;
    const dx = maxX - minX;
    const dy = maxY - minY;
    const delta = Math.max(dx, dy) * 3;

    const st0: Point2D = { x: minX - delta, y: minY - delta,      houseId: '__st0' };
    const st1: Point2D = { x: minX + delta, y: maxY + delta * 2,  houseId: '__st1' };
    const st2: Point2D = { x: maxX + delta * 2, y: minY - delta,  houseId: '__st2' };

    let triangles: Triangle[] = [{ a: st0, b: st1, c: st2 }];

    for (const point of points) {
        // Находим треугольники чья описанная окружность содержит точку
        const bad: Triangle[] = [];
        for (const tri of triangles) {
            if (inCircumcircle(point, tri)) bad.push(tri);
        }

        // Строим полигональную дыру из уникальных рёбер плохих треугольников
        const boundary: [Point2D, Point2D][] = [];
        for (const tri of bad) {
            const edges: [Point2D, Point2D][] = [
                [tri.a, tri.b], [tri.b, tri.c], [tri.c, tri.a]
            ];
            for (const edge of edges) {
                const shared = bad.some(other => other !== tri && hasEdge(other, edge));
                if (!shared) boundary.push(edge);
            }
        }

        // Удаляем плохие треугольники
        triangles = triangles.filter(t => !bad.includes(t));

        // Заполняем дыру новыми треугольниками
        for (const [e0, e1] of boundary) {
            triangles.push({ a: point, b: e0, c: e1 });
        }
    }

    // Удаляем треугольники касающиеся суперточек
    const superIds = new Set(['__st0', '__st1', '__st2']);
    return triangles.filter(t =>
        !superIds.has(t.a.houseId) &&
        !superIds.has(t.b.houseId) &&
        !superIds.has(t.c.houseId)
    );
}

/** Проверка — лежит ли точка внутри описанной окружности треугольника **/
const inCircumcircle = function (p: Point2D, tri: Triangle): boolean {
    const { a, b, c } = tri;

    const ax = a.x - p.x;
    const ay = a.y - p.y;
    const bx = b.x - p.x;
    const by = b.y - p.y;
    const cx = c.x - p.x;
    const cy = c.y - p.y;

    const det =
        (ax * ax + ay * ay) * (bx * cy - by * cx) -
        (bx * bx + by * by) * (ax * cy - ay * cx) +
        (cx * cx + cy * cy) * (ax * by - ay * bx);

    // Знак зависит от ориентации треугольника
    // Если вершины против часовой стрелки — det > 0 означает внутри
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

    return cross > 0 ? det > 0 : det < 0;
}

/** Проверка наличия ребра в треугольнике **/
const hasEdge = function (tri: Triangle, edge: [Point2D, Point2D]): boolean {
    const [e0, e1] = edge;
    const verts = [tri.a, tri.b, tri.c];
    return (
        (verts.includes(e0) && verts.includes(e1))
    );
}

/** Извлекаем уникальные рёбра из треугольников **/
const extractEdges = function (triangles: Triangle[]): [Point2D, Point2D][] {
    const seen = new Set<string>();
    const edges: [Point2D, Point2D][] = [];

    for (const tri of triangles) {
        const pairs: [Point2D, Point2D][] = [
            [tri.a, tri.b], [tri.b, tri.c], [tri.c, tri.a]
        ];
        for (const [a, b] of pairs) {
            const key = [a.houseId, b.houseId].sort().join('|');
            if (!seen.has(key)) {
                seen.add(key);
                edges.push([a, b]);
            }
        }
    }
    return edges;
}

/** Удаляем рёбра у вершин со слишком высокой степенью **/
const pruneEdges = function (
    houses: HouseInterface[],
    streetIndex: Map<string, StreetInterface>,
    houseIndex: Map<string, HouseInterface>
): void {
    const MAX_DEGREE = 5; // максимум улиц у одного здания
    const MAX_DIST = 4;
    // todo сделать проверку что если при удалении ребра, путь между вершинами длинны <= 5 не существует, то реально удалять ребро

    for (const house of houses) {
        while (house.edges.length > MAX_DEGREE) {
            let longestEdge = house.edges[0];
            for (const edge of house.edges)
                if (edge.length > longestEdge.length)
                    longestEdge = edge;

            const revId = `${longestEdge.to}:${longestEdge.from}`;
            const toHouse = houses.find(h => h.id === longestEdge.to);
            if (!toHouse) break;

            const revEdge = streetIndex.get(revId);
            if (!revEdge) break;
            if (toHouse.edges.length <= 2) break;

            const idx = house.edges.indexOf(longestEdge);
            if (idx !== -1) { house.edges[idx] = house.edges[house.edges.length - 1]; house.edges.pop(); }
            streetIndex.delete(longestEdge.id);

            const revIdx = toHouse.edges.indexOf(revEdge);
            if (revIdx !== -1) { toHouse.edges[revIdx] = toHouse.edges[toHouse.edges.length - 1]; toHouse.edges.pop(); }
            streetIndex.delete(revId);
        }
    }

    for (const house of houses) {
        for (const edge of house.edges) {
            const id = edge.id;
            const revId = edge.id.split(':').reverse().join(':');
            const toHouseId = edge.id.split(':').filter(id => id !== house.id)[0];
            const bannedEdges = new Set<string>([id, revId]);

            const dist = new Map<string, number>();
            const queue = new Queue<string>();
            let found = false;
            dist.set(house.id, 0);
            queue.add(house.id);

            while (!queue.isEmpty()) {
                const houseId = queue.get()!;
                if (dist.has(toHouseId)) {
                    found = true;
                    break;
                }

                const house = houseIndex.get(houseId)!;
                const deep = dist.get(houseId)!;
                if (deep > MAX_DIST) break;
                for (const edge of house.edges) {
                    if (bannedEdges.has(edge.id)) continue;
                    if (!dist.has(edge.to)) {
                        dist.set(edge.to, deep + 1);
                        queue.add(edge.to);
                    }
                }
            }

            if (found) {
                streetIndex.delete(id);
                streetIndex.delete(revId);
                house.edges.filter(edge => edge.id != id);

                const toHouse = houseIndex.get(toHouseId)!;
                toHouse.edges.filter(edge => edge.id != revId);
            }
        }
    }
}

/** Проверка связности и восстановление **/
const ensureConnected = function (
    houses: HouseInterface[],
    streetIndex: Map<string, StreetInterface>,
    points: Point2D[],
): void {
    if (houses.length === 0) return;

    const pointById = new Map(points.map(p => [p.houseId, p]));
    const houseById = new Map(houses.map(h => [h.id, h]));

    const visited = new Set<string>();
    const components: string[][] = [];

    for (const house of houses) {
        if (visited.has(house.id)) continue;

        const component: string[] = [];
        const queue = [house.id];
        visited.add(house.id);

        while (queue.length > 0) {
            const current = queue.shift()!;
            component.push(current);
            const h = houseById.get(current)!;
            for (const edge of h.edges) {
                if (!visited.has(edge.to)) {
                    visited.add(edge.to);
                    queue.push(edge.to);
                }
            }
        }
        components.push(component);
    }

    if (components.length <= 1) return;

    const mainComponent = components[0];

    for (let i = 1; i < components.length; i++) {
        let bestDist = Infinity;
        let bestA: HouseInterface | null = null;
        let bestB: HouseInterface | null = null;

        for (const idA of mainComponent) {
            const pA = pointById.get(idA);
            if (!pA) continue;

            for (const idB of components[i]) {
                const pB = pointById.get(idB);
                if (!pB) continue;

                const d = Math.hypot(pA.x - pB.x, pA.y - pB.y);
                if (d < bestDist) {
                    bestDist = d;
                    bestA = houseById.get(idA) ?? null;
                    bestB = houseById.get(idB) ?? null;
                }
            }
        }

        if (bestA && bestB) {
            StreetService.addEdge(bestA, bestB, streetIndex);
        }

        for (const id of components[i]) {
            mainComponent.push(id);
        }
    }
}

/** Дополнительные рёбра между близкими вершинами **/
const addExtraEdges = function (
    houses: HouseInterface[],
    streetIndex: Map<string, StreetInterface>,
    points: Point2D[],
): void {
    const MAX_DEGREE    = 5;   // максимальная степень вершины
    const K_NEAREST     = 6;   // сколько ближайших соседей рассматриваем
    const EDGE_PROB     = 0.45; // вероятность добавить ребро к соседу
    const MAX_DIST      = 180;  // максимальное расстояние для нового ребра

    const pointById = new Map(points.map(p => [p.houseId, p]));

    for (const house of houses) {
        if (house.edges.length >= MAX_DEGREE) continue;

        const p = pointById.get(house.id)!;

        // Сортируем всех соседей по расстоянию
        const neighbors = houses
            .filter(h => h.id !== house.id)
            .map(h => ({
                house: h,
                dist: Math.hypot(
                    pointById.get(h.id)!.x - p.x,
                    pointById.get(h.id)!.y - p.y,
                ),
            }))
            .filter(n => n.dist <= MAX_DIST)
            .sort((a, b) => a.dist - b.dist)
            .slice(0, K_NEAREST);

        for (const { house: neighbor } of neighbors) {
            if (house.edges.length >= MAX_DEGREE) break;
            if (neighbor.edges.length >= MAX_DEGREE) continue;

            const alreadyConnected =
                streetIndex.has(`${house.id}:${neighbor.id}`) ||
                streetIndex.has(`${neighbor.id}:${house.id}`);
            if (alreadyConnected) continue;

            if (Math.random() < EDGE_PROB) {
                StreetService.addEdge(house, neighbor, streetIndex);
            }
        }
    }
}