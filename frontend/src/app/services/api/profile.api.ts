import { computed, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { JwtService } from './jwt';
import { UserResponse } from "../../../generated";
import { ApiService } from "./api";

@Injectable({
    providedIn: 'root'
})
export class ProfileApiService {
    public currentUser = signal<UserResponse | null>(null);
    public isAuthenticated = computed(() => this.currentUser() !== null);
    public notAuthenticated = computed(() => this.currentUser() === null);

    constructor(
        private readonly jwtService: JwtService,
        private readonly apiService: ApiService,
    ) {}

    async register(): Promise<void> {
        const tokenJson = await firstValueFrom(this.apiService.api.register());
        const token = tokenJson.token.replace('Bearer: ', '');
        this.jwtService.saveToken(token);
        await this.getProfile();
    }

    async getProfile(): Promise<UserResponse | null> {
        try {
            if (!this.jwtService.getToken()) {
                this.purgeAuth();
                return null;
            }
            if (!this.jwtService.checkTokenSetUp()) this.jwtService.setTokenToApi();
            const resp = await firstValueFrom(this.apiService.api.profile());
            this.currentUser.set(resp);
            return resp;
        } catch {
            this.purgeAuth();
            return null;
        }
    }

    purgeAuth() {
        // this.jwtService.destroyToken();
        this.currentUser.set(null);
    }
}
