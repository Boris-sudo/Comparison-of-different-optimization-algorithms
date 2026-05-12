import { LocationItem, PromptElement } from "../../interfaces/path.interface";
import { MappedCityInterface } from "../../interfaces/city.interface";
import { HouseInterface } from "../../interfaces/house.interface";
import { InternalServerError } from "../../utils/errors";
import { getRandomInt } from "../../utils/utils";
import { getCategory } from "../category.service";
import { buildRouteInOrder, dijkstra } from "../path-build.service";

export class AnnealingService {
    /* parsed elements of the prompt */
    keys: PromptElement[];
    /* city */
    city: MappedCityInterface;

    items: Array<Array<LocationItem>>;

    startPosition!: HouseInterface;

    /** Maximum iterations of annealing algorithm */
    private readonly ITERATIONS = 1e5;
    /** Annealing temperature multiplier */
    private readonly TEMPERATURE_MULTIPLIER = 0.9;
    /** max elements count in items[i] */
    private readonly MAX_ITEMS_COUNT = 29;
    /** changes count during one annealing iteration */
    private readonly CHANGES_COUNT = 1;

    constructor(
        city: MappedCityInterface,
        keys: PromptElement[],
        startPosition: HouseInterface
    ) {
        this.city = city;
        this.keys = keys;
        this.startPosition = startPosition;
        this.items = [];
    }

    async generate(): Promise<Array<LocationItem>> {
        let start = Date.now();
        console.log("\x1b[36m[Annealing]\x1b[0m generation has been started: ", (Date.now() - start), "ms");
        start = Date.now();

        this.keys.unshift({
            id: this.startPosition.id,
            type: "fixed",
        })

        await this.findPointsForPrompt();
        console.log("\x1b[36m[Annealing]\x1b[0m points for prompt were found: ", (Date.now() - start), "ms");
        start = Date.now();

        const result = await this.annealing();
        console.log("\x1b[36m[Annealing]\x1b[0m annealing finished: ", (Date.now() - start), "ms");

        const path: Array<LocationItem> = [];
        for (const locationItem of result)
            path.push(locationItem);
        return path;
    }

    /** функция считает насколько `item` подходит под нашу выборку */
    private async calculatePreSimilarity(
        item: HouseInterface,
        categoryIndex: number,
    ): Promise<number[]> {
        let similarity = 0, categoriesSum = 0;
        const promptElement = this.keys[categoryIndex];

        /** calculating categories similarity */
        for (const key of Object.keys(promptElement.categories!)) {
            if (getCategory(item.category).name === key) {
                similarity += promptElement.categories![key];
                categoriesSum += promptElement.categories![key];
            }
        }

        /** calculating distance to previous point **/
        let prev_distance = Infinity;
        if (categoryIndex > 0) { // calculating distance to the prev point
            for (const house of this.items[categoryIndex - 1])
                prev_distance = Math.min(prev_distance, dijkstra(this.city, house.location.id, item.id).distance);
        } else { // calculating to the starting point
            prev_distance = dijkstra(this.city, this.startPosition.id, item.id).distance;
        }

        /** calculating distance to the next point if it exists **/
        let next_distance = Infinity;
        for (let next_index = categoryIndex + 1; next_index < this.items.length; next_index++) {
            if (this.keys[next_index].type !== 'fixed' || this.items[next_index].length === 0) continue;
            next_distance = dijkstra(this.city, this.items[next_index][0].location.id, item.id).distance;
            break;
        }

        /** adding distances to the answer **/
        let distance = prev_distance;
        if (next_distance !== Infinity)
            distance = (prev_distance + next_distance) / 2;
        similarity = similarity * (1e5 / (Math.max(1, distance)));

        return [similarity, categoriesSum];
    }

    /** Function that finds items for each key */
    private async findPointsForPrompt() {
        let start = Date.now();

        // setting empty array for items
        this.items = [];
        for (const key of this.keys)
            this.items.push([]);

        // setting items for fixed points
        for (let index = 0; index < this.keys.length; index++) {
            if (this.keys[index].type == 'fixed') {
                // we should just put here place with the same id
                // and don't fuck the brain
                const house = this.city.houseIndex.get(this.keys[index].id!);
                if (house === undefined) throw new InternalServerError(`No house found with id ${ this.keys[index].id }`);
                this.items[index].push({
                    location: house
                });
            }
        }

        // setting items for the `category` type
        for (let index = 0; index < this.keys.length; index++) {
            if (this.keys[index].type === 'category') {
                console.log(`\x1b[36m[Annealing]\x1b[0m \x1b[35m[findPointsForPrompt]\x1b[0m \x1b[34m[${ index } iteration]\x1b[0m start: `, (Date.now() - start), "ms"); // TODO remove after testing
                start = Date.now(); // TODO remove after testing

                // calculating places pre-similarities
                let sort_places: { house: HouseInterface, similarity: number, categoriesSum: number }[] = []; // array with places and their similarities
                for (const house of this.city.houses) {
                    const [pre_similarity, categoriesSum] = await this.calculatePreSimilarity(house, index);
                    sort_places.push({
                        house: house,
                        similarity: pre_similarity,
                        categoriesSum: categoriesSum,
                    });
                }

                console.log(`\x1b[36m[Annealing]\x1b[0m \x1b[35m[findPointsForPrompt]\x1b[0m \x1b[34m[${ index } iteration]\x1b[0m calculated pre similarities: `, (Date.now() - start), "ms"); // TODO remove after testing
                start = Date.now(); // TODO remove after testing

                // sorting places by their pre-similarity
                // todo check this for normal distribution
                sort_places.sort((a, b) => b.similarity - a.similarity);
                sort_places = sort_places.slice(0, this.MAX_ITEMS_COUNT);
                while (sort_places[sort_places.length - 1].categoriesSum === 0)
                    sort_places.pop();

                if (sort_places.length === 0 || sort_places[0].categoriesSum === 0)
                    throw new InternalServerError("sorted places are invalid");

                // getting top places
                for (const place of sort_places)
                    this.items[index].push({ // todo check this shit
                        location: place.house,
                        categoriesSum: place.categoriesSum,
                    });

                if (this.items[index].length === 0)
                    throw new InternalServerError("sorted places are invalid");

                console.log(`\x1b[36m[Annealing]\x1b[0m \x1b[35m[findPointsForPrompt]\x1b[0m \x1b[34m[${ index } iteration]\x1b[0m finished: `, (Date.now() - start), "ms"); // TODO remove after testing
                start = Date.now(); // TODO remove after testing
            }
        }
    }

    /** Function that generates start placement */
    private generateStartPlacement(): Array<LocationItem> {
        let result: Array<LocationItem> = [];
        let used = new Set<string>();

        for (let i = 0; i < this.items.length; i++) {
            result.push(this.items[i][0]);
            if (this.keys[i].type === 'fixed')
                used.add(result[i].location.id);
        }

        for (let i = 0; i < this.items.length; i++) {
            if (this.keys[i].type !== 'category') continue;
            let index = getRandomInt(0, this.items[i].length - 1);
            let counter = 0;
            while (used.has(this.items[i][index].location.id) && counter < 10)
                index = getRandomInt(0, this.items[i].length - 1), counter++;
            result[i] = this.items[i][index];
            used.add(result[i].location.id);
        }

        return result;
    }

    /** Function that calculates error of current placement of elements */
    private async errorFunction(items: Array<LocationItem>): Promise<number> {
        let error = 0;

        /*// calculating distances
        let distances: number[] = [];
        for (let index = 1; index < items.length; index++) {
            distances.push(getDistance(this.city, items[index - 1].location.id, items[index].location.id));
        }

        // checking time frames
        let slow_time = 0; // duration where we will stay in point this.keys[index].time
        let fast_time = 0; // duration without staying in points
        for (let index = 0; index < items.length; index++) {
            let duration = 0;
            if (index != 0)
                duration = distances[index - 1] / 5;
            fast_time += duration;
            slow_time += duration;

            if (items[index].location.time != 0) {
                slow_time += items[index].location.time;
            }
        }

        // calculating distance indicator
        let average_distance = 0;
        let min_distance = 1e9;
        let max_distance = 0;
        for (let i = 1; i < items.length; i++) {
            average_distance += distances[i - 1];
            min_distance = Math.min(min_distance, distances[i - 1]);
            max_distance = Math.max(max_distance, distances[i - 1]);
        }
        average_distance /= (items.length - 1);
        const distance_indicator = Math.max(average_distance, 1) * Math.max(1, max_distance - min_distance);*/

        const waypoints: string[] = [];
        for (const item of items) waypoints.push(item.location.id);
        const distance_indicator = Math.max(10, buildRouteInOrder(this.city, waypoints, true).length);
        if (distance_indicator === 0)
            throw (new InternalServerError("distance indicator is 0"));

        // calculating price indicator
        let price_indicator = 1; // TODO

        // calculating beauty of the path
        let beauty = 0;
        for (let index = 0; index < items.length; index++) {
            if (this.keys[index].type === "category")
                beauty += items[index].categoriesSum || 0;
            else if (this.keys[index].type === "fixed")
                beauty += 100;
        }

        if (isNaN(beauty))
            throw (new InternalServerError("beauty is NaN"));

        // calculating error from existing parts
        // error = beauty * (1e4 / distance_indicator) * (1e4 / ((fast_time + slow_time) / 2));
        error = Math.pow(beauty, 3) * (1e2 / distance_indicator);

        return error;
    }

    /** Function that makes random changes to path */
    private randomChangePlacement(placement: Array<LocationItem>): Array<LocationItem> {
        let result: Array<LocationItem> = placement;
        const used = new Set<string>();

        for (const locationItem of result) {
            used.add(locationItem.location.id);
        }

        for (let i = 1; i <= Math.min(result.length, this.CHANGES_COUNT); i++) {
            // generating random index of item in result to change
            let counter = 0;
            let index = getRandomInt(0, result.length - 1);
            while (this.items[index].length === 1 && counter < 10)
                index = getRandomInt(0, result.length - 1), counter++;

            // changing result[index] on other random value
            let item_index = getRandomInt(0, this.items[index].length - 1);
            counter = 0;
            while (used.has(this.items[index][item_index].location.id) && counter < 10)
                item_index = getRandomInt(0, this.items[index].length - 1), counter++;
            result[index] = this.items[index][item_index];
        }

        return result;
    }

    /** Main function of annealing */
    private async annealing(): Promise<Array<LocationItem>> {
        // generating start positions
        let placement = this.generateStartPlacement();
        let result_error = await this.errorFunction(placement);

        let temperature = 1;
        for (let i = 0; i < this.ITERATIONS; i++) {
            temperature *= this.TEMPERATURE_MULTIPLIER;

            let current_placement = this.randomChangePlacement(placement);
            let current_error = await this.errorFunction(current_placement);

            if (current_error > result_error || Math.random() < Math.exp((current_error - result_error) / temperature)) {
                result_error = current_error;
                placement = current_placement;
            }
        }

        return placement;
    }
}