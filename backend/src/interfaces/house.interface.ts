import { StreetInterface } from "./street.interface";
import { ActionInterface } from "../utils/utils";

export interface HouseInterface {
    id: string;
    edges: Array<StreetInterface>;
    category: number;
    time: number;
    price: number;
    weather: boolean;
    x?: number;
    y?: number;
}

export interface HouseChangeInterface {
    id: string;
    category: number;
    time: number;
    price: number;
    weather: boolean;
    action: ActionInterface;
}