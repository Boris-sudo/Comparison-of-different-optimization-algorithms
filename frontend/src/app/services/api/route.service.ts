import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api';
import { PathPostInterface, PathResponseInterface } from '../../../generated';

@Injectable({ providedIn: 'root' })
export class RouteService {
    constructor(
        private apiService: ApiService
    ) {}

    async buildRoute(dto: PathPostInterface): Promise<PathResponseInterface> {
        return firstValueFrom(this.apiService.api.createPath(dto));
    }
}