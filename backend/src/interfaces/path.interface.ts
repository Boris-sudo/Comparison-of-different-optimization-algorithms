import { HouseInterface } from "./house.interface";

export type ModelType = 'Dfs' | 'Bfs' | 'Annealing' | 'ACO' | 'A*';

export interface PathPostInterface {
    model: ModelType;
    prompt: string;
    startPoint: HouseInterface;
}

export interface PathResponseInterface {
    points: Array<string>; // ids of the path objects
}

export interface LocationItem {
    location: HouseInterface;
    categoriesSum?: number;
}

export interface PromptElement {
    type: "fixed" | "category" | "route";
    raw_prompt?: string;
    id?: string;

    categories?: Record<string, number>; // percentage of each category

    generated_prompt?: string;
    parsed_elements?: PromptElement[];
}