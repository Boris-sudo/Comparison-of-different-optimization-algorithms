import { ChangeDetectorRef, Injectable } from '@angular/core';
import { GraphStateService, D3Node, D3Link } from './graph-state.service';
import { GraphRenderService } from './graph-render.service';
import { GraphService } from "../api/graph.service";
import { ProfileApiService } from '../api/profile.api';
import { HouseChangeInterface, StreetChangeInterface, StreetInterface } from '../../../generated';
import { RouteService } from "../api/route.service";

@Injectable({ providedIn: 'root' })
export class GraphRouteService {

    constructor(
        public routeService: RouteService,
        private state: GraphStateService,
        private render: GraphRenderService,
    ) {}

    async buildRoute() {
        if (!this.state.routePrompt().trim() || !this.state.houses.length) return;
        this.state.isBuildingRoute.set(true);
        this.state.error.set(null);
        this.state.clearRoute();

        try {
            const result = await this.routeService.buildRoute({
                model: this.state.selectedAlgorithm(),
                prompt: this.state.routePrompt(),
                startPoint: this.state.houses.filter(house => house.category === 0)[0].id,
            });
            this.state.setRoute(result);
            this.state.activeTab.set('editor');
            setTimeout(() => {
                this.state.reloadGraph.set(true);
            }, 50);
        } catch (e: any) {
            this.state.error.set(e?.message ?? 'Ошибка при построении маршрута');
        } finally {
            this.state.isBuildingRoute.set(false);
        }
    }

    clearRoute() {
        this.state.clearRoute();
        this.render.updateNodeStyles();
        this.render.updateLinkStyles();
    }
}