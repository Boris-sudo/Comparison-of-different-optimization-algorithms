import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Configuration, DefaultService } from "../../generated";
import { environment } from "../../environments/environment";

@Injectable({
    providedIn: 'root'
})
export class ApiService {
    public api: DefaultService;

    constructor(private httpClient: HttpClient) {
        this.api = new DefaultService(
            httpClient,
            environment.apiBaseUrl,
            new Configuration(),
        );
    }
}
