import { LocationItem, PromptElement } from "../../interfaces/path.interface";
import { MappedCityInterface } from "../../interfaces/city.interface";
import { HouseInterface } from "../../interfaces/house.interface";
import { InternalServerError } from "../../utils/errors";
import { getCategory } from "../category.service";
import { DynamicAPSP } from "../path-build.service";

interface AStarNode {
    houseId: string;
    g: number; // стоимость пути от старта
    h: number; // эвристика до цели
    f: number; // g + h
    parent: string | null;
}

export class AStarService {
    keys: PromptElement[];
    city: MappedCityInterface;
    apsp: DynamicAPSP;
    startPosition: HouseInterface;

    private readonly MAX_CANDIDATES = 29;

    constructor(
        apsp: DynamicAPSP,
        keys: PromptElement[],
        startPosition: HouseInterface,
    ) {
        this.apsp = apsp;
        this.city = apsp.city;
        this.keys = keys;
        this.startPosition = startPosition;
    }

    async generate(): Promise<Array<LocationItem>> {
        console.log('\x1b[33m[A*]\x1b[0m generation started');
        const start = Date.now();

        this.keys.unshift({ id: this.startPosition.id, type: 'fixed' });

        // Для каждого PromptElement выбираем лучшую вершину через A*
        const result: Array<LocationItem> = [];
        const usedIds = new Set<string>();

        for (let index = 0; index < this.keys.length; index++) {
            const key = this.keys[index];

            if (key.type === 'fixed') {
                const house = this.city.houseIndex.get(key.id!);
                if (!house) throw new InternalServerError(`No house found with id ${key.id}`);
                result.push({ location: house });
                usedIds.add(house.id);
                continue;
            }

            // Предыдущая точка — откуда идём
            const fromId = result.length > 0
                ? result[result.length - 1].location.id
                : this.startPosition.id;

            // Следующая фиксированная точка — цель эвристики
            const nextFixedId = this.findNextFixed(index);

            // Выбираем лучшего кандидата через A*-оценку
            const best = await this.pickBestCandidate(
                fromId,
                nextFixedId,
                key,
                usedIds,
            );

            if (!best) throw new InternalServerError(`No candidate found for key at index ${index}`);

            result.push(best);
            usedIds.add(best.location.id);
        }

        console.log('\x1b[33m[A*]\x1b[0m finished in', Date.now() - start, 'ms');
        return result;
    }

    // ─── Поиск следующей фиксированной точки после index ─────────────────────

    private findNextFixed(fromIndex: number): string | null {
        for (let i = fromIndex + 1; i < this.keys.length; i++) {
            if (this.keys[i].type === 'fixed' && this.keys[i].id) {
                return this.keys[i].id!;
            }
        }
        return null;
    }

    // ─── Выбор лучшего кандидата для category-точки ───────────────────────────
    // f(n) = g(n) + h(n)
    // g(n) = расстояние от предыдущей точки до кандидата
    // h(n) = расстояние от кандидата до следующей фиксированной точки (или 0)
    // Дополнительно учитываем соответствие категории — чем выше, тем лучше

    private async pickBestCandidate(
        fromId: string,
        nextFixedId: string | null,
        key: PromptElement,
        usedIds: Set<string>,
    ): Promise<LocationItem | null> {
        const candidates: {
            item: LocationItem;
            f: number;
            categoriesSum: number;
        }[] = [];

        for (const house of this.city.houses) {
            if (usedIds.has(house.id)) continue;

            // Считаем соответствие категории
            const categoriesSum = this.calcCategoriesSum(house, key);
            if (categoriesSum === 0) continue; // не подходит по категории

            // g — стоимость от предыдущей точки
            const g = this.apsp.getDistance(fromId, house.id);
            if (g === Infinity) continue;

            // h — эвристика: расстояние до следующей фиксированной точки
            const h = nextFixedId
                ? this.apsp.getDistance(house.id, nextFixedId)
                : 0;

            // f = g + h, скорректированное на качество совпадения категории
            // Делим на categoriesSum чтобы предпочитать более подходящие места
            const f = (g + h) / Math.max(1, categoriesSum);

            candidates.push({ item: { location: house, categoriesSum }, f, categoriesSum });
        }

        if (candidates.length === 0) return null;

        // Сортируем по f — меньше лучше
        candidates.sort((a, b) => a.f - b.f);

        return candidates[0].item;
    }

    // ─── Сумма весов категорий для дома ──────────────────────────────────────

    private calcCategoriesSum(house: HouseInterface, key: PromptElement): number {
        if (!key.categories) return 0;
        let sum = 0;
        for (const [catName, weight] of Object.entries(key.categories)) {
            if (getCategory(house.category).name === catName) {
                sum += weight;
            }
        }
        return sum;
    }
}