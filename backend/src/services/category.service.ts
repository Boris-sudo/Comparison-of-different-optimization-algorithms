import { CategoryInterface } from "../interfaces/category.interface";

const CATEGORIES: Array<CategoryInterface> = [
    { name: "дом"              },
    { name: "парк"             },
    { name: "кафе"             },
    { name: "пекарня"          },
    { name: "ресторан"         },
    { name: "музей"            },
    { name: "галерея"          },
    { name: "библиотека"       },
    { name: "книжный магазин"  },
    { name: "супермаркет"      },
    { name: "рынок"            },
    { name: "аптека"           },
    { name: "кинотеатр"        },
    { name: "театр"            },
    { name: "спортзал"         },
    { name: "бассейн"          },
    { name: "школа"            },
    { name: "университет"      },
    { name: "церковь"          },
    { name: "больница"         },
];

export const categoriesCount = function (): number {
    return CATEGORIES.length;
}

export const getCategory = function (index: number): CategoryInterface {
    const category = CATEGORIES[index];
    if (!category) throw new Error(`Category ${index} not found`);
    return category;
}

export const getCategories = function (): Array<CategoryInterface> {
    return CATEGORIES;
}