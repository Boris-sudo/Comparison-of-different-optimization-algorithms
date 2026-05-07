import {
    Component,
    OnInit,
    ViewChild,
    ElementRef,
    AfterViewInit,
    OnDestroy,
    NgZone,
    ChangeDetectorRef, ChangeDetectionStrategy, effect
} from '@angular/core';
import { ProfileApiService } from "../../services/api/profile.api";
import { FormsModule } from '@angular/forms';
import { GraphService } from "../../services/graph.service";
import { HouseInterface, StreetInterface } from "../../../generated";
import cytoscape, { Core, NodeSingular } from 'cytoscape';
import cola from 'cytoscape-cola';

cytoscape.use(cola);

@Component({
    selector: 'app-home',
    imports: [FormsModule],
    templateUrl: './home.html',
    styleUrl: './home.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('cytoscapeContainer') cytoscapeContainer!: ElementRef<HTMLDivElement>;

    activeTab: 'editor' | 'route' = 'editor';
    isLoading = false;
    error: string | null = null;

    routePrompt = '';
    selectedAlgorithm = 'Annealing';
    routeResult: string[] = [];
    isBuildingRoute = false;

    houseCategories = [
        { id: 0,  name: 'дом',             icon: '🏠' },
        { id: 1,  name: 'парк',            icon: '🌳' },
        { id: 2,  name: 'кафе',            icon: '☕' },
        { id: 3,  name: 'пекарня',         icon: '🥐' },
        { id: 4,  name: 'ресторан',        icon: '🍽️' },
        { id: 5,  name: 'музей',           icon: '🏛️' },
        { id: 6,  name: 'галерея',         icon: '🎨' },
        { id: 7,  name: 'библиотека',      icon: '📚' },
        { id: 8,  name: 'книжный магазин', icon: '📖' },
        { id: 9,  name: 'супермаркет',     icon: '🛒' },
        { id: 10, name: 'рынок',           icon: '🏪' },
        { id: 11, name: 'аптека',          icon: '💊' },
        { id: 12, name: 'кинотеатр',       icon: '🎬' },
        { id: 13, name: 'театр',           icon: '🎭' },
        { id: 14, name: 'спортзал',        icon: '💪' },
        { id: 15, name: 'бассейн',         icon: '🏊' },
        { id: 16, name: 'школа',           icon: '🏫' },
        { id: 17, name: 'университет',     icon: '🎓' },
        { id: 18, name: 'церковь',         icon: '⛪' },
        { id: 19, name: 'больница',        icon: '🏥' },
    ];

    selectedHouse: HouseInterface | null = null;

    houses: HouseInterface[] = [];
    streets: StreetInterface[] = [];
    streetSet = new Set<string>();

    availableAlgorithms = [
        { id: 'Annealing', name: 'Simulated Annealing', description: 'Оптимизация через отжиг' },
        { id: 'Dfs',       name: 'DFS',                 description: 'Поиск в глубину' },
        { id: 'Bfs',       name: 'BFS',                 description: 'Поиск в ширину' },
        { id: 'A*',        name: 'A*',                  description: 'Эвристический поиск' },
        { id: 'ACO',       name: 'ACO',                 description: 'Муравьиный алгоритм' },
    ];

    private cy: Core | null = null;
    private layoutInstance: any = null;

    constructor(
        public profileApi: ProfileApiService,
        public graphService: GraphService,
        private ngZone: NgZone,
        private cdr: ChangeDetectorRef,
    ) {
        effect(() => {
            const isAuth = this.profileApi.isAuthenticated();
            if (isAuth) {
                this.isLoading = false;
                this.loadGraph();
            }
        });
    }

    async ngOnInit() {}

    ngAfterViewInit() {
        setTimeout(() => this.initCytoscape(), 150);
    }

    ngOnDestroy() {
        this.layoutInstance?.stop();
        this.cy?.destroy();
    }

    loadGraph() {
        const user = this.profileApi.currentUser();
        if (user?.city?.houses) {
            this.houses = user.city.houses;
            this.buildStreetList();
            if (this.cy) {
                this.updateCytoscapeElements();
            }
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

    private initCytoscape() {
        if (!this.cytoscapeContainer?.nativeElement) return;

        this.ngZone.runOutsideAngular(() => {
            this.cy = cytoscape({
                container: this.cytoscapeContainer.nativeElement,
                elements: this.buildElements(),
                style: this.getCytoscapeStyle(),
                userZoomingEnabled: true,
                userPanningEnabled: true,
                boxSelectionEnabled: false,
                minZoom: 0.3,
                maxZoom: 3,
            });

            this.layoutInstance = this.cy.layout(this.getForceLayout());  // 👈
            this.layoutInstance.run();

            this.cy.on('grab', 'node', (event) => {
                const grabbed = event.target as NodeSingular;
                this.cy!.nodes().forEach(node => {
                    if (node.id() !== grabbed.id()) {
                        node.lock();
                    }
                });
            });

            this.cy.on('drag', 'node', (event) => {
                const grabbed = event.target as NodeSingular;
                grabbed.neighborhood('node').forEach((neighbor: NodeSingular) => {
                    neighbor.unlock();
                });
            });

            this.cy.on('free', 'node', () => {
                this.cy!.nodes().forEach(node => {
                    node.unlock()
                });
            });

            this.cy.on('tap', 'node', (event) => {
                const node = event.target as NodeSingular;
                const houseId = node.id();
                const house = this.houses.find(h => h.id === houseId) ?? null;
                this.ngZone.run(() => {
                    this.selectedHouse = house;
                    this.cdr.detectChanges();
                    this.updateNodeStyles();
                });
            });

            this.cy.on('tap', (event) => {
                if (event.target === this.cy) {
                    this.ngZone.run(() => {
                        this.selectedHouse = null;
                        this.cdr.detectChanges();
                        this.updateNodeStyles();
                    });
                }
            });
        });
    }

    private updateCytoscapeElements() {
        if (!this.cy) return;
        this.layoutInstance?.stop();
        this.cy.elements().remove();
        this.cy.add(this.buildElements());
        this.layoutInstance = this.cy.layout(this.getForceLayout());  // 👈
        this.layoutInstance.run();
        this.updateNodeStyles();
    }

    private getForceLayout(): any {
        return {
            name: 'cola',
            animate: true,
            refresh: 1,
            maxSimulationTime: 10000,
            ungrabifyWhileSimulating: false,
            fit: true,
            padding: 80,
            infinite: true,
            nodeSpacing: 60,
            edgeLength: 150,
            alignment: undefined,
            alpha: 0.3,
            convergenceThreshold: 0.001,
            avoidOverlap: true,
            handleDisconnected: true,
            randomize: true,
        };
    }

    private buildElements(): cytoscape.ElementDefinition[] {
        const nodes: cytoscape.ElementDefinition[] = this.houses.map(house => {
            const cat = this.houseCategories[house.category];
            return {
                data: {
                    id: house.id,
                    label: `${cat?.icon ?? '📍'}\n${cat?.name ?? ''}`,
                    category: house.category,
                },
            };
        });

        const edges: cytoscape.ElementDefinition[] = this.streets.map(street => ({
            data: {
                id: street.id,
                source: street.from,
                target: street.to,
                label: `${street.length}`,
            },
        }));

        return [...nodes, ...edges];
    }

    private getCytoscapeStyle(): cytoscape.StylesheetStyle[] {
        return [
            {
                selector: 'node',
                style: {
                    'background-color': '#1a1a3e',
                    'border-color': '#4a5568',
                    'border-width': 2,
                    'label': 'data(label)',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'color': '#f8fafc',
                    'font-size': '13px',
                    'width': 48,
                    'height': 48,
                    'text-wrap': 'wrap',
                    'text-max-width': '80px',
                    'transition-property': 'background-color, border-color, border-width, width, height',
                    'transition-duration': '200ms',
                } as any,
            },
            {
                selector: 'node.selected',
                style: {
                    'background-color': '#8b5cf6',
                    'border-color': '#a78bfa',
                    'border-width': 3,
                    'width': 58,
                    'height': 58,
                } as any,
            },
            {
                selector: 'node.in-route',
                style: {
                    'background-color': '#553c9a',
                    'border-color': '#8b5cf6',
                    'border-width': 3,
                } as any,
            },
            {
                selector: 'edge',
                style: {
                    'width': 1.5,
                    'line-color': '#4a5568',
                    'label': 'data(label)',
                    'font-size': '10px',
                    'color': '#718096',
                    'text-rotation': 'autorotate',
                    'text-margin-y': -8,
                    'curve-style': 'bezier',
                    'transition-property': 'line-color, width',
                    'transition-duration': '200ms',
                } as any,
            },
            {
                selector: 'edge.in-route',
                style: {
                    'line-color': '#8b5cf6',
                    'width': 3,
                } as any,
            },
        ];
    }

    updateNodeStyles() {
        if (!this.cy) return;
        const routeSet = new Set(this.routeResult);

        this.cy.nodes().forEach(node => {
            node.removeClass('selected in-route');
            if (node.id() === this.selectedHouse?.id) {
                node.addClass('selected');
            } else if (routeSet.has(node.id())) {
                node.addClass('in-route');
            }
        });

        this.cy.edges().forEach(edge => {
            edge.removeClass('in-route');
        });

        if (this.routeResult.length > 1) {
            for (let i = 0; i < this.routeResult.length - 1; i++) {
                const from = this.routeResult[i];
                const to = this.routeResult[i + 1];
                this.cy!
                    .$(`edge[source="${from}"][target="${to}"], edge[source="${to}"][target="${from}"]`)
                    .addClass('in-route');
            }
        }
    }

    async changeHouseCategory(categoryId: number) {
        if (!this.selectedHouse) return;
        const dto = {
            id: this.selectedHouse.id,
            category: categoryId,
            time: this.selectedHouse.time,
            price: this.selectedHouse.price,
            weather: this.selectedHouse.weather,
            action: 'change' as const,
        };
        const resp = await this.graphService.changeHouse(dto);
        this.profileApi.currentUser.set(resp);
        this.selectedHouse.category = categoryId;

        if (this.cy) {
            const cat = this.houseCategories[categoryId];
            this.cy.$(`#${this.selectedHouse.id}`).data('label', `${cat?.icon ?? '📍'}\n${cat?.name ?? ''}`);
        }
        this.loadGraph();
    }

    async deleteHouse() {
        if (!this.selectedHouse) return;
        const dto = {
            id: this.selectedHouse.id,
            category: this.selectedHouse.category,
            time: this.selectedHouse.time,
            price: this.selectedHouse.price,
            weather: this.selectedHouse.weather,
            action: 'delete' as const,
        };
        const resp = await this.graphService.changeHouse(dto);
        this.profileApi.currentUser.set(resp);
        this.selectedHouse = null;
        this.loadGraph();
    }

    async buildRoute() {
        if (!this.routePrompt.trim() || !this.houses.length) return;
        this.isBuildingRoute = true;
        this.error = null;
        this.routeResult = [];
        try {
            const result = await this.graphService.createPath({
                model: this.selectedAlgorithm as any,
                prompt: this.routePrompt,
                startPoint: this.houses[0],
            });
            this.routeResult = result.points ?? [];
            this.updateNodeStyles();
        } catch (e: any) {
            this.error = e?.message ?? 'Ошибка при построении маршрута';
        } finally {
            this.isBuildingRoute = false;
        }
    }

    async onRegenerateCity() {
        this.isLoading = true;
        try {
            await this.profileApi.regenerateCity();
            this.selectedHouse = null;
            this.routeResult = [];
            this.loadGraph();
        } finally {
            this.isLoading = false;
        }
    }

    getCategoryForHouse(houseId: string): number {
        return this.houses.find(h => h.id === houseId)?.category ?? -1;
    }

    onTabChange(tab: 'editor' | 'route') {
        this.activeTab = tab;
        if (tab === 'editor') {
            setTimeout(() => this.cy?.resize(), 50);
        }
    }
}