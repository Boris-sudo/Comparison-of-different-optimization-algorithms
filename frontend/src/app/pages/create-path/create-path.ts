import { Component, effect } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { GraphStateService } from "../../services/graph/graph-state.service";
import { GraphRenderService } from "../../services/graph/graph-render.service";
import { GraphEditService } from "../../services/graph/graph-edit.service";
import { GraphRouteService } from "../../services/graph/graph-route.service";
import { Router } from "@angular/router";

@Component({
  selector: 'app-create-path',
    imports: [
        ReactiveFormsModule,
        FormsModule
    ],
  templateUrl: './create-path.html',
  styleUrl: './create-path.css',
})
export class CreatePath {
    constructor(
        public state: GraphStateService,
        public render: GraphRenderService,
        public edit: GraphEditService,
        public router: Router,
        public route: GraphRouteService,
    ) {
        effect(() => {
            const stateTab = this.state.activeTab();
            if (stateTab === 'editor') {
                this.router.navigate(['editor']).then();
            }
        });
    }

    buildRoute() {
        this.route.buildRoute().then();
    }
}
