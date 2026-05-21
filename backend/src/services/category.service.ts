import { CategoryInterface } from "../interfaces/category.interface";

/** All the possible categories for points **/
const CATEGORIES: Array<CategoryInterface> = [
    { name: "дом" },
    { name: "парк" },
    { name: "кафе" },
    { name: "пекарня" },
    { name: "ресторан" },
    { name: "музей" },
    { name: "галерея" },
    { name: "библиотека" },
    { name: "книжный магазин" },
    { name: "супермаркет" },
    { name: "рынок" },
    { name: "аптека" },
    { name: "кинотеатр" },
    { name: "театр" },
    { name: "спортзал" },
    { name: "бассейн" },
    { name: "школа" },
    { name: "университет" },
    { name: "церковь" },
    { name: "больница" },
    { name: "магазин вешалок" },
    { name: "клуб клуб" },
    { name: "остров Эпштейна" },
];

export const SINGLETON = new Set<string>([
    'дом', 'остров Эпштейна', 'клуб клуб'
]);

/** returns count of the categories **/
export const categoriesCount = function (): number {
    return CATEGORIES.length;
}

/** returns category by its index in main array **/
export const getCategory = function (index: number): CategoryInterface {
    const category = CATEGORIES[index];
    if (!category) throw new Error(`Category ${ index } not found`);
    return category;
}

/** returns full array of categories **/
export const getCategories = function (): Array<CategoryInterface> {
    return CATEGORIES;
}