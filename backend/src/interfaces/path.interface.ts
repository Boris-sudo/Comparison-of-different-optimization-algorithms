import { HouseInterface } from "./house.interface";
import { Pair } from "../utils/utils";

export type ModelType = 'Dfs' | 'Bfs' | 'Annealing' | 'ACO' | 'A*';

export interface PathCreateInterface {
    model: ModelType;
    prompt: string;
    startPoint: HouseInterface;
}

export interface ComparePathCreateInterface {
    models: Pair<ModelType>;
    prompt: string;
    startPoint: HouseInterface;
}


export interface PathPostInterface {
    model: ModelType;
    prompt: string;
    startPoint: string;
}

export interface ComparePathPostInterface {
    models: Pair<ModelType>;
    prompt: string;
    startPoint: string;
}

export interface PathStatisticsInterface {
    duration: PathAnalyzeDuration;
    length: number;
    main_points: string[];
    points_count: number,
}

export interface PathResultItem {
    id: string,
    role: 'main' | 'outer'
}

export interface PathAnalyzeDuration {
    algo: number;
    network: number;
}

export interface PathResponseInterface {
    points: Array<PathResultItem>; // ids of the path objects
    length: number;
    duration: PathAnalyzeDuration;
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