import { MappedCityInterface } from "../../interfaces/city.interface";
import { LocationItem, PromptElement } from "../../interfaces/path.interface";
import { HouseInterface } from "../../interfaces/house.interface";
import { getDistance } from "../city.service";
import { InternalServerError } from "../../utils/errors";
import { StreetInterface } from "../../interfaces/street.interface";
import { setRandomFallback } from "bcryptjs";
import { getCategory } from "../category.service";

export class DfsService {
    private city: MappedCityInterface;
    private keys: PromptElement[];
    private startPosition: HouseInterface;

    private items: LocationItem[][];
    private graph: MappedCityInterface;
    private result: LocationItem[];
    private durations: Map<string, number>;

    private readonly MAX_ITEMS_COUNT = 29;

    constructor(
        city: MappedCityInterface,
        keys: PromptElement[],
        startPosition: HouseInterface
    ) {
        this.city = city;
        this.keys = keys;
        this.startPosition = startPosition;
        this.items = [];
        this.graph = {
            id: '',
            houses: [],
            houseIndex: new Map<string, HouseInterface>(),
            streetIndex: new Map<string, StreetInterface>(),
        }
        this.result = [];
        this.durations = new Map<string, number>();
    }

    /**
     * we need to generate path using dfs
     * - fixed -> stay
     * - category -> choose points for the category
     *
     * build my own graph by calculating possible points
     * on each position with some similarity percent
     * then we will make a dfs on a new graph
     **/
    async generate(): Promise<LocationItem[]> {
        this.findPoints();

        this.buildGraph();

        for (const [item, _] of this.items)
            this.result.push(item);
        this.durations.set(this.result[0].location.id, 0);

        this.dfs(0, 0);

        return this.result;
    }

    /** функция считает насколько `item` подходит под нашу выборку */
    private calculateSimilarity(
        item: HouseInterface,
        categoryIndex: number,
    ): number {
        let similarity = 0;
        const promptElement = this.keys[categoryIndex];

        /** calculating categories similarity */
        for (const key of Object.keys(promptElement.categories!))
            if (getCategory(item.category).name === key)
                similarity += promptElement.categories![key];

        /** calculating distance to previous point **/
        let prev_distance = Infinity;
        for (const house of this.items[categoryIndex])
            prev_distance = Math.min(prev_distance, getDistance(this.city, house.location.id, item.id));

        /** calculating distance to the next point if it exists **/
        let next_distance = Infinity;
        for (let next_index = categoryIndex + 1; next_index < this.keys.length; next_index++) {
            if (this.keys[next_index].type !== 'fixed' || this.items[next_index + 1].length === 0) continue;
            next_distance = getDistance(this.city, this.items[next_index + 1][0].location.id, item.id);
            break;
        }

        /** adding distances to the answer **/
        let distance = prev_distance;
        if (next_distance !== Infinity)
            distance = (prev_distance + next_distance) / 2;
        similarity = similarity * (1e5 / (Math.max(1, distance)));

        return similarity;
    }

    private findPoints() {
        // setting default value of `items` array
        this.items = [[{ location: { ...this.startPosition, edges: [...this.startPosition.edges] } }]];
        for (let index = 0; index < this.keys.length; index++)
            this.items.push([]);

        // adding `fixed` type points to `items`
        for (let index = 0; index < this.keys.length; index++) {
            if (this.keys[index].type === 'fixed') {
                const house = this.city.houseIndex.get(this.keys[index].id!);
                if (house === undefined) throw new InternalServerError(`house ${ index } not found`);
                this.items[index + 1].push({
                    location: { ...house, edges: [...house.edges] }
                });
            }
        }

        // adding base for the `category` type points
        for (let index = 0; index < this.keys.length; index++) {
            if (this.keys[index].type === 'category') {
                let sort_places: { house: HouseInterface, similarity: number }[] = [];
                for (const house of this.city.houses) {
                    sort_places.push({
                        house: house,
                        similarity: this.calculateSimilarity(house, index)
                    })
                }

                sort_places.sort((a, b) => b.similarity - a.similarity);
                sort_places = sort_places.slice(0, this.MAX_ITEMS_COUNT);
                while (sort_places.length > 0 && sort_places[sort_places.length - 1].similarity == 0)
                    sort_places.pop();

                // getting top places
                for (const place of sort_places)
                    this.items[index + 1].push({
                        location: { ...place.house, edges: [...place.house.edges] },
                    });
            }
        }
    }

    private buildGraph() {
        for (let index = 0; index < this.items.length; index++) {
            if (index != 0) { // adding edges
                for (const from of this.items[index - 1]) {
                    for (const to of this.items[index]) {
                        const street = {
                            id: `${ from.location.id }:${ to.location.id }`,
                            from: from.location.id,
                            to: to.location.id,
                            length: getDistance(this.city, from.location.id, to.location.id)
                        };
                        from.location.edges.push(street);
                        this.graph.streetIndex.set(street.id, street);
                    }
                }
            }

            for (const { location: house, categoriesSum } of this.items[index]) {
                this.graph.houses.push(house);
                this.graph.houseIndex.set(house.id, house);
                this.durations.set(house.id, Infinity);
            }
        }
    }

    private dfs(index: number, duration: number) {
        if (index === this.items.length - 1) return;

        const house = this.result[index].location;

        for (const edge of house.edges) {
            if (this.durations.get(edge.to)! > duration + edge.length) {
                this.durations.set(edge.to, duration + edge.length);
                const to_house = this.city.houseIndex.get(edge.to);
                if (to_house === undefined) throw new InternalServerError(`house ${ index } not found`);
                this.result[index + 1] = { location: to_house };
                this.dfs(index + 1, duration + edge.length);
            }
        }
    }
}