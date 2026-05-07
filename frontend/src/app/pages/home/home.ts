import {
    Component,
    OnInit,
    ViewChild,
    ElementRef,
    AfterViewInit,
    OnDestroy,
    NgZone,
    ChangeDetectorRef,
    ChangeDetectionStrategy, effect,
} from '@angular/core';
import { ProfileApiService } from "../../services/api/profile.api";
import { FormsModule } from '@angular/forms';
import { GraphService } from "../../services/graph.service";
import { HouseChangeInterface, HouseInterface, StreetChangeInterface, StreetInterface } from "../../../generated";
import * as d3 from 'd3';

interface D3Node extends d3.SimulationNodeDatum {
    id: string;
    category: number;
    house: HouseInterface;
    x?: number;
    y?: number;
    fx?: number | null;
    fy?: number | null;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
    id: string;
    length: number;
    source: D3Node | string;
    target: D3Node | string;
}

@Component({
    selector: 'app-home',
    imports: [FormsModule],
    templateUrl: './home.html',
    styleUrl: './home.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('graphSvg') graphSvg!: ElementRef<SVGSVGElement>;
    @ViewChild('graphContainer') graphContainer!: ElementRef<HTMLDivElement>;

    activeTab: 'editor' | 'route' = 'editor';
    isLoading = false;
    error: string | null = null;

    routePrompt = '';
    selectedAlgorithm = 'Annealing';
    routeResult: string[] = [];
    isBuildingRoute = false;

    houseCategories = [
        { id: 0, name: 'дом', icon: '🏠' },
        { id: 1, name: 'парк', icon: '🌳' },
        { id: 2, name: 'кафе', icon: '☕' },
        { id: 3, name: 'пекарня', icon: '🥐' },
        { id: 4, name: 'ресторан', icon: '🍽️' },
        { id: 5, name: 'музей', icon: '🏛️' },
        { id: 6, name: 'галерея', icon: '🎨' },
        { id: 7, name: 'библиотека', icon: '📚' },
        { id: 8, name: 'книжный магазин', icon: '📖' },
        { id: 9, name: 'супермаркет', icon: '🛒' },
        { id: 10, name: 'рынок', icon: '🏪' },
        { id: 11, name: 'аптека', icon: '💊' },
        { id: 12, name: 'кинотеатр', icon: '🎬' },
        { id: 13, name: 'театр', icon: '🎭' },
        { id: 14, name: 'спортзал', icon: '💪' },
        { id: 15, name: 'бассейн', icon: '🏊' },
        { id: 16, name: 'школа', icon: '🏫' },
        { id: 17, name: 'университет', icon: '🎓' },
        { id: 18, name: 'церковь', icon: '⛪' },
        { id: 19, name: 'больница', icon: '🏥' },
    ];

    selectedHouse: HouseInterface | null = null;
    houses: HouseInterface[] = [];
    streets: StreetInterface[] = [];
    streetSet = new Set<string>();

    availableAlgorithms = [
        { id: 'Annealing', name: 'Simulated Annealing', description: 'Оптимизация через отжиг' },
        { id: 'Dfs', name: 'DFS', description: 'Поиск в глубину' },
        { id: 'Bfs', name: 'BFS', description: 'Поиск в ширину' },
        { id: 'A*', name: 'A*', description: 'Эвристический поиск' },
        { id: 'ACO', name: 'ACO', description: 'Муравьиный алгоритм' },
    ];

    private simulation!: d3.Simulation<D3Node, D3Link>;
    private svg!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private g!: d3.Selection<SVGGElement, unknown, null, undefined>;
    private d3Nodes: D3Node[] = [];
    private d3Links: D3Link[] = [];
    private width = 900;
    private height = 600;

    editMode: 'select' | 'add-node' | 'add-edge' = 'select';
    edgeSourceNode: D3Node | null = null;

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
                this.cdr.detectChanges();
                this.loadGraph();
            }
        });
    }

    async ngOnInit() {
        if (this.profileApi.notAuthenticated()) {
            // this.isLoading = true;
            // try {
            //     await this.profileApi.register();
            // } finally {
            //     this.isLoading = false;
            //     this.cdr.detectChanges();
            // }
        }
        // this.loadGraph();
    }

    ngAfterViewInit() {
        setTimeout(() => this.initD3(), 150);
    }

    ngOnDestroy() {
        this.simulation?.stop();
    }

    loadGraph() {
        const user = this.profileApi.currentUser();
        if (user?.city?.houses) {
            this.houses = [...user.city.houses];
            this.buildStreetList();
            if (this.svg) {
                this.rebuildGraph();
            }
            this.cdr.detectChanges();
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

    private initD3() {
        if (!this.graphSvg?.nativeElement) return;

        this.ngZone.runOutsideAngular(() => {
            const el = this.graphSvg.nativeElement;
            this.width = el.clientWidth || 900;
            this.height = el.clientHeight || 600;

            this.svg = d3.select(el);

            const zoom = d3.zoom<SVGSVGElement, unknown>()
                .scaleExtent([0.1, 4])
                .filter(event => {
                    // Зум только если не в режиме добавления
                    if (this.editMode !== 'select') return false;
                    return !event.button;
                })
                .on('zoom', (event) => {
                    this.g.attr('transform', event.transform);
                });

            this.svg.call(zoom);

            this.svg.append('rect')
                .attr('width', '100%')
                .attr('height', '100%')
                .attr('fill', 'transparent');

            this.svg.on('click', (event) => {
                if (event.target === el || event.target.tagName === 'rect') {
                    if (this.editMode === 'add-node') {
                        // Получаем координаты с учётом трансформации
                        const transform = d3.zoomTransform(el);
                        const [x, y] = transform.invert(d3.pointer(event));
                        this.ngZone.run(() => this.addNode(x, y));
                    } else {
                        this.ngZone.run(() => {
                            this.selectedHouse = null;
                            this.edgeSourceNode = null;
                            this.cdr.detectChanges();
                            this.updateNodeStyles();
                            this.updateLinkStyles();
                        });
                    }
                }
            });

            this.g = this.svg.append('g');

            this.buildD3Data();
            this.buildSimulation();
            this.renderGraph();
        });
    }

    private buildD3Data() {
        this.d3Nodes = this.houses.map(house => ({
            id: house.id,
            category: house.category,
            house,
        }));

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

    private buildSimulation() {
        this.simulation?.stop();

        const connectedIds = new Set<string>();
        this.d3Links.forEach(link => {
            connectedIds.add(typeof link.source === 'string' ? link.source : (link.source as D3Node).id);
            connectedIds.add(typeof link.target === 'string' ? link.target : (link.target as D3Node).id);
        });

        this.simulation = d3.forceSimulation<D3Node, D3Link>(this.d3Nodes)
            .force('link', d3.forceLink<D3Node, D3Link>(this.d3Links)
                .id(d => d.id)
                .distance(120)
                .strength(0.3)
            )
            .force('charge', d3.forceManyBody()
                .strength(d => connectedIds.has((d as D3Node).id) ? -400 : -80)
                .distanceMax(400)
            )
            .force('center', d3.forceCenter(this.width / 2, this.height / 2)
                .strength(0.05)
            )
            .force('isolatedX', d3.forceX(this.width / 2)
                .strength(d => connectedIds.has((d as D3Node).id) ? 0 : 0.08)
            )
            .force('isolatedY', d3.forceY(this.height / 2)
                .strength(d => connectedIds.has((d as D3Node).id) ? 0 : 0.08)
            )
            .force('collision', d3.forceCollide(50))
            .alphaDecay(0.02)
            .velocityDecay(0.4)
            .alpha(0.8)
            .on('tick', () => this.ticked())
            .on('end', () => this.fitGraph());  // 👈 когда симуляция остановится — fit
    }

    private fitGraph() {
        if (!this.g || !this.svg || this.d3Nodes.length === 0) return;

        const padding = 60;

        // Границы всех узлов
        const xs = this.d3Nodes.map(d => d.x ?? 0);
        const ys = this.d3Nodes.map(d => d.y ?? 0);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const graphW = maxX - minX || 1;
        const graphH = maxY - minY || 1;

        const scale = Math.min(
            (this.width  - padding * 2) / graphW,
            (this.height - padding * 2) / graphH,
            2  // не зумируем больше x2
        );

        const tx = (this.width  - graphW * scale) / 2 - minX * scale;
        const ty = (this.height - graphH * scale) / 2 - minY * scale;

        const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);

        this.svg.transition()
            .duration(600)
            .call(
                d3.zoom<SVGSVGElement, unknown>().transform as any,
                transform
            );

        this.g.transition()
            .duration(600)
            .attr('transform', transform.toString());
    }

    private renderGraph() {
        if (!this.g) return;
        this.g.selectAll('*').remove();

        // Рёбра
        this.g.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(this.d3Links)
            .enter()
            .append('line')
            .attr('class', 'graph-link')
            .attr('stroke', '#3a3a5c')
            .attr('stroke-width', 1.5)
            .attr('stroke-opacity', 0.6);

        // Подписи рёбер
        this.g.append('g')
            .attr('class', 'link-labels')
            .selectAll('text')
            .data(this.d3Links)
            .enter()
            .append('text')
            .attr('class', 'link-label')
            .attr('text-anchor', 'middle')
            .attr('fill', '#6b7280')
            .attr('font-size', '10px')
            .text(d => d.length);

        // Группы узлов
        const nodeGroup = this.g.append('g')
            .attr('class', 'nodes')
            .selectAll('g')
            .data(this.d3Nodes)
            .enter()
            .append('g')
            .attr('class', 'graph-node')
            .attr('cursor', 'pointer')
            .call(
                d3.drag<SVGGElement, D3Node>()
                    .on('start', (event, d) => this.dragStarted(event, d))
                    .on('drag', (event, d) => this.dragged(event, d))
                    .on('end', (event, d) => this.dragEnded(event, d))
            )
            .on('click', (event, d) => {
                event.stopPropagation();
                this.ngZone.run(() => {
                    if (this.editMode === 'add-edge') {
                        this.handleEdgeClick(d);
                    } else {
                        this.selectedHouse = d.house;
                        this.edgeSourceNode = null;
                        this.cdr.detectChanges();
                        this.updateNodeStyles();
                        this.updateLinkStyles();
                    }
                });
            })

        // Внешнее свечение (как в Obsidian)
        nodeGroup.append('circle')
            .attr('class', 'node-glow')
            .attr('r', 28)
            .attr('fill', 'transparent')
            .attr('stroke', 'transparent')
            .attr('stroke-width', 8);

        // Основной круг
        nodeGroup.append('circle')
            .attr('class', 'node-circle')
            .attr('r', 20)
            .attr('fill', '#1e1e3f')
            .attr('stroke', '#4a4a8a')
            .attr('stroke-width', 2);

        // Иконка
        nodeGroup.append('text')
            .attr('class', 'node-icon')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('font-size', '16px')
            .attr('y', 0)
            .text(d => this.houseCategories[d.category]?.icon ?? '📍');

        // Подпись под узлом
        nodeGroup.append('text')
            .attr('class', 'node-label')
            .attr('text-anchor', 'middle')
            .attr('y', 32)
            .attr('fill', '#94a3b8')
            .attr('font-size', '10px')
            .text(d => this.houseCategories[d.category]?.name ?? '');
    }

    private async addNode(x: number, y: number) {
        try {
            const dto: HouseChangeInterface = {
                id: crypto.randomUUID(), // генерируем id на фронте
                action: 'add',
                category: 0,
                time: 0,
                price: 0,
                weather: false,
            };
            const resp = await this.graphService.changeHouse(dto);
            this.profileApi.currentUser.set(resp);

            const newHouse = resp.city!.houses!.at(-1)!;
            const newNode: D3Node = {
                id: newHouse.id,
                category: newHouse.category,
                house: newHouse,
                x,
                y,
            };
            this.d3Nodes.push(newNode);
            this.houses = [...this.houses, newHouse];
            this.simulation.nodes(this.d3Nodes);
            this.simulation.alpha(0.1).restart();
            this.renderGraph();
            this.cdr.detectChanges();
        } catch (e: any) {
            this.error = e?.message ?? 'Ошибка при добавлении вершины';
            this.cdr.detectChanges();
        }
    }

    private async handleEdgeClick(targetNode: D3Node) {
        if (!this.edgeSourceNode) {
            this.edgeSourceNode = targetNode;
            this.cdr.detectChanges();
            this.updateNodeStyles();
            return;
        }

        if (this.edgeSourceNode.id === targetNode.id) {
            this.edgeSourceNode = null;
            this.cdr.detectChanges();
            this.updateNodeStyles();
            return;
        }

        const from = this.edgeSourceNode;
        const to = targetNode;
        this.edgeSourceNode = null;

        try {
            const dto: StreetChangeInterface = {
                id: `${ from.id }:${ to.id }`,  // 👈 бэкенд вытащит from/to из id
                length: 10,
                action: 'add',
            };
            const resp = await this.graphService.changeStreet(dto);
            this.profileApi.currentUser.set(resp);
            this.loadGraph();
        } catch (e: any) {
            this.error = e?.message ?? 'Ошибка при добавлении ребра';
            this.cdr.detectChanges();
        }
    }

    setEditMode(mode: 'select' | 'add-node' | 'add-edge') {
        this.editMode = mode;
        this.edgeSourceNode = null;
        this.selectedHouse = null;
        this.cdr.detectChanges();
        this.updateNodeStyles();
    }

    private ticked() {
        if (!this.g) return;

        this.g.selectAll<SVGLineElement, D3Link>('.graph-link')
            .attr('x1', d => (d.source as D3Node).x ?? 0)
            .attr('y1', d => (d.source as D3Node).y ?? 0)
            .attr('x2', d => (d.target as D3Node).x ?? 0)
            .attr('y2', d => (d.target as D3Node).y ?? 0);

        this.g.selectAll<SVGTextElement, D3Link>('.link-label')
            .attr('x', d => (((d.source as D3Node).x ?? 0) + ((d.target as D3Node).x ?? 0)) / 2)
            .attr('y', d => (((d.source as D3Node).y ?? 0) + ((d.target as D3Node).y ?? 0)) / 2 - 6);

        this.g.selectAll<SVGGElement, D3Node>('.graph-node')
            .attr('transform', d => `translate(${ d.x ?? 0 }, ${ d.y ?? 0 })`);
    }

    private dragStarted(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) {
        if (!event.active) {
            // Подогреваем симуляцию чуть-чуть — не на полную
            this.simulation.alphaTarget(0.15).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
    }

    private dragged(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) {
        d.fx = event.x;
        d.fy = event.y;
    }

    private dragEnded(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) {
        if (!event.active) {
            // Возвращаем к затуханию
            this.simulation.alphaTarget(0);
        }
        // Отпускаем узел — он продолжит двигаться по физике
        d.fx = null;
        d.fy = null;
    }

    private rebuildGraph() {
        this.simulation?.stop();
        this.buildD3Data();
        this.buildSimulation();
        this.renderGraph();
        this.updateNodeStyles();
        this.updateLinkStyles();
    }

    updateNodeStyles() {
        if (!this.g) return;
        const routeSet = new Set(this.routeResult);

        this.g.selectAll<SVGGElement, D3Node>('.graph-node').each((d, i, nodes) => {
            const node = d3.select(nodes[i]);
            const isSelected = d.id === this.selectedHouse?.id;
            const isEdgeSource = d.id === this.edgeSourceNode?.id;
            const inRoute = routeSet.has(d.id);

            node.select('.node-circle')
                .attr('fill', isSelected ? '#7c3aed' : isEdgeSource ? '#059669' : inRoute ? '#4c1d95' : '#1e1e3f')
                .attr('stroke', isSelected ? '#a78bfa' : isEdgeSource ? '#34d399' : inRoute ? '#7c3aed' : '#4a4a8a')
                .attr('stroke-width', isSelected || isEdgeSource ? 3 : 2)
                .attr('r', isSelected || isEdgeSource ? 24 : 20);

            node.select('.node-glow')
                .attr('stroke', isSelected ? '#7c3aed' : isEdgeSource ? '#059669' : inRoute ? '#4c1d95' : 'transparent')
                .attr('stroke-opacity', isSelected || isEdgeSource ? 0.4 : inRoute ? 0.3 : 0);
        });
    }

    updateLinkStyles() {
        if (!this.g) return;
        const routeSet = new Set(this.routeResult);

        this.g.selectAll<SVGLineElement, D3Link>('.graph-link')
            .attr('stroke', d => {
                const src = (d.source as D3Node).id;
                const tgt = (d.target as D3Node).id;
                for (let i = 0; i < this.routeResult.length - 1; i++) {
                    const a = this.routeResult[i];
                    const b = this.routeResult[i + 1];
                    if ((src === a && tgt === b) || (src === b && tgt === a)) {
                        return '#7c3aed';
                    }
                }
                return '#3a3a5c';
            })
            .attr('stroke-width', d => {
                const src = (d.source as D3Node).id;
                const tgt = (d.target as D3Node).id;
                for (let i = 0; i < this.routeResult.length - 1; i++) {
                    const a = this.routeResult[i];
                    const b = this.routeResult[i + 1];
                    if ((src === a && tgt === b) || (src === b && tgt === a)) return 3;
                }
                return 1.5;
            });
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

        // Обновляем иконку прямо в D3 без перестройки
        const node = this.d3Nodes.find(n => n.id === this.selectedHouse!.id);
        if (node) {
            node.category = categoryId;
            this.g.selectAll<SVGGElement, D3Node>('.graph-node')
                .filter(d => d.id === node.id)
                .select('.node-icon')
                .text(this.houseCategories[categoryId]?.icon ?? '📍');
            this.g.selectAll<SVGGElement, D3Node>('.graph-node')
                .filter(d => d.id === node.id)
                .select('.node-label')
                .text(this.houseCategories[categoryId]?.name ?? '');
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
            this.updateLinkStyles();
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
            this.cdr.detectChanges();
        }
    }

    getCategoryForHouse(houseId: string): number {
        return this.houses.find(h => h.id === houseId)?.category ?? -1;
    }

    onTabChange(tab: 'editor' | 'route') {
        this.activeTab = tab;
        if (tab === 'editor') {
            setTimeout(() => {
                const el = this.graphSvg?.nativeElement;
                if (el) {
                    this.width = el.clientWidth || 900;
                    this.height = el.clientHeight || 600;
                    this.simulation?.force('center', d3.forceCenter(this.width / 2, this.height / 2));
                }
            }, 50);
        }
        this.cdr.detectChanges();
    }
}