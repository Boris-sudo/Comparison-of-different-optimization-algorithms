import { CityInterface } from "./city.interface";

export interface UserResponse {
    city: CityInterface;
}

export interface RegistrationResponse {
    token: string;
}