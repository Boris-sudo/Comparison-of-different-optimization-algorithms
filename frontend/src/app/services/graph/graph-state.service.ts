import { Injectable, signal, computed, WritableSignal } from '@angular/core';
import {
    HouseInterface,
    StreetInterface,
    PathResultItem,
    ModelType,
    PathAnalyzeDuration,
    PathResponseInterface, PairPathStatisticsInterface
} from '../../../generated';
import * as d3 from 'd3';
import { ProfileApiService } from "../api/profile.api";

export interface D3Node extends d3.SimulationNodeDatum {
    id: string;
    category: number;
    house: HouseInterface;
    x?: number;
    y?: number;
    fx?: number | null;
    fy?: number | null;
}

export interface D3Link extends d3.SimulationLinkDatum<D3Node> {
    id: string;
    length: number;
    source: D3Node | string;
    target: D3Node | string;
}

export type Pair<T> = {
    first: T,
    second: T,
}

@Injectable({ providedIn: 'root' })
export class GraphStateService {
    // ─── Graph data ───────────────────────────────────────────────────────────
    houses: HouseInterface[] = [];
    streets: StreetInterface[] = [];
    streetSet = new Set<string>();
    d3Nodes: D3Node[] = [];
    d3Links: D3Link[] = [];

    // ─── Graph signals ───────────────────────────────────────────────────────────
    reloadGraph = signal<boolean>(false);

    // ─── Selection ────────────────────────────────────────────────────────────
    selectedHouse = signal<HouseInterface | null>(null);
    selectedStreet = signal<StreetInterface | null>(null);
    edgeSourceNode = signal<D3Node | null>(null);
    editingStreetLength = signal<number>(0);

    // ─── UI state ─────────────────────────────────────────────────────────────
    editMode = signal<'select' | 'add-node' | 'add-edge'>('select');
    activeTab = signal<'editor' | 'route' | 'compare'>('editor');
    isLoading = signal(false);
    isGenerating = signal(false);
    isBuildingRoute = signal(false);
    error = signal<string | null>(null);
    graphInitialized = false;
    newCityNodeCount = signal<number | null>(null);

    // ─── Route ────────────────────────────────────────────────────────────────
    routeResult = signal<PathResultItem[]>([]);
    routeMainPoints = signal<string[]>([]);
    routeOuterPoints = signal<string[]>([]);
    routeLength = signal<number>(0);
    routePrompt = signal('');
    selectedAlgorithm = signal<ModelType>('Annealing');
    routeDuration = signal<PathAnalyzeDuration>({ network: 0, algo: 0 });
    routeSegmentsLength = signal<number[]>([]);

    // ─── Compare routes ────────────────────────────────────────────────────────────────
    pairRoutes= signal<PairPathStatisticsInterface | null>(null);
    algorithms: Pair<WritableSignal<ModelType>> = {
        first: signal<ModelType>("Dfs"),
        second: signal<ModelType>("Annealing"),
    };

    // ─── Computed ─────────────────────────────────────────────────────────────
    hasRoute = computed(() => this.routeResult().length > 0);

    readonly houseCategories = [
        { id: 0, name: 'Дом', icon: '🏠' },
        { id: 1, name: 'Парк', icon: '🌳' },
        { id: 2, name: 'Кафе', icon: '☕' },
        { id: 3, name: 'Пекарня', icon: '🥐' },
        { id: 4, name: 'Ресторан', icon: '🍽️' },
        { id: 5, name: 'Музей', icon: '🏛️' },
        { id: 6, name: 'Галерея', icon: '🎨' },
        { id: 7, name: 'Библиотека', icon: '📚' },
        { id: 8, name: 'Книжный', icon: '📖' },
        { id: 9, name: 'Супермаркет', icon: '🛒' },
        { id: 10, name: 'Рынок', icon: '🏪' },
        { id: 11, name: 'Аптека', icon: '💊' },
        { id: 12, name: 'Кинотеатр', icon: '🎬' },
        { id: 13, name: 'Театр', icon: '🎭' },
        { id: 14, name: 'Спортзал', icon: '💪' },
        { id: 15, name: 'Бассейн', icon: '🏊' },
        { id: 16, name: 'Школа', icon: '🏫' },
        { id: 17, name: 'Университет', icon: '🎓' },
        { id: 18, name: 'Церковь', icon: '⛪' },
        { id: 19, name: 'Больница', icon: '🏥' },
        { id: 20, name: 'Магазин вешалок', icon: '🏪👶🏿' },
        { id: 21, name: 'Клуб клуб', icon: '🍷' },
        { id: 22, name: 'Остров Эпштейна', icon: '🏝️' },
    ];

    readonly availableAlgorithms = [
        { id: 'Annealing' as ModelType, name: 'Simulated Annealing', description: 'Метрополис-отжиг' },
        { id: 'Dfs' as ModelType, name: 'DFS', description: 'Поиск в глубину' },
        { id: 'Bfs' as ModelType, name: 'BFS', description: 'Поиск в ширину' },
        { id: 'A*' as ModelType, name: 'A*', description: 'Эвристический' },
        { id: 'ACO' as ModelType, name: 'ACO', description: 'Муравьиный алг.' },
    ];

    constructor(
        public profileApi: ProfileApiService,
    ) {}

    // ─── Methods ──────────────────────────────────────────────────────────────

    loadGraph() {
        const user = this.profileApi.currentUser();
        if (!user?.city?.houses) return;

        if (!this.graphInitialized) {
            this.houses = [...user.city.houses];
            this.buildStreetList();
            this.reloadGraph.set(true);
        }
    }

    buildStreetList() {
        this.streets = [];
        this.streetSet.clear();
        for (const house of this.houses) {
            for (const edge of house.edges || []) {
                if (!this.streetSet.has(edge.id)) {
                    this.streetSet.add(edge.id);
                    this.streets.push(edge);
                }
            }
        }
    }

    buildD3Data() {
        const existingPositions = new Map<string, { x: number; y: number }>();
        this.d3Nodes.forEach(n => {
            if (n.x !== undefined && n.y !== undefined) {
                existingPositions.set(n.id, { x: n.x, y: n.y });
            }
        });

        this.d3Nodes = this.houses.map(house => {
            const pos = existingPositions.get(house.id);
            return { id: house.id, category: house.category, house, x: pos?.x, y: pos?.y };
        });

        const nodeMap = new Map(this.d3Nodes.map(n => [n.id, n]));
        this.d3Links = this.streets
            .filter(s => nodeMap.has(s.from) && nodeMap.has(s.to))
            .map(street => ({
                id: street.id,
                length: street.length,
                source: street.from,
                target: street.to,
            }));
    }

    setRoute(route: PathResponseInterface) {
        this.routeResult.set(route.points ?? []);
        this.routeLength.set(route.length);
        this.routeDuration.set(route.duration);
        const main: string[] = [];
        const outer: string[] = [];
        for (const p of route.points ?? []) {
            if (p.role === 'main') main.push(p.id);
            else outer.push(p.id);
        }
        this.routeMainPoints.set(main);
        this.routeOuterPoints.set(outer);
    }

    setPairRoutes(route: PairPathStatisticsInterface) {
        this.pairRoutes.set(route);
        const main: Set<string> = new Set<string>();
        const outer: Set<string> = new Set<string>();
        for (const point of route.first.points) {
            if (point.role === 'outer')
                outer.add(point.id);
            else if (point.role === 'main')
                main.add(point.id);
        }
        for (const point of route.second.points) {
            if (point.role === 'outer')
                outer.add(point.id);
            else if (point.role === 'main')
                main.add(point.id);
        }
        this.routeMainPoints.set([...main]);
        this.routeOuterPoints.set([...outer]);

    }

    clearRoute() {
        this.routeResult.set([]);
        this.routeDuration.set({ network: 0, algo: 0 });
        this.routeMainPoints.set([]);
        this.routeOuterPoints.set([]);
        this.routeLength.set(0);
        this.routeSegmentsLength.set([]);
        this.pairRoutes.set(null);
    }

    getCategoryForHouse(houseId: string): number {
        return this.houses.find(h => h.id === houseId)?.category ?? -1;
    }

    reset() {
        this.houses = [];
        this.streets = [];
        this.streetSet.clear();
        this.d3Nodes = [];
        this.d3Links = [];
        this.selectedHouse.set(null);
        this.selectedStreet.set(null);
        this.edgeSourceNode.set(null);
        this.graphInitialized = false;
        this.clearRoute();
        this.reloadGraph.set(true);
    }
}