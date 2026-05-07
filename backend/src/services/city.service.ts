import { CityInterface } from "../interfaces/city.interface";
import { v4 as uuidv4 } from 'uuid';
import { getRandomInt } from "../utils/utils";

import * as CategoryService from './category.service';
import * as StreetService from './street.service';
import { InternalServerError } from '../utils/errors';
import { HouseInterface } from "../interfaces/house.interface";

/**
 * @param {Record<number, number>} categories - count of houses by category
 **/
export const createRandomCity = async function (
    categories?: Record<number, number>
): Promise<CityInterface> {
    const categories_count = CategoryService.categoriesCount();

    if (categories === undefined) {
        const count = getRandomInt(2, 6);

        categories = {};
        for (let _ = 0; _ < count; _++) {
            let category = getRandomInt(0, categories_count);
            while (categories[category] !== undefined)
                category = getRandomInt(0, categories_count);

            categories[category] = getRandomInt(1, 3);
        }
    }

    return generateCityByCategories(categories);
}

/**
 * @param {Record<number, number>} categories - count of houses by category
 **/
const generateCityByCategories = async function (
    categories: Record<number, number>
): Promise<CityInterface> {
    let city: CityInterface = {
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

export const getDistance = function (
    city: CityInterface,
    fromId: string,
    toId: string
): number {
    if (fromId === toId) return 0;

    const dist = new Map<string, number>();
    const visited = new Set<string>();

    dist.set(fromId, 0);

    while (true) {
        // находим непосещённую вершину с минимальным расстоянием
        let curId: string | null = null;
        let curDist = Infinity;

        for (const [id, d] of dist) {
            if (!visited.has(id) && d < curDist) {
                curDist = d;
                curId = id;
            }
        }

        if (curId === null) return -1;
        if (curId === toId) return curDist;

        visited.add(curId);

        const house = city.houseIndex.get(curId);
        if (!house) continue;

        for (const edge of house.edges) {
            if (visited.has(edge.to)) continue;
            const newDist = curDist + edge.length;
            if (newDist < (dist.get(edge.to) ?? Infinity)) {
                dist.set(edge.to, newDist);
            }
        }
    }
};