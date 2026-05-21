import { Component, effect, signal, WritableSignal } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { GraphStateService } from "../../services/graph/graph-state.service";
import { GraphRenderService } from "../../services/graph/graph-render.service";
import { GraphEditService } from "../../services/graph/graph-edit.service";
import { Router } from "@angular/router";
import { GraphRouteService } from "../../services/graph/graph-route.service";
import { ModelType, PairPathStatisticsInterface, PathAnalyzeDuration } from "../../../generated";

@Component({
    selector: 'app-compare',
    imports: [
        ReactiveFormsModule,
        FormsModule
    ],
    templateUrl: './compare.html',
    styleUrl: './compare.css',
})
export class Compare {
    isBuilding = signal<boolean>(false);

    constructor(
        public state: GraphStateService,
        public render: GraphRenderService,
        public edit: GraphEditService,
        public router: Router,
        public route: GraphRouteService,
    ) {}

    buildRoute() {
        this.isBuilding.set(true);
        this.route.compareRoutes({ first: this.state.algorithms.first(), second: this.state.algorithms.second() })
            .finally(() => {
                this.isBuilding.set(false);
            })
    }

    isBetter(metric: 'length' | 'algo', side: 'first' | 'second'): boolean {
        const s = this.state.pairRoutes();
        if (!s?.first || !s?.second) return false;

        const a = metric === 'length'
            ? s.first.length
            : s.first.duration?.algo ?? Infinity;

        const b = metric === 'length'
            ? s.second.length
            : s.second.duration?.algo ?? Infinity;

        if (a === b) return false;

        return side === 'first' ? a < b : b < a;
    }
}
