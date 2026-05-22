import { Injectable } from "@angular/core";
import { ApiService } from "./api";

@Injectable({ providedIn: "root" })
export class JwtService {
    private readonly key: string = 'jwtToken';

    constructor(
        private apiService: ApiService
    ) {}

    getToken(): string | null {
        return localStorage.getItem(this.key);
    }

    setTokenToApi(): void {
        const token = this.getToken();
        if (token === null) {
            this.destroyCredentials();
            return;
        }
        this.apiService.api.configuration.credentials = { auth: token };
    }

    saveToken(token: string): void {
        localStorage.setItem(this.key, token);
        this.setTokenToApi();
    }

    checkTokenSetUp(): boolean {
        const credentials = this.apiService.api.configuration.credentials;
        const credentialsStr = JSON.stringify(credentials);
        return credentialsStr !== '{}';
    }

    destroyCredentials() {
        this.apiService.api.configuration.credentials = {};
    }

    destroyToken(): void {
        this.destroyCredentials();
        localStorage.removeItem(this.key);
    }
}
