import { HouseChangeInterface, HouseInterface } from "../interfaces/house.interface";
import { MappedCityInterface } from "../interfaces/city.interface";
import { InternalServerError } from "../utils/errors";
import { DynamicAPSP } from "./path-build.service";

/** Changes house to a new model in city **/
export const changeHouse = async function (
    apsp: DynamicAPSP,
    house: HouseChangeInterface
) {
    const city = apsp.city;

    switch (house.action) {

        case "change": {
            const existing = city.houseIndex.get(house.id);
            if (!existing) throw new InternalServerError(`House ${ house.id } not found`);

            existing.category = house.category;
            existing.time = house.time;
            existing.price = house.price;
            existing.weather = house.weather;

            break;
        }

        case "add": {
            if (city.houseIndex.has(house.id))
                throw new InternalServerError(`House ${ house.id } already exists`);

            const newHouse: HouseInterface = {
                id: house.id,
                category: house.category,
                time: house.time,
                price: house.price,
                weather: house.weather,
                edges: [],
            };

            city.houses.push(newHouse);
            city.houseIndex.set(house.id, newHouse);

            apsp.onNodeAdded(newHouse.id);

            break;
        }

        case "delete": {
            const existing = city.houseIndex.get(house.id);
            if (!existing) throw new InternalServerError(`House ${ house.id } not found`);

            apsp.onNodeRemoved(existing.id);

            const idx = city.houses.indexOf(existing);
            const last = city.houses[city.houses.length - 1];
            city.houses[idx] = last;
            city.houses.pop();

            city.houseIndex.delete(house.id);

            break;
        }

        default:
            throw new InternalServerError('wrong action');
    }
}