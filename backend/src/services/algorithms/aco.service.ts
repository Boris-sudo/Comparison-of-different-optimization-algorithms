import { LocationItem, PromptElement } from "../../interfaces/path.interface";
import { MappedCityInterface } from "../../interfaces/city.interface";
import { HouseInterface } from "../../interfaces/house.interface";
import { InternalServerError } from "../../utils/errors";
import { getCategory } from "../category.service";
import { DynamicAPSP } from "../path-build.service";

interface AntSolution {
    placement: LocationItem[];
    score: number;
}

export class AcoService {
    keys: PromptElement[];
    city: MappedCityInterface;
    apsp: DynamicAPSP;
    startPosition: HouseInterface;

    /**
     * ─── Гиперпараметры ───────────────────────────────────────────────────────
     */
    private readonly ANTS          = 30;    // число муравьёв в колонии
    private readonly ITERATIONS    = 80;    // число итераций колонии
    private readonly ALPHA         = 1.0;   // влияние феромона
    private readonly BETA          = 2.0;   // влияние эвристики (1/dist)
    private readonly RHO           = 0.3;   // коэффициент испарения феромона
    private readonly Q             = 1000;  // константа обновления феромона
    private readonly TAU_INIT      = 1.0;   // начальный уровень феромона
    private readonly MAX_CANDIDATES = 20;   // максимум кандидатов на позицию

    // ─── Феромонная матрица: pheromone[positionIndex][houseId] ───────────────
    private pheromone: Map<number, Map<string, number>> = new Map();

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
        console.log('\x1b[32m[ACO]\x1b[0m generation started');
        const start = Date.now();

        this.keys.unshift({ id: this.startPosition.id, type: 'fixed' });

        // Строим список кандидатов для каждой позиции
        const candidates = await this.buildCandidates();

        // Инициализируем феромоны
        this.initPheromones(candidates);

        let bestSolution: AntSolution | null = null;

        for (let iter = 0; iter < this.ITERATIONS; iter++) {
            const solutions: AntSolution[] = [];

            // Каждый муравей строит маршрут
            for (let ant = 0; ant < this.ANTS; ant++) {
                const placement = this.constructSolution(candidates);
                const score = await this.scoreFunction(placement);
                solutions.push({ placement, score });

                if (!bestSolution || score > bestSolution.score) {
                    bestSolution = { placement: [...placement], score };
                }
            }

            // Испаряем феромон и обновляем
            this.evaporatePheromones(candidates);
            this.depositPheromones(solutions);
        }

        console.log('\x1b[32m[ACO]\x1b[0m finished in', Date.now() - start, 'ms');

        if (!bestSolution) throw new InternalServerError('ACO: no solution found');
        return bestSolution.placement;
    }

    // ─── Построение кандидатов для каждой позиции ────────────────────────────

    private async buildCandidates(): Promise<Map<number, LocationItem[]>> {
        const result = new Map<number, LocationItem[]>();

        for (let index = 0; index < this.keys.length; index++) {
            const key = this.keys[index];

            if (key.type === 'fixed') {
                const house = this.city.houseIndex.get(key.id!);
                if (!house) throw new InternalServerError(`No house with id ${key.id}`);
                result.set(index, [{ location: house }]);
                continue;
            }

            // Для category — отбираем подходящих кандидатов
            const fromId = index > 0
                ? (result.get(index - 1)?.[0]?.location.id ?? this.startPosition.id)
                : this.startPosition.id;

            const scored: { item: LocationItem; prescore: number }[] = [];

            for (const house of this.city.houses) {
                const categoriesSum = this.calcCategoriesSum(house, key);
                if (categoriesSum === 0) continue;

                const dist = this.apsp.getDistance(fromId, house.id);
                if (dist === Infinity) continue;

                // Предварительная оценка: категория / расстояние
                const prescore = (categoriesSum * categoriesSum) / Math.max(1, dist);
                scored.push({ item: { location: house, categoriesSum }, prescore });
            }

            if (scored.length === 0)
                throw new InternalServerError(`ACO: no candidates for position ${index}`);

            scored.sort((a, b) => b.prescore - a.prescore);
            result.set(index, scored.slice(0, this.MAX_CANDIDATES).map(s => s.item));
        }

        return result;
    }

    // ─── Инициализация феромонов ──────────────────────────────────────────────

    private initPheromones(candidates: Map<number, LocationItem[]>) {
        this.pheromone.clear();
        for (const [pos, items] of candidates.entries()) {
            const posMap = new Map<string, number>();
            for (const item of items) {
                posMap.set(item.location.id, this.TAU_INIT);
            }
            this.pheromone.set(pos, posMap);
        }
    }

    // ─── Муравей строит решение ───────────────────────────────────────────────

    private constructSolution(candidates: Map<number, LocationItem[]>): LocationItem[] {
        const result: LocationItem[] = [];
        const used = new Set<string>();

        for (let pos = 0; pos < this.keys.length; pos++) {
            const items = candidates.get(pos)!;

            if (this.keys[pos].type === 'fixed') {
                result.push(items[0]);
                used.add(items[0].location.id);
                continue;
            }

            const prevId = result.length > 0
                ? result[result.length - 1].location.id
                : this.startPosition.id;

            const chosen = this.selectByProbability(pos, items, prevId, used);
            result.push(chosen);
            used.add(chosen.location.id);
        }

        return result;
    }

    // ─── Выбор вершины по вероятности ACO ────────────────────────────────────
    // p(i→j) = τ(pos,j)^α · η(i,j)^β / Σ τ(pos,l)^α · η(i,l)^β

    private selectByProbability(
        pos: number,
        items: LocationItem[],
        fromId: string,
        used: Set<string>,
    ): LocationItem {
        const posPhero = this.pheromone.get(pos)!;

        const weights: number[] = items.map(item => {
            if (used.has(item.location.id)) return 0;

            const tau = posPhero.get(item.location.id) ?? this.TAU_INIT;
            const dist = this.apsp.getDistance(fromId, item.location.id);
            const eta = 1 / Math.max(1, dist); // эвристика: 1/расстояние

            return Math.pow(tau, this.ALPHA) * Math.pow(eta, this.BETA);
        });

        const total = weights.reduce((s, w) => s + w, 0);

        // Если все использованы или все нули — возвращаем первый доступный
        if (total === 0) {
            return items.find(i => !used.has(i.location.id)) ?? items[0];
        }

        // Рулеточный выбор
        let rand = Math.random() * total;
        for (let i = 0; i < items.length; i++) {
            rand -= weights[i];
            if (rand <= 0) return items[i];
        }

        return items[items.length - 1];
    }

    // ─── Испарение феромона ───────────────────────────────────────────────────
    // τ(pos,j) ← (1 - ρ) · τ(pos,j)

    private evaporatePheromones(candidates: Map<number, LocationItem[]>) {
        for (const [pos, items] of candidates.entries()) {
            const posPhero = this.pheromone.get(pos)!;
            for (const item of items) {
                const id = item.location.id;
                const current = posPhero.get(id) ?? this.TAU_INIT;
                posPhero.set(id, (1 - this.RHO) * current);
            }
        }
    }

    // ─── Обновление феромона ──────────────────────────────────────────────────
    // Δτ(pos,j) = Q / C(π) для каждого муравья прошедшего через j на позиции pos

    private depositPheromones(
        solutions: AntSolution[],
    ) {
        for (const { placement, score } of solutions) {
            if (score <= 0) continue;

            const delta = this.Q / (1 / Math.max(score, 1e-9));

            for (let pos = 0; pos < placement.length; pos++) {
                const id = placement[pos].location.id;
                const posPhero = this.pheromone.get(pos);
                if (!posPhero) continue;

                const current = posPhero.get(id) ?? 0;
                posPhero.set(id, current + delta);
            }
        }
    }

    // ─── Целевая функция (аналог Annealing) ──────────────────────────────────

    private async scoreFunction(placement: LocationItem[]): Promise<number> {
        let totalDist = 0;
        for (let i = 1; i < placement.length; i++) {
            const d = this.apsp.getDistance(
                placement[i - 1].location.id,
                placement[i].location.id,
            );
            totalDist += d === Infinity ? 1e6 : d;
        }

        let beauty = 0;
        for (let i = 0; i < placement.length; i++) {
            if (this.keys[i].type === 'category')
                beauty += placement[i].categoriesSum ?? 0;
            else if (this.keys[i].type === 'fixed')
                beauty += 100;
        }

        // F(π) = B(π)³ / C(π) — та же функция что у Annealing для честного сравнения
        return Math.pow(beauty, 3) / Math.max(10, totalDist);
    }

    // ─── Соответствие категорий ───────────────────────────────────────────────

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