import { computed, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { JwtService } from '../jwt';
import { ApiService } from "../api";
import { UserResponse } from "../../../generated";

@Injectable({
    providedIn: 'root'
})
export class ProfileApiService {
    public currentUser = signal<UserResponse | null>(null);

    public isAuthenticated = computed(() => this.currentUser() !== null);
    public notAuthenticated = computed(() => this.currentUser() === null);

    constructor(
        private readonly jwtService: JwtService,
        private api: ApiService,
    ) {
    }

    async register(): Promise<UserResponse | null> {
        try {
            const token = await firstValueFrom(this.api.apiService.register());
            await this.setAuth(token);
            return await this.getProfile();
        } catch (registerError: any) {
            throw registerError.error.detail;
        }
    }

    async getProfile(): Promise<UserResponse> {
        try {
            if (!this.jwtService.checkTokenSetUp()) this.jwtService.setTokenToApi();
            const resp = await firstValueFrom(this.api.apiService.profile());
            this.setAuthUser(resp);
            return resp;
        } catch (profileError: any) {
            this.purgeAuth();
            return profileError.error.detail;
        }
    }

    setAuthUser(user: UserResponse) {
        this.currentUser.set(user);
    }

    setAuth(token: string) {
        this.jwtService.saveToken(token);
    }

    purgeAuth() {
        this.jwtService.destroyToken();
    }
}