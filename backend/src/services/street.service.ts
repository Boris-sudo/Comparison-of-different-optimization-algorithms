import { MappedCityInterface } from "../interfaces/city.interface";
import { StreetChangeInterface, StreetInterface } from "../interfaces/street.interface";
import { HouseInterface } from "../interfaces/house.interface";
import { InternalServerError } from "../utils/errors";
import { getRandomInt, randomChoice, Queue, RandomQueue } from "../utils/utils";

/** Parses steer id to two house ids **/
const parseStreetId = (id: string): { from: string; to: string } => {
    const [from, to] = id.split(':');
    if (!from || !to) throw new InternalServerError(`Invalid street id format: ${ id }`);
    return { from, to };
};

/** Changes street in city **/
export const changeStreet = async function (
    city: MappedCityInterface,
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

            addEdge(fromHouse, toHouse, city.streetIndex);

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

/** Removes edge from Array **/
const removeFromEdges = (
    edges: Array<StreetInterface>,
    target: StreetInterface
): void => {
    const idx = edges.indexOf(target);
    if (idx === -1) return;
    edges[idx] = edges[edges.length - 1];
    edges.pop();
};

/** Adds two-sided edges between to and from houses **/
export const addEdge = (
    to: HouseInterface,
    from: HouseInterface,
    streetIndex: Map<string, StreetInterface>,
): void => {
    let forwardId = `${ to.id }:${ from.id }`;
    let reverseId = `${ from.id }:${ to.id }`;

    if (streetIndex.has(forwardId) || streetIndex.has(reverseId))
        return;

    const forwardStreet: StreetInterface = {
        id: forwardId,
        from: to.id,
        to: from.id,
        length: getRandomInt(30, 60),
    };
    const reverseStreet: StreetInterface = {
        id: reverseId,
        from: from.id,
        to: to.id,
        length: forwardStreet.length,
    };

    to.edges.push(forwardStreet);
    from.edges.push(reverseStreet);
    streetIndex.set(forwardId, forwardStreet);
    streetIndex.set(reverseId, reverseStreet);
}

/** Creates random edges in city that it will be one connected graph **/
export const createRandomEdges = function (
    houses: Array<HouseInterface>,
    streetIndex: Map<string, StreetInterface>,
    depth?: number
) {
    const edgesCount = new Map<string, number>();
    const randomQueue = new RandomQueue<HouseInterface>();
    const queue = new Queue<HouseInterface>();

    for (const house of houses) {
        randomQueue.add(house);
        edgesCount.set(house.id, getRandomInt(2, 5));
    }

    const start = randomQueue.get()!;
    queue.add(start);

    while (!queue.isEmpty()) {
        const house = queue.get();
        if (!house) throw new InternalServerError(`house is undefined`);
        const max_edges_count = edgesCount.get(house.id);
        if (max_edges_count === undefined) throw new InternalServerError('edges_count is undefined');
        const edges_count = Math.min(randomQueue.size(), getRandomInt(1, max_edges_count));

        edgesCount.set(house.id, max_edges_count - edges_count);

        for (let _ = 0; _ < edges_count; _++) {
            let new_house = randomQueue.get();
            if (!new_house) break;

            addEdge(house, new_house, streetIndex);
            edgesCount.set(new_house.id, edgesCount.get(new_house.id)! - 1);
            queue.add(new_house);
        }
    }

    for (const house of houses) {
        const edges_count = edgesCount.get(house.id);
        if (edges_count === undefined) throw new InternalServerError(`edges count is undefined`);
        for (let _ = 0; _ < edges_count; _++) {
            let new_house = randomChoice(houses);
            let counter = 0;
            while ((new_house.id === house.id || streetIndex.has(`${house.id}:${new_house.id}`)) && counter < 100)
                new_house = randomChoice(houses), counter++;

            if (counter !== 100)
                addEdge(house, new_house, streetIndex);
        }
    }
};