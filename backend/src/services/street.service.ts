import { CityInterface } from "../interfaces/city.interface";
import { StreetChangeInterface, StreetInterface } from "../interfaces/street.interface";
import { HouseInterface } from "../interfaces/house.interface";
import { InternalServerError } from "../utils/errors";
import { getRandomInt, randomChoice } from "../utils/utils";

const parseStreetId = (id: string): { from: string; to: string } => {
    const [from, to] = id.split(':');
    if (!from || !to) throw new InternalServerError(`Invalid street id format: ${ id }`);
    return { from, to };
};

export const changeStreet = async function (
    city: CityInterface,
    street: StreetChangeInterface
): Promise<void> {
    switch (street.action) {
        case "change": {
            const existing = city.streetIndex.get(street.id);
            const rev = city.streetIndex.get(street.id.split(":").reverse().join(":"));
            if (!existing || !rev)
                throw new InternalServerError(`Street ${ street.id } not found`);

            existing.length = street.length;
            rev.length = street.length;
            break;
        }

        case "add": {
            if (city.streetIndex.has(street.id))
                throw new InternalServerError(`Street ${ street.id } already exists`);

            const { from, to } = parseStreetId(street.id);
            const fromHouse = city.houseIndex.get(from);
            const toHouse = city.houseIndex.get(to);
            if (!fromHouse) throw new InternalServerError(`House ${ from } not found`);
            if (!toHouse) throw new InternalServerError(`House ${ to } not found`);

            const forwardStreet: StreetInterface = {
                id: street.id,
                from,
                to,
                length: street.length,
            };
            const reverseStreet: StreetInterface = {
                id: `${ to }:${ from }`,
                from: to,
                to: from,
                length: street.length,
            };

            fromHouse.edges.push(forwardStreet);
            toHouse.edges.push(reverseStreet);
            city.streetIndex.set(forwardStreet.id, forwardStreet);
            city.streetIndex.set(reverseStreet.id, reverseStreet);
            break;
        }

        case "delete": {
            const existing = city.streetIndex.get(street.id);
            if (!existing) throw new InternalServerError(`Street ${ street.id } not found`);

            const reverseId = `${ existing.to }:${ existing.from }`;
            const reverse = city.streetIndex.get(reverseId);
            if (!reverse) throw new InternalServerError(`Street with ${ street.id } not found`);

            const fromHouse = city.houseIndex.get(existing.from);
            const toHouse = city.houseIndex.get(existing.to);
            if (!fromHouse) throw new InternalServerError(`House ${ existing.from } not found`);
            if (!toHouse) throw new InternalServerError(`House ${ existing.to } not found`);

            removeFromEdges(toHouse.edges, reverse);
            city.streetIndex.delete(reverseId);
            removeFromEdges(fromHouse.edges, existing);
            city.streetIndex.delete(street.id);
            break;
        }

        default:
            throw new InternalServerError('wrong action');
    }
};

const removeFromEdges = (
    edges: Array<StreetInterface>,
    target: StreetInterface
): void => {
    const idx = edges.indexOf(target);
    if (idx === -1) return;
    edges[idx] = edges[edges.length - 1];
    edges.pop();
};

/**
 * @param {Array<HouseInterface>} houses
 * @param {Map<string, StreetInterface>} streetIndex
 * @param {number} depth - насколько плотный должен быть город
 **/
export const createRandomEdges = function (
    houses: Array<HouseInterface>,
    streetIndex: Map<string, StreetInterface>,
    depth?: number
) {
    for (const house of houses) {
        const count = getRandomInt(2, 4);
        const usedHouseIds = new Set<string>([house.id]);

        for (let _ = 0; _ < count; _++) {
            let newHouse: HouseInterface = randomChoice(houses);
            while (usedHouseIds.has(newHouse.id))
                newHouse = randomChoice(houses);

            const forwardId = `${ house.id }:${ newHouse.id }`;
            const reverseId = `${ newHouse.id }:${ house.id }`;

            if (streetIndex.has(forwardId) || streetIndex.has(reverseId)) {
                usedHouseIds.add(newHouse.id);
                continue;
            }

            const forwardStreet: StreetInterface = {
                id: forwardId,
                from: house.id,
                to: newHouse.id,
                length: getRandomInt(30, 60),
            };
            const reverseStreet: StreetInterface = {
                id: reverseId,
                from: newHouse.id,
                to: house.id,
                length: forwardStreet.length,
            };

            house.edges.push(forwardStreet);
            newHouse.edges.push(reverseStreet);
            streetIndex.set(forwardId, forwardStreet);
            streetIndex.set(reverseId, reverseStreet);

            usedHouseIds.add(newHouse.id);
        }
    }
};