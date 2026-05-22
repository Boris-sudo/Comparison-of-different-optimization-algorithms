import {
    Component, ViewChild, ElementRef,
    AfterViewInit, OnDestroy, NgZone,
    ChangeDetectorRef, ChangeDetectionStrategy, effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GraphStateService } from '../../services/graph/graph-state.service';
import { GraphRenderService } from '../../services/graph/graph-render.service';
import { GraphEditService } from '../../services/graph/graph-edit.service';
import { D3Node, D3Link } from '../../services/graph/graph-state.service';
import * as d3 from 'd3';
import { GraphRouteService } from "../../services/graph/graph-route.service";

@Component({
    selector: 'app-home',
    imports: [FormsModule],
    templateUrl: './home.html',
    styleUrl: './home.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home implements AfterViewInit, OnDestroy {
    @ViewChild('graphSvg') graphSvg!: ElementRef<SVGSVGElement>;

    constructor(
        public route: GraphRouteService,
        public state: GraphStateService,
        public render: GraphRenderService,
        public edit: GraphEditService,
        private ngZone: NgZone,
        private cdr: ChangeDetectorRef,
    ) {
        effect(() => {
            const state = this.state.reloadGraph();
            if (state) {
                this.initGraph();
                this.render.updateNodeStyles();
                this.render.updateLinkStyles();
                this.state.reloadGraph.set(false);
            }
        });
    }

    ngAfterViewInit() {
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
                this.render.updateLinkStyles();
                this.render.updateNodeStyles();
            }
        }, 50);
    }

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

            if (this.state.houses.length === 0) {
                this.state.loadGraph();
                this.cdr.detectChanges();
            }

            if (this.state.houses.length > 0) {
                this.state.buildD3Data();
                this.render.buildSimulation();
                this.render.renderGraph();
                this.state.graphInitialized = true;
                this.state.reloadGraph.set(true);
            }
        });
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

    async generateCity() {
        this.route.clearRoute();
        await this.edit.generateCity(this.state.newCityNodeCount());
        this.cdr.detectChanges();
        setTimeout(() => {
            this.initGraph();
        }, 50);
    }

    async saveStreetLength() {
        this.route.clearRoute();
        await this.edit.saveStreetLength();
        this.cdr.detectChanges();
    }

    async deleteStreet() {
        this.route.clearRoute();
        await this.edit.deleteStreet();
        this.cdr.detectChanges();
    }

    async changeHouseCategory(categoryId: number) {
        this.route.clearRoute();
        await this.edit.changeHouseCategory(categoryId);
        this.cdr.detectChanges();
        this.render.updateNodeStyles();
    }

    async deleteHouse() {
        this.route.clearRoute();
        await this.edit.deleteHouse();
        this.cdr.detectChanges();
        this.render.updateNodeStyles();
        this.render.updateLinkStyles();
    }

    focusNode(nodeId: string) {
        const node = this.state.d3Nodes.find(n => n.id === nodeId);
        if (!node || node.x === undefined || node.y === undefined) return;
        this.render.focusOn(node.x, node.y);
    }

    // ─── Route Comparison ────────────────────────────────────────────────────────────────

    private getPointPresence(pointId: string): 'both' | 'first' | 'second' | 'none' {
        const inFirst = this.state.pairRoutes()?.first.main_points?.includes(pointId) ?? false;
        const inSecond = this.state.pairRoutes()?.second?.main_points?.includes(pointId) ?? false;
        if (inFirst && inSecond) return 'both';
        if (inFirst) return 'first';
        if (inSecond) return 'second';
        return 'none';
    }

    getPointColor(pointId: string, part: 'bg' | 'border' | 'text') {
        const presence = this.getPointPresence(pointId);
        return this.render.getPointColor(presence, part);
    }

    getPointIndex(pointId: string) {
        const firstId = this.state.pairRoutes()?.first.main_points.indexOf(pointId) ?? -1;
        if (firstId >= 0) return firstId;
        return this.state.pairRoutes()?.second.main_points.indexOf(pointId) ?? -1;
    }

    getPointAlgoLabel(pointId: string): string {
        const presence = this.getPointPresence(pointId);
        const labels = {
            both: '∩',
            first: 'A',
            second: 'B',
            none: '',
        };
        return labels[presence];
    }

    protected readonly Math = Math;
}