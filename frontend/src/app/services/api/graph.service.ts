import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
    UserResponse,
    HouseChangeInterface,
    StreetChangeInterface,
    PathPostInterface,
    PathResponseInterface,
    CityModelInterface,
} from "../../../generated";
import { ApiService } from "./api";

@Injectable({ providedIn: 'root' })
export class GraphService {
    constructor(
        private readonly apiService: ApiService
    ) {}

    async changeHouse(dto: HouseChangeInterface): Promise<UserResponse> {
        return firstValueFrom(this.apiService.api.changeHouse(dto));
    }

    async changeStreet(dto: StreetChangeInterface): Promise<UserResponse> {
        return firstValueFrom(this.apiService.api.changeStreet(dto));
    }

    async createPath(dto: PathPostInterface): Promise<PathResponseInterface> {
        return firstValueFrom(this.apiService.api.createPath(dto));
    }

    async generateRandomCity(): Promise<UserResponse> {
        return firstValueFrom(this.apiService.api.generateRandomCity());
    }

    async generateRandomCityByModel(dto: CityModelInterface): Promise<UserResponse> {
        return firstValueFrom(this.apiService.api.generateRandomCityByModel(dto));
    }
}
