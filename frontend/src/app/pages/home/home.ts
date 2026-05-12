import {
    Component, OnInit, ViewChild, ElementRef,
    AfterViewInit, OnDestroy, NgZone,
    ChangeDetectorRef, ChangeDetectionStrategy, effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProfileApiService } from '../../services/api/profile.api';
import { GraphStateService } from '../../services/graph/graph-state.service';
import { GraphRenderService } from '../../services/graph/graph-render.service';
import { GraphEditService } from '../../services/graph/graph-edit.service';
import { RouteService } from "../../services/api/route.service";
import { D3Node, D3Link } from '../../services/graph/graph-state.service';
import * as d3 from 'd3';

@Component({
    selector: 'app-home',
    imports: [FormsModule],
    templateUrl: './home.html',
    styleUrl: './home.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('graphSvg') graphSvg!: ElementRef<SVGSVGElement>;

    constructor(
        public profileApi: ProfileApiService,
        public state: GraphStateService,
        public render: GraphRenderService,
        public edit: GraphEditService,
        public routeService: RouteService,
        private ngZone: NgZone,
        private cdr: ChangeDetectorRef,
    ) {
        effect(() => {
            const isAuth = this.profileApi.isAuthenticated();
            if (isAuth) {
                this.state.isLoading.set(false);
                setTimeout(() => {
                    this.cdr.detectChanges();
                    this.loadGraph();
                    setTimeout(() => this.initGraph(), 150);
                }, 500);
            }
        });
    }

    async ngOnInit() {}

    ngAfterViewInit() {}

    ngOnDestroy() {
        this.render.destroy();
    }

    // ─── Graph init ───────────────────────────────────────────────────────────

    private initGraph() {
        if (!this.graphSvg?.nativeElement) return;

        this.ngZone.runOutsideAngular(() => {
            this.render.init(this.graphSvg.nativeElement);

            // Коллбэки от D3 событий → Angular
            this.render.onNodeClick = (d: D3Node) => {
                if (this.state.editMode() === 'add-edge') {
                    this.edit.handleEdgeClick(d).then(() => this.cdr.detectChanges());
                } else {
                    this.state.selectedHouse.set(d.house);
                    this.state.selectedStreet.set(null);
                    this.cdr.detectChanges();
                    this.render.updateNodeStyles();
                    this.render.updateLinkStyles();
                }
            };

            this.render.onLinkClick = (d: D3Link) => {
                const street = this.state.streets.find(s => s.id === d.id) ?? null;
                this.state.selectedStreet.set(street);
                this.state.editingStreetLength.set(street?.length ?? 0);
                this.state.selectedHouse.set(null);
                this.cdr.detectChanges();
                this.render.updateNodeStyles();
                this.render.updateLinkStyles();
            };

            this.render.onCanvasClick = (x: number, y: number) => {
                if (x === -1) {
                    // Клик по фону — снимаем выделение
                    this.state.selectedHouse.set(null);
                    this.state.selectedStreet.set(null);
                    this.state.edgeSourceNode.set(null);
                    this.cdr.detectChanges();
                    this.render.updateNodeStyles();
                    this.render.updateLinkStyles();
                } else {
                    this.edit.addNode(x, y).then(() => this.cdr.detectChanges());
                }
            };

            if (this.state.houses.length === 0) this.loadGraph();

            if (this.state.houses.length > 0) {
                this.state.buildD3Data();
                this.render.buildSimulation();
                this.render.renderGraph();
                this.state.graphInitialized = true;
            }
        });
    }

    loadGraph() {
        const user = this.profileApi.currentUser();
        if (!user?.city?.houses) return;

        if (!this.state.graphInitialized) {
            this.state.houses = [...user.city.houses];
            this.state.buildStreetList();
            this.cdr.detectChanges();
        }
    }

    // ─── Tab ──────────────────────────────────────────────────────────────────

    onTabChange(tab: 'editor' | 'route') {
        this.state.activeTab.set(tab);
        this.cdr.detectChanges();
        if (tab === 'editor') {
            setTimeout(() => {
                const el = this.graphSvg?.nativeElement;
                if (el) {
                    this.render.width = el.clientWidth || 900;
                    this.render.height = el.clientHeight || 600;
                    this.render.simulation?.force('center',
                        d3.forceCenter(this.render.width / 2, this.render.height / 2)
                    );
                    this.render.simulation?.alpha(0.1).restart();
                    this.initGraph();
                }
            }, 50);
        }
    }

    // ─── Edit mode ────────────────────────────────────────────────────────────

    setEditMode(mode: 'select' | 'add-node' | 'add-edge') {
        this.state.editMode.set(mode);
        this.state.edgeSourceNode.set(null);
        this.state.selectedHouse.set(null);
        this.cdr.detectChanges();
        this.render.updateNodeStyles();
        this.render.updateLinkStyles();
    }

    // ─── Route ────────────────────────────────────────────────────────────────

    async buildRoute() {
        if (!this.state.routePrompt().trim() || !this.state.houses.length) return;
        this.state.isBuildingRoute.set(true);
        this.state.error.set(null);
        this.state.clearRoute();
        this.cdr.detectChanges();

        try {
            const result = await this.routeService.buildRoute({
                model: this.state.selectedAlgorithm(),
                prompt: this.state.routePrompt(),
                startPoint: this.state.houses.filter(house => house.category === 0)[0].id,
            });
            this.state.setRoute(result);
            this.state.activeTab.set('editor');
            this.cdr.detectChanges();
            setTimeout(() => {
                this.initGraph();
                this.render.updateNodeStyles();
                this.render.updateLinkStyles();
            }, 50);
        } catch (e: any) {
            this.state.error.set(e?.message ?? 'Ошибка при построении маршрута');
        } finally {
            this.state.isBuildingRoute.set(false);
            this.cdr.detectChanges();
        }
    }

    clearRoute() {
        this.state.clearRoute();
        this.render.updateNodeStyles();
        this.render.updateLinkStyles();
        this.cdr.detectChanges();
    }

    async generateCity() {
        await this.edit.generateCity(this.state.newCityNodeCount());
        this.cdr.detectChanges();
        setTimeout(() => {
            this.initGraph();
        }, 50);
    }

    async saveStreetLength() {
        await this.edit.saveStreetLength();
        this.cdr.detectChanges();
    }

    async deleteStreet() {
        await this.edit.deleteStreet();
        this.cdr.detectChanges();
    }

    async changeHouseCategory(categoryId: number) {
        await this.edit.changeHouseCategory(categoryId);
        this.cdr.detectChanges();
        this.render.updateNodeStyles();
    }

    async deleteHouse() {
        await this.edit.deleteHouse();
        this.cdr.detectChanges();
        this.render.updateNodeStyles();
        this.render.updateLinkStyles();
    }

    // ─── Register ────────────────────────────────────────────────────────────────

    register() {
        this.profileApi.register();
    }
}