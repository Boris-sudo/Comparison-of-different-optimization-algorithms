import { APP_INITIALIZER, ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { ProfileApiService } from "./services/api/profile.api";

export function initAuth(userService: ProfileApiService) {
    userService.getProfile();
    return () => null;
}

export const appConfig: ApplicationConfig = {
    providers: [
        provideBrowserGlobalErrorListeners(),
        provideRouter(routes),
        provideHttpClient(),
        {
            provide: APP_INITIALIZER,
            useFactory: initAuth,
            deps: [ProfileApiService],
            multi: true,
        },
    ]
};
