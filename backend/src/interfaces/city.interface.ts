import { HouseInterface } from "./house.interface";
import { StreetInterface } from "./street.interface";

export interface CityInterface {
    id: string;
    houses: Array<HouseInterface>;
    houseIndex: Map<string, HouseInterface>;
    streetIndex: Map<string, StreetInterface>
}

export interface CityPostInterface {
    houses: Array<HouseInterface>;
}

export interface CityModelInterface {
    count: Record<number, number>;
}