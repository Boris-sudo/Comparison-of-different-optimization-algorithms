import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Configuration, DefaultService } from "../../generated";
import { environment } from "../../environments/environment";

@Injectable({
    providedIn: 'root'
})
export class ApiService {

    public apiService!: DefaultService;

    constructor(
        private httpClient: HttpClient,
    ) {
        this.apiService = new DefaultService(httpClient, environment.apiBaseUrl, new Configuration());
    }
}