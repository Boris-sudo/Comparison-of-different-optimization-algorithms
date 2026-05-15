import { v4 as uuidv4 } from 'uuid';
import { getRandomInt } from "../utils/utils";

import { CityInterface, MappedCityInterface, RedisCityInterface } from "../interfaces/city.interface";
import { InternalServerError } from '../utils/errors';
import { HouseInterface } from "../interfaces/house.interface";
import { StreetInterface } from "../interfaces/street.interface";

import * as CategoryService from './category.service';
import * as StreetService from './street.service';
import { DynamicAPSP } from "./path-build.service";

export const createCityInterface = function (
    apsp: DynamicAPSP,
): CityInterface {
    return { id: apsp.city.id, houses: apsp.city.houses };
}

export const createRedisInterface = function (
    apsp: DynamicAPSP,
): RedisCityInterface {
    let result: RedisCityInterface = {
        id: apsp.city.id,
        houses: apsp.city.houses,
        distances: []
    }

    for (const [from_id, distances] of apsp.dist)
        for (const [to_id, distance] of distances)
            result.distances.push([from_id, to_id, distance.toString()]);

    return result;
}

/** Adds `Map` for edges and vertical of the graph **/
export const mapCity = async function (
    city: RedisCityInterface,
): Promise<DynamicAPSP> {
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

    return new DynamicAPSP(res, city.distances);
}

/** Creates random city, may use count of the verticals **/
export const createRandomCity = async function (
    count?: number
): Promise<DynamicAPSP> {
    const categories_count = CategoryService.categoriesCount();
    let categories: Record<number, number> = {};
    for (let i = 0; i < categories_count; i++)
        categories[i] = 0;

    if (count === undefined) {
        for (let index = 0; index < categories_count; index++)
            categories[index] = (index == 0 ? 1 : getRandomInt(1, 3));
    }
    else {
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
): Promise<DynamicAPSP> {
    let city: MappedCityInterface = {
        id: uuidv4(),
        houses: [],
        houseIndex: new Map(),
        streetIndex: new Map(),
    }

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

    for (let i = 0; i < city.houses.length; i++) {
        city.houseIndex.set(city.houses[i].id, city.houses[i]);
    }

    StreetService.createRandomEdges(city.houses, city.streetIndex);

    return new DynamicAPSP(city);
}