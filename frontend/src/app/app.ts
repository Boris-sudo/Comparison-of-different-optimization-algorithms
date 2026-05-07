import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { ProfileApiService } from "./services/api/profile.api";

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, RouterLink],
    template: `
        <div class="app-container">
            <header class="header">
                <div class="header__logo">
                    <a routerLink="/">RouteOptimizer</a>
                </div>
                <div class="header__actions">
                    @if (profileApi.isAuthenticated()) {
                        <span class="badge badge--success">Город загружен</span>
                        <button class="btn btn--secondary" (click)="regenerateCity()">Новый город</button>
                    } @else {
                        <button class="btn btn--primary" (click)="register()">Регистрация</button>
                    }
                </div>
            </header>
            <router-outlet></router-outlet>
        </div>
    `,
    styles: []
})
export class App {
    protected profileApi = inject(ProfileApiService);
    private router = inject(Router);

    async register() {
        await this.profileApi.register();
        this.router.navigate(['/']);
    }

    async regenerateCity() {
        await this.profileApi.regenerateCity();
    }
}
