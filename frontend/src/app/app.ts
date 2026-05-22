import { ChangeDetectorRef, Component, effect } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { ProfileApiService } from "./services/api/profile.api";
import { GraphEditService } from "./services/graph/graph-edit.service";
import { GraphRenderService } from "./services/graph/graph-render.service";
import { GraphStateService } from "./services/graph/graph-state.service";

@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    templateUrl: './app.html',
    styleUrls: ['./app.css']
})
export class App {
    public houses_count: number = 0;
    public links_count: number = 0;
    public route_length: number = 0;

    constructor(
        public profileApi: ProfileApiService,
        public state: GraphStateService,
        public render: GraphRenderService,
        public edit: GraphEditService,
        private cdr: ChangeDetectorRef,
        private router: Router,
    ) {
        effect(() => {
            const isAuth = this.profileApi.isAuthenticated();
            if (isAuth) {
                this.state.isLoading.set(false);
            }
        });
        effect(() => {
            const user = this.profileApi.currentUser();
            if (!user) return;
            this.houses_count = user.city.houses.length;
            this.links_count = 0;
            for (const house of user.city.houses)
                this.links_count += house.edges.length;
        });
        effect(() => {
            const length = this.state.routeLength();
            console.log(length);
            this.route_length = length;
        });
    }

    navigate(tab: 'editor' | 'route' | 'compare') {
        this.state.activeTab.set(tab);
        this.cdr.detectChanges();
        this.router.navigate([tab]).then();
    }

    // ─── Register ────────────────────────────────────────────────────────────────

    register() {
        this.profileApi.register().then();
    }

    protected readonly Math = Math;
}
