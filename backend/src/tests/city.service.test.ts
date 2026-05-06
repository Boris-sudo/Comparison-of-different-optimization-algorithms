import { getDistance } from '../services/city.service';
import { CityInterface } from '../interfaces/city.interface';
import { HouseInterface } from '../interfaces/house.interface';
import { StreetInterface } from '../interfaces/street.interface';

const buildCity = (
    houses: { id: string }[],
    streets: { from: string; to: string; length: number }[]
): CityInterface => {
    const houseIndex = new Map<string, HouseInterface>();
    const streetIndex = new Map<string, StreetInterface>();

    const fullHouses: HouseInterface[] = houses.map(h => ({
        id: h.id,
        edges: [],
        category: 0,
        time: 0,
        price: 0,
        weather: false,
    }));

    for (const house of fullHouses)
        houseIndex.set(house.id, house);

    for (const s of streets) {
        const street: StreetInterface = { id: `${s.from}:${s.to}`, ...s };
        houseIndex.get(s.from)!.edges.push(street);
        streetIndex.set(street.id, street);
    }

    return { id: 'test-city', houses: fullHouses, houseIndex, streetIndex };
};

describe('dijkstra', () => {
    test('same node returns 0', () => {
        const city = buildCity([{ id: 'a' }], []);
        expect(getDistance(city, 'a', 'a')).toBe(0);
    });

    test('direct edge returns correct length', () => {
        const city = buildCity(
            [{ id: 'a' }, { id: 'b' }],
            [{ from: 'a', to: 'b', length: 42 }]
        );
        expect(getDistance(city, 'a', 'b')).toBe(42);
    });

    test('no path returns -1', () => {
        const city = buildCity(
            [{ id: 'a' }, { id: 'b' }],
            []
        );
        expect(getDistance(city, 'a', 'b')).toBe(-1);
    });

    test('picks shortest of two paths', () => {
        // a -10-> b -10-> c
        // a -100-> c
        const city = buildCity(
            [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
            [
                { from: 'a', to: 'b', length: 10 },
                { from: 'b', to: 'c', length: 10 },
                { from: 'a', to: 'c', length: 100 },
            ]
        );
        expect(getDistance(city, 'a', 'c')).toBe(20);
    });

    test('directed graph — reverse has no path', () => {
        const city = buildCity(
            [{ id: 'a' }, { id: 'b' }],
            [{ from: 'a', to: 'b', length: 5 }]
        );
        expect(getDistance(city, 'b', 'a')).toBe(-1);
    });

    test('multi-hop path', () => {
        // a -1-> b -2-> c -3-> d
        const city = buildCity(
            [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
            [
                { from: 'a', to: 'b', length: 1 },
                { from: 'b', to: 'c', length: 2 },
                { from: 'c', to: 'd', length: 3 },
            ]
        );
        expect(getDistance(city, 'a', 'd')).toBe(6);
    });

    test('unknown fromId returns -1', () => {
        const city = buildCity([{ id: 'a' }], []);
        expect(getDistance(city, 'unknown', 'a')).toBe(-1);
    });

    test('unknown toId returns -1', () => {
        const city = buildCity([{ id: 'a' }], []);
        expect(getDistance(city, 'a', 'unknown')).toBe(-1);
    });
});