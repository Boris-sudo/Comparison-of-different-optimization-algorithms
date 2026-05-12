import { MappedCityInterface } from "../../interfaces/city.interface";
import { LocationItem, PromptElement } from "../../interfaces/path.interface";
import { HouseInterface } from "../../interfaces/house.interface";
import { InternalServerError } from "../../utils/errors";
import { StreetInterface } from "../../interfaces/street.interface";
import { getCategory } from "../category.service";
import { getAllDistancesMatrix } from "../path-build.service";

export class DfsService {
    private city: MappedCityInterface;
    private keys: PromptElement[];
    private startPosition: HouseInterface;

    private items: LocationItem[][];
    private graph: MappedCityInterface;
    private result: LocationItem[];
    private durations: Map<string, number>;

    private distances: Map<string, Map<string, number>>;

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
        this.distances = new Map<string, Map<string, number>>();
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
        let start = Date.now();
        console.log("\x1b[36m[DFS]\x1b[0m generation has been started: ", (Date.now() - start), "ms");
        start = Date.now();

        this.distances = getAllDistancesMatrix(this.city);
        console.log("\x1b[36m[DFS]\x1b[0m distances matrix was calculated: ", (Date.now() - start), "ms");
        start = Date.now();

        this.findPoints();
        console.log("\x1b[36m[DFS]\x1b[0m points for prompt were found: ", (Date.now() - start), "ms");
        start = Date.now();

        this.buildGraph();
        console.log("\x1b[36m[DFS]\x1b[0m graph was build: ", (Date.now() - start), "ms");
        start = Date.now();

        for (const [item, _] of this.items)
            this.result.push(item);
        this.durations.set(this.result[0].location.id, 0);

        this.dfs(0, 0);
        console.log("\x1b[36m[DFS]\x1b[0m algorithm finished: ", (Date.now() - start), "ms");

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

        return similarity;
    }

    /** Finds points for new each key **/
    private findPoints() {
        // setting default value of `items` array
        this.items = [[{ location: { ...this.startPosition, edges: [] } }]];
        for (let index = 0; index < this.keys.length; index++)
            this.items.push([]);

        // adding `fixed` type points to `items`
        for (let index = 0; index < this.keys.length; index++) {
            if (this.keys[index].type === 'fixed') {
                const house = this.city.houseIndex.get(this.keys[index].id!);
                if (house === undefined) throw new InternalServerError(`house ${ index } not found`);
                this.items[index + 1].push({
                    location: { ...house, edges: [] }
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
                        location: { ...place.house, edges: [] },
                    });
            }
        }
    }

    /** Builds new graph **/
    private buildGraph() {
        for (let index = 0; index < this.items.length; index++) {
            if (index != 0) { // adding edges
                for (const from of this.items[index - 1]) {
                    for (const to of this.items[index]) {
                        const street: StreetInterface = {
                            id: `${ from.location.id }:${ to.location.id }`,
                            from: from.location.id,
                            to: to.location.id,
                            length: this.distances.get(from.location.id)?.get(to.location.id) ?? Infinity
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

    /** Builds optimized path in new graph **/
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