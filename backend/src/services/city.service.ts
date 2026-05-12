import { CityInterface, MappedCityInterface } from "../interfaces/city.interface";
import { v4 as uuidv4 } from 'uuid';
import { getRandomInt } from "../utils/utils";

import * as CategoryService from './category.service';
import * as StreetService from './street.service';
import { InternalServerError } from '../utils/errors';
import { HouseInterface } from "../interfaces/house.interface";
import { StreetInterface } from "../interfaces/street.interface";

/** Adds `Map` for edges and vertical of the graph **/
export const mapCity = async function (
    city: CityInterface,
): Promise<MappedCityInterface> {
    let res: MappedCityInterface = {
        id: city.id,
        houses: city.houses,
        houseIndex: new Map<string, HouseInterface>(),
        streetIndex: new Map<string, StreetInterface>(),
    }

    for (const house of res.houses) {
        res.houseIndex.set(house.id, house);
        for (const edge of house.edges) {
            res.streetIndex.set(edge.id, edge);
        }
    }

    return res;
}

/** Creates random city, may use count of the verticals **/
export const createRandomCity = async function (
    count?: number
): Promise<MappedCityInterface> {
    const categories_count = CategoryService.categoriesCount();
    let categories: Record<number, number> = {};
    for (let i = 0; i < categories_count; i++)
        categories[i] = 0;

    if (count === undefined) {
        for (let index = 0; index < categories_count; index++)
            categories[index] = (index == 0 ? 1 : getRandomInt(1, 3));
    } else {
        while (count > 0)
            for (let index = 0; index < categories_count; index++) {
                const cnt = Math.min(count, (index == 0 ? 1 : getRandomInt(1, 3)));
                if (index == 0 && categories[index] == 1) continue;
                categories[index] += cnt;
                count -= cnt;
                if (count === 0) break;
            }
    }

    return generateCityByCategories(categories);
}

/** Creates random city by `Record` of the category -> count **/
const generateCityByCategories = async function (
    categories: Record<number, number>
): Promise<MappedCityInterface> {
    let city: MappedCityInterface = {
        id: uuidv4(),
        houses: [],
        houseIndex: new Map(),
        streetIndex: new Map(),
    }

    // TODO city generator
    for (const category of Object.keys(categories)) {
        const catNum = parseInt(category);
        if (isNaN(catNum)) {
            throw new InternalServerError('wrong categories array type');
        }

        for (let i = 0; i < categories[catNum]; i++) {
            let house_id = uuidv4();
            let house: HouseInterface = {
                id: house_id,
                category: catNum,
                edges: [],
                time: 0,
                price: 0,
                weather: false,

            }
            city.houses.push(house);
            // todo make random choice of house properties according to categories possibilities
        }
    }

    for (const house of city.houses) {
        city.houseIndex.set(house.id, house);
    }

    StreetService.createRandomEdges(city.houses, city.streetIndex);

    return city;
}