import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api';
import {
    ComparePathPostInterface,
    PairPathStatisticsInterface,
    PathPostInterface,
    PathResponseInterface
} from '../../../generated';

@Injectable({ providedIn: 'root' })
export class RouteService {
    constructor(
        private apiService: ApiService
    ) {}

    async buildRoute(dto: PathPostInterface): Promise<PathResponseInterface> {
        return firstValueFrom(this.apiService.api.createPath(dto));
    }

    async compareRoutes(dto: ComparePathPostInterface): Promise<PairPathStatisticsInterface> {
        return firstValueFrom(this.apiService.api.comparePath(dto));
    }
}