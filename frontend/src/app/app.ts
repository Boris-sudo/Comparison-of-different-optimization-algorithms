import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { ProfileApiService } from "./services/api/profile.api";

@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    template: `
        <div class="app-container">
            <router-outlet></router-outlet>
        </div>
    `,
    styles: []
})
export class App {
}
