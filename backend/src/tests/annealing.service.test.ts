import { AnnealingService } from '../services/algorithms/annealing.service';
import { CityInterface } from '../interfaces/city.interface';
import { HouseInterface } from '../interfaces/house.interface';
import { StreetInterface } from '../interfaces/street.interface';
import { PromptElement } from '../interfaces/path.interface';

const buildCity = (size: number): CityInterface => {
    const houses: HouseInterface[] = [];
    const houseIndex = new Map<string, HouseInterface>();
    const streetIndex = new Map<string, StreetInterface>();

    for (let i = 0; i < size; i++) {
        const house: HouseInterface = {
            id: `h${i}`,
            edges: [],
            category: i % 3,
            time: 10,
            price: 10,
            weather: false,
        };
        houses.push(house);
        houseIndex.set(house.id, house);
    }

    // связываем каждый дом с соседними
    for (let i = 0; i < size; i++) {
        for (let j = i + 1; j < size; j++) {
            const street: StreetInterface = {
                id: `h${i}:h${j}`,
                from: `h${i}`,
                to: `h${j}`,
                length: Math.abs(i - j) * 10,
            };
            const reverse: StreetInterface = {
                id: `h${j}:h${i}`,
                from: `h${j}`,
                to: `h${i}`,
                length: street.length,
            };
            houses[i].edges.push(street);
            houses[j].edges.push(reverse);
            streetIndex.set(street.id, street);
            streetIndex.set(reverse.id, reverse);
        }
    }

    return { id: 'test-city', houses, houseIndex, streetIndex };
};

describe('AnnealingService', () => {
    test('generate returns correct number of locations', async () => {
        const city = buildCity(10);
        const keys: PromptElement[] = [
            { type: 'category', categories: { '0': 100 } },
            { type: 'category', categories: { '1': 100 } },
        ];
        const service = new AnnealingService(city, keys, city.houses[0]);
        const result = await service.generate();

        expect(result).toHaveLength(keys.length);
    });

    test('generate returns valid house ids', async () => {
        const city = buildCity(10);
        const keys: PromptElement[] = [
            { type: 'category', categories: { '0': 100 } },
        ];
        const service = new AnnealingService(city, keys, city.houses[0]);
        const result = await service.generate();

        for (const item of result)
            expect(city.houseIndex.has(item.location.id)).toBe(true);
    });

    test('fixed point is preserved in result', async () => {
        const city = buildCity(10);
        const fixedHouse = city.houses[5];
        const keys: PromptElement[] = [
            { type: 'fixed', id: fixedHouse.id },
            { type: 'category', categories: { '1': 100 } },
        ];
        const service = new AnnealingService(city, keys, city.houses[0]);
        const result = await service.generate();

        expect(result[0].location.id).toBe(fixedHouse.id);
    });

    test('throws when fixed point id does not exist', async () => {
        const city = buildCity(5);
        const keys: PromptElement[] = [
            { type: 'fixed', id: 'nonexistent-id' },
        ];
        const service = new AnnealingService(city, keys, city.houses[0]);

        await expect(service.generate()).rejects.toThrow();
    });

    test('throws when no houses match category', async () => {
        const city = buildCity(5);
        const keys: PromptElement[] = [
            { type: 'category', categories: { '99': 100 } }, // несуществующая категория
        ];
        const service = new AnnealingService(city, keys, city.houses[0]);

        await expect(service.generate()).rejects.toThrow();
    });

    test('calculatePreSimilarity returns higher score for matching category', async () => {
        const city = buildCity(10);
        const keys: PromptElement[] = [
            { type: 'category', categories: { '0': 100 } },
        ];
        const service = new AnnealingService(city, keys, city.houses[0]);
        service.items = [[]];

        const matchingHouse = city.houses.find(h => h.category === 0)!;
        const nonMatchingHouse = city.houses.find(h => h.category === 1)!;

        const [simMatch] = await service.calculatePreSimilarity(matchingHouse, 0);
        const [simNon]   = await service.calculatePreSimilarity(nonMatchingHouse, 0);

        expect(simMatch).toBeGreaterThan(simNon);
    });
});