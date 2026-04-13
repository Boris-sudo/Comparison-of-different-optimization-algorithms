import { Injectable } from "@angular/core";
import { ApiService } from "./api";

@Injectable({ providedIn: "root" })
export class JwtService {
    private readonly key: string = 'jwtToken';

    constructor(
        private api: ApiService,
    ) {
    }

    getToken(): string | null {
        return localStorage.getItem(this.key);
    }

    setTokenToApi(): void {
        const token = this.getToken();
        if (token === null) {
            this.destroyCredentials();
            return;
        }
        this.api.apiService.configuration.credentials = { HTTPBearer: token };
    }

    saveToken(token: string): void {
        localStorage.setItem(this.key, token);
        this.setTokenToApi();
    }

    checkTokenSetUp(): boolean {
        const credentials = this.api.apiService.configuration.credentials;
        const credentials_str = JSON.stringify(credentials);
        return credentials_str !== '{}';
    }

    destroyCredentials() {
        this.api.apiService.configuration.credentials = {};
    }

    destroyToken(): void {
        this.destroyCredentials();
        localStorage.removeItem(this.key);
    }
}