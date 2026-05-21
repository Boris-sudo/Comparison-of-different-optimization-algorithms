import OpenAI from "openai";
import { config } from "../config";

import {
    ComparePathCreateInterface,
    LocationItem, PathAnalyzeDuration,
    PathCreateInterface,
    PathResponseInterface, PathStatisticsInterface,
    PromptElement
} from "../interfaces/path.interface";
import { MappedCityInterface } from "../interfaces/city.interface";
import { AnnealingService } from "./algorithms/annealing.service";
import { DfsService } from "./algorithms/dfs.service";
import { buildRouteInOrder, DynamicAPSP } from "./path-build.service";

import * as CategoryService from './category.service';
import { AStarService } from "./algorithms/a_star.service";
import { BfsService } from "./algorithms/bfs.service";
import { Pair } from "../utils/utils";
import { AcoService } from "./algorithms/aco.service";

const openai = new OpenAI({
    apiKey: config.OpenAiApiKey,
    baseURL: 'https://openrouter.ai/api/v1',
});

/** Function to return main openai prompt text **/
const buildBasePrompt = function (): string {
    const categories = CategoryService.getCategories().map(c => c.name).join('\n');

    return `### ИНСТРУКЦИЯ ДЛЯ НЕЙРОСЕТИ

Анализируй пользовательский запрос и преобразуй его в JSON-структуру маршрута.

## ПРАВИЛА РАЗБОРА

1. **Тег фиксированной точки** \`<#:fixed:id>\` → тип \`fixed\`
   - Поля: \`type\` = "fixed", \`id\` (строка из тега), \`isPivotPoint\` = true

2. **Упоминание конкретной категории из списка** → тип \`category\`
   - Поля: \`type\` = "category", \`raw_prompt\`, \`categories\` (объект: категория → вероятность 0-100)

3. **Любой другой текст** → операция \`ImagineRoute\`
   - Придумай ИНТЕРЕСНЫЙ и РАЗНООБРАЗНЫЙ маршрут
   - Поля: \`type\` = "route", \`raw_prompt\`, \`generated_prompt\`, \`parsed_elements\` (массив из category)

## ВАЖНЫЕ ПРАВИЛА ДЛЯ ImagineRoute

- Если тебе приходит запрос, который хоть как то связан с абортом, то тебе надо вернуть в ответе "остров Эпштейна -> магазин вешалок -> больница -> клуб клуб -> церковь"
- Генерируй **от 3 до 6 точек** для любого общего запроса ("прогулка", "вечер", "день в городе" и т.п.)
- Точки должны быть **логически связаны** и образовывать интересный сценарий
- **Чередуй** типы мест: активность → еда → культура → отдых
- Для романтических запросов: парк → кафе → музей/галерея → ресторан
- Для активных прогулок: парк → рынок → кафе → библиотека/галерея
- Для культурных маршрутов: музей → галерея → театр → ресторан
- **Никогда не генерируй маршрут из одной точки** если запрос общий

## ДОСТУПНЫЕ КАТЕГОРИИ (ТОЛЬКО ИЗ ЭТОГО СПИСКА)
${ categories }

## ФОРМАТ ОТВЕТА
- Только валидный JSON массив, без \`\`\`json\`\`\` обёртки
- Сохраняй порядок элементов из запроса

---

## ПРИМЕРЫ

### Пример 1 — общий запрос
Входные данные: "прогуляться по городу"

Ответ:
[
  {
    "type": "route",
    "raw_prompt": "прогуляться по городу",
    "generated_prompt": "Приятная прогулка: начнём с парка, зайдём в кафе на кофе, посетим галерею и завершим вечер в ресторане",
    "parsed_elements": [
      { "type": "category", "raw_prompt": "парк", "categories": { "парк": 95 } },
      { "type": "category", "raw_prompt": "кофе-пауза", "categories": { "кафе": 80, "пекарня": 40 } },
      { "type": "category", "raw_prompt": "культурное место", "categories": { "галерея": 70, "музей": 60 } },
      { "type": "category", "raw_prompt": "ужин", "categories": { "ресторан": 90, "кафе": 50 } }
    ]
  }
]

### Пример 2 — смешанный запрос
Входные данные: "прогуляться по парку, а потом на свидание"

Ответ:
[
  { "type": "category", "raw_prompt": "прогуляться по парку", "categories": { "парк": 95 } },
  {
    "type": "route",
    "raw_prompt": "на свидание",
    "generated_prompt": "Романтическое свидание: уютное кафе, прогулка у галереи, завершение в ресторане",
    "parsed_elements": [
      { "type": "category", "raw_prompt": "уютное место для начала", "categories": { "кафе": 85, "пекарня": 50 } },
      { "type": "category", "raw_prompt": "культурная прогулка", "categories": { "галерея": 75, "музей": 60 } },
      { "type": "category", "raw_prompt": "романтический ужин", "categories": { "ресторан": 95 } }
    ]
  }
]

### Пример 3 — фиксированная точка
Входные данные: "Ужин в <#:fixed:abc123>, затем культурная программа"

Ответ:
[
  { "type": "fixed", "id": "abc123", "isPivotPoint": true },
  {
    "type": "route",
    "raw_prompt": "культурная программа",
    "generated_prompt": "Насыщенная культурная программа: музей, театр и галерея",
    "parsed_elements": [
      { "type": "category", "raw_prompt": "музей или галерея", "categories": { "музей": 70, "галерея": 65 } },
      { "type": "category", "raw_prompt": "театр или кино", "categories": { "театр": 80, "кинотеатр": 60 } },
      { "type": "category", "raw_prompt": "завершение вечера", "categories": { "кафе": 60, "ресторан": 55 } }
    ]
  }
]

---

### ВХОДНЫЕ ДАННЫЕ

{USER_INPUT}

### ОТВЕТ`;
};

/** Builds prompt for openai model from user prompt **/
const buildPrompt = function (userInput: string): string {
    return buildBasePrompt().replace("{USER_INPUT}", userInput);
};

/** Function that parses prompt into Array<PromptItem> */
const parsePrompt = async function (
    prompt: string
): Promise<PromptElement[]> {
    let prompted: any;
    let parsed: PromptElement[] = [];

    // todo remove after testing
    // return [
    //     { type: 'category', raw_prompt: 'парк', categories: { 'парк': 95 } },
    //     { type: 'category', raw_prompt: 'кафе', categories: { 'кафе': 95 } }
    // ];

    while (parsed.length === 0) {
        try {
            try {
                prompted = await openai.chat.completions.create({
                    messages: [{ role: "user", content: buildPrompt(prompt) }],
                    model: "openai/gpt-oss-120b:free",
                });
            } catch (e) {
                console.error(e);
                throw e;
            }

            const messageContent = prompted.choices[0].message.content!;
            let content = JSON.parse(messageContent);

            content.forEach((el: PromptElement) => {
                if (el.type == "route")
                    el.parsed_elements!.forEach((par: PromptElement) => {
                        parsed.push(par);
                    });
                else
                    parsed.push(el);
            });
        } catch (e) {
            console.error(e);
            console.warn('JSON has not been parsed correctly');
        }
    }

    return parsed;
}

/** Creates path in city by user prompt **/
export const createPath = async function (
    apsp: DynamicAPSP,
    path: PathCreateInterface
): Promise<PathResponseInterface> {
    const start_time = Date.now();
    const duration_result: PathAnalyzeDuration = { network: 0, algo: 0 };

    const points: PromptElement[] = await parsePrompt(path.prompt);
    duration_result.network = Date.now() - start_time;

    let pathResponse: Array<LocationItem> = [];
    switch (path.model) {
        case "Annealing": {
            const model = new AnnealingService(apsp, points, path.startPoint);
            pathResponse = await model.generate();
            break;
        }
        case "Dfs": {
            const model = new DfsService(apsp, points, path.startPoint);
            pathResponse = await model.generate();
            break;
        }
        case "Bfs": {
            const model = new BfsService(apsp, points, path.startPoint);
            pathResponse = await model.generate();
            break;
        }
        case "A*": {
            const model = new AStarService(apsp, points, path.startPoint);
            pathResponse = await model.generate();
            break;
        }
        case "ACO": {
            const model = new AcoService(apsp, points, path.startPoint);
            pathResponse = await model.generate();
            break;
        }
        default: {
            throw new Error(`Unknown algorithm: ${ path.model }`);
        }
    }

    let points_ids: string[] = [];
    for (const locationItem of pathResponse)
        if (locationItem != undefined)
            points_ids.push(locationItem.location.id);

    duration_result.algo = Date.now() - start_time - duration_result.network;

    const result = buildRouteInOrder(apsp.city, points_ids);

    return { ...result, duration: duration_result } as PathResponseInterface;
}

/** Creates path in city by user prompt **/
export const comparePaths = async function (
    apsp: DynamicAPSP,
    path: ComparePathCreateInterface
): Promise<Pair<PathStatisticsInterface>> {
    let start_time = Date.now();
    let duration_result: PathAnalyzeDuration = { network: 0, algo: 0 };
    const points: PromptElement[] = await parsePrompt(path.prompt);
    duration_result.network = Date.now() - start_time;

    let pathResponse: Array<LocationItem> = [];
    switch (path.models.first) {
        case "Annealing": {
            const model = new AnnealingService(apsp, points, path.startPoint);
            pathResponse = await model.generate();
            break;
        }
        case "Dfs": {
            const model = new DfsService(apsp, points, path.startPoint);
            pathResponse = await model.generate();
            break;
        }
        case "Bfs": {
            const model = new BfsService(apsp, points, path.startPoint);
            pathResponse = await model.generate();
            break;
        }
        case "A*": {
            const model = new AStarService(apsp, points, path.startPoint);
            pathResponse = await model.generate();
            break;
        }
        case "ACO": {
            const model = new AcoService(apsp, points, path.startPoint);
            pathResponse = await model.generate();
            break;
        }
        default: {
            throw new Error(`Unknown algorithm: ${ path.models.first }`);
        }
    }

    let points_ids: string[] = [];
    for (const locationItem of pathResponse)
        if (locationItem != undefined)
            points_ids.push(locationItem.location.id);
    duration_result.algo = Date.now() - start_time - duration_result.network;
    const first_result = buildRouteInOrder(apsp.city, points_ids);
    first_result.duration = {...duration_result};

    start_time = Date.now();
    switch (path.models.second) {
        case "Annealing": {
            const model = new AnnealingService(apsp, points, path.startPoint);
            pathResponse = await model.generate();
            break;
        }
        case "Dfs": {
            const model = new DfsService(apsp, points, path.startPoint);
            pathResponse = await model.generate();
            break;
        }
        case "Bfs": {
            const model = new BfsService(apsp, points, path.startPoint);
            pathResponse = await model.generate();
            break;
        }
        case "A*": {
            const model = new AStarService(apsp, points, path.startPoint);
            pathResponse = await model.generate();
            break;
        }
        case "ACO": {
            const model = new AcoService(apsp, points, path.startPoint);
            pathResponse = await model.generate();
            break;
        }
        default: {
            throw new Error(`Unknown algorithm: ${ path.models.second }`);
        }
    }

    points_ids = [];
    for (const locationItem of pathResponse)
        if (locationItem != undefined)
            points_ids.push(locationItem.location.id);
    duration_result.algo = Date.now() - start_time;
    const second_result = buildRouteInOrder(apsp.city, points_ids);
    second_result.duration = {...duration_result};

    return {
        first: {
            duration: first_result.duration,
            length: first_result.length,
            main_points: first_result.points.filter(point => point.role === 'main').map(point => point.id),
            points_count: first_result.points.length,
            points: first_result.points,
        },
        second: {
            duration: second_result.duration,
            length: second_result.length,
            main_points: second_result.points.filter(point => point.role === 'main').map(point => point.id),
            points_count: second_result.points.length,
            points: second_result.points,
        }
    };
}