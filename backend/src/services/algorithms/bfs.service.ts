import { MappedCityInterface } from "../../interfaces/city.interface";
import { LocationItem, PromptElement } from "../../interfaces/path.interface";
import { HouseInterface } from "../../interfaces/house.interface";
import { InternalServerError } from "../../utils/errors";
import { StreetInterface } from "../../interfaces/street.interface";
import { getCategory } from "../category.service";
import { DynamicAPSP } from "../path-build.service";
import { Queue } from "../../utils/utils";

export class BfsService {
    private city: MappedCityInterface;
    private readonly keys: PromptElement[];
    private readonly startPosition: HouseInterface;

    private apsp: DynamicAPSP;

    private items: LocationItem[][];
    private graph: MappedCityInterface;
    private result: LocationItem[];
    private durations: Map<string, number>;

    private readonly MAX_ITEMS_COUNT = 29;

    constructor(
        apsp: DynamicAPSP,
        keys: PromptElement[],
        startPosition: HouseInterface
    ) {
        this.apsp = apsp;
        this.city = apsp.city;
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
     * we need to generate path using BFS
     * - fixed -> stay
     * - category -> choose points for the category
     *
     * build my own graph by calculating possible points
     * on each position with some similarity percent
     * then we will make a BFS on a new graph
     **/
    async generate(): Promise<LocationItem[]> {
        let start = Date.now();
        console.log("\x1b[36m[BFS]\x1b[0m generation has been started: ", (Date.now() - start), "ms");
        start = Date.now();

        this.findPoints();
        console.log("\x1b[36m[BFS]\x1b[0m points for prompt were found: ", (Date.now() - start), "ms");
        start = Date.now();

        this.buildGraph();
        console.log("\x1b[36m[BFS]\x1b[0m graph was build: ", (Date.now() - start), "ms");
        start = Date.now();

        this.bfs();
        console.log("\x1b[36m[BFS]\x1b[0m algorithm finished: ", (Date.now() - start), "ms");

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
        this.items = [[{ location: { ...this.startPosition, edges: [], id: `0-${ this.startPosition.id }` } }]];
        for (let index = 0; index < this.keys.length; index++)
            this.items.push([]);

        // adding `fixed` type points to `items`
        for (let index = 0; index < this.keys.length; index++) {
            if (this.keys[index].type === 'fixed') {
                const house = this.city.houseIndex.get(this.keys[index].id!);
                if (house === undefined) throw new InternalServerError(`house ${ index } not found`);
                this.items[index + 1].push({
                    location: { ...house, edges: [], id: `${ index }-${ house.id }` }
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
                        location: { ...place.house, edges: [], id: `${ index }-${ place.house.id }` },
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
                            length: this.apsp.getDistance(from.location.id, to.location.id),
                        };
                        from.location.edges.push(street);
                        this.graph.streetIndex.set(street.id, street);
                    }
                }
            }

            for (const { location: house, categoriesSum } of this.items[index]) {
                this.graph.houses.push(house);
                this.graph.houseIndex.set(house.id, house);
            }
        }
    }

    private getId(id: string) {
        return id.split('-').slice(1).join('-');
    }

    /** Builds optimized path in new graph **/
    private bfs() {
        for (const house of this.graph.houses)
            this.durations.set(house.id, Infinity);

        const queue: Queue<HouseInterface> = new Queue<HouseInterface>();
        const start = this.items[0][0].location;
        this.durations.set(start.id, 0);
        queue.add(start);

        while (!queue.isEmpty()) {
            const house = queue.get();
            if (house === undefined) break;
            const dist = this.durations.get(house.id)!;
            for (const edge of house.edges) {
                const current_dist = this.durations.get(edge.to) || Infinity;
                const new_dist = dist + edge.length;
                if (new_dist < current_dist) {
                    if (current_dist === Infinity)
                        queue.add(this.graph.houseIndex.get(edge.to)!);
                    this.durations.set(edge.to, new_dist);
                }
            }
        }

        for (let index = 0; index < this.items.length; index++) {
            let id = this.items[index][0].location.id;
            let duration = this.durations.get(id)!;
            for (const item of this.items[index]) {
                const new_duration = this.durations.get(item.location.id) || Infinity;
                if (duration > new_duration) {
                    duration = new_duration;
                    id = item.location.id;
                }
            }

            this.result.push({ location: this.city.houseIndex.get(this.getId(id))! });
        }
    }
}