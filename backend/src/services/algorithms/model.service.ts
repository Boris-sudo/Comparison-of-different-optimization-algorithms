import { PathResponseInterface, PromptElement } from "../../interfaces/path.interface";
import { MappedCityInterface } from "../../interfaces/city.interface";
import { HouseInterface } from "../../interfaces/house.interface";

export class ModelService {
    constructor(city: MappedCityInterface, keys: PromptElement[], startPosition: HouseInterface) {
    }

    async generate(): Promise<PathResponseInterface> {
        return { points: [] };
    }
}