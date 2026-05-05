import OpenAI from "openai";
import { config } from "../config";

import { LocationItem, PathPostInterface, PathResponseInterface, PromptElement } from "../interfaces/path.interface";
import { CityInterface } from "../interfaces/city.interface";

import * as CategoryService from './category.service';
import { AnnealingService } from "./algorithms/annealing.service";

const openai = new OpenAI({ apiKey: config.OpenAiApiKey, baseURL: "https://openrouter.ai/api/v1" });

const buildBasePrompt = function (): string {
    const categories = CategoryService.getCategories().map(c => c.name).join('\n');

    return "### ИНСТРУКЦИЯ ДЛЯ НЕЙРОСЕТИ\n" +
        "\n" +
        "Анализируй пользовательский запрос и преобразуй его в JSON-структуру по правилам:\n" +
        "\n" +
        "1. **Распознавание тегов**:\n" +
        "   - `<#:fixed:id>` → тип `fixed`\n" +
        "     - Поля: `type` = \"fixed\", `id` (строка извлечённая из тега)\n" +
        "\n" +
        "2. **Обработка текста без тегов**:\n" +
        "   → Если есть прямое упоминание категории из списка → тип `category`\n" +
        "     - Поля: `type` = \"category\", `raw_prompt` (исходный текст фрагмента), `categories` (объект: имя категории → вероятность 0-100)\n" +
        "   → Иначе → выполни операцию ImagineRoute\n" +
        "\n" +
        "3. **Операция ImagineRoute**:\n" +
        "   • Придумай подходящий маршрут из категорий списка\n" +
        "   • Поля: `type` = \"route\", `raw_prompt` (исходный текст), `generated_prompt` (придуманный сценарий), `parsed_elements` (массив элементов типа `category`)\n" +
        "\n" +
        "4. **`categories` объект**:\n" +
        "   - Ключ: название категории ТОЛЬКО из списка ниже\n" +
        "   - Значение: число от 0 до 100 — насколько подходит эта категория (сумма не обязана быть 100)\n" +
        "\n" +
        "5. **Категории (ТОЛЬКО из списка)**:\n" +
        categories + "\n" +
        "\n" +
        "6. **Формат ответа**:\n" +
        "   - Сохраняй исходный порядок элементов\n" +
        "   - Только валидный JSON без ```json``` обёртки и без trailing comma\n" +
        "\n" +
        "---\n" +
        "\n" +
        "### ПРИМЕР ВХОДНЫХ ДАННЫХ\n" +
        "\"Ужин в <#:fixed:abc123>, затем культурная программа\"\n" +
        "\n" +
        "### ПРИМЕР ОТВЕТА\n" +
        "[\n" +
        "  { \"type\": \"fixed\", \"id\": \"abc123\", \"isPivotPoint\": true },\n" +
        "  {\n" +
        "    \"type\": \"route\",\n" +
        "    \"raw_prompt\": \"культурная программа\",\n" +
        "    \"generated_prompt\": \"Посещение театра или музея вечером\",\n" +
        "    \"parsed_elements\": [\n" +
        "      { \"type\": \"category\", \"raw_prompt\": \"театр или музей\", \"categories\": { \"театр\": 60, \"музей\": 40 } }\n" +
        "    ]\n" +
        "  }\n" +
        "]\n" +
        "\n" +
        "---\n" +
        "\n" +
        "### ВХОДНЫЕ ДАННЫЕ\n" +
        "\n" +
        "{USER_INPUT}\n" +
        "\n" +
        "### ОТВЕТ";
};

const buildPrompt = function (userInput: string): string {
    return buildBasePrompt().replace("{USER_INPUT}", userInput);
};

/** Function that parses prompt into Array<PromptItem> */
const parsePrompt = async function (
    prompt: string
): Promise<PromptElement[]> {
    const prompted = await openai.chat.completions.create({
        messages: [{ role: "user", content: buildPrompt(prompt) }],
        model: 'deepseek/deepseek-r1',
    });
    console.log(prompted);

    const messageContent = prompted.choices[0].message.content!;
    let content = JSON.parse(messageContent);

    let parsed: PromptElement[] = [];
    content.forEach((el: PromptElement) => {
        if (el.type == "route")
            el.parsed_elements!.forEach((par: PromptElement) => {
                parsed.push(par);
            });
        else
            parsed.push(el);
    });

    console.log(parsed);

    return parsed;
}
export const createPath = async function (
    city: CityInterface,
    path: PathPostInterface
): Promise<PathResponseInterface> {
    // todo check pre work on prompt
    const points: PromptElement[] = await parsePrompt(path.prompt);

    let pathResponse: Array<LocationItem> = [];
    switch (path.model) {
        case "Annealing": {
            const model = new AnnealingService(city, points, path.startPoint);
            pathResponse = await model.generate();
        }
    }

    let result: PathResponseInterface = { points: [] };
    for (const locationItem of pathResponse) {
        result.points.push(locationItem.location.id);
    }

    return result;
}