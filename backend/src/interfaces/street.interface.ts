import { ActionInterface } from "../utils/utils";

export interface StreetInterface {
    id: string;
    from: string; // id of the house from
    to: string; // id of the house to
    length: number;
}

export interface StreetChangeInterface {
    id: string; // id of the street to change
    length: number;
    action: ActionInterface;
}