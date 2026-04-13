import { StreetInterface } from "./street.interface";

export interface HouseInterface {
    id: string;
    edges: Array<StreetInterface>;
    category: string;
    time: number;
    price: number;
    weather: boolean;
}