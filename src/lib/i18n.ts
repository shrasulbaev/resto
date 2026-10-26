export type Lang = "ru" | "ky";
export const LANGS: Lang[] = ["ru", "ky"];
export const LANG_COOKIE = "resto_lang";

export function parseLang(v: string | undefined | null): Lang {
  return v === "ky" ? "ky" : "ru";
}

// Kyrgyz text falls back to Russian when the venue has not translated it.
export function pick(lang: Lang, ru: string, ky: string | null | undefined): string;
export function pick(lang: Lang, ru: string | null | undefined, ky: string | null | undefined): string | null;
export function pick(lang: Lang, ru: string | null | undefined, ky: string | null | undefined) {
  return lang === "ky" && ky ? ky : (ru ?? null);
}

const dict = {
  ru: {
    table: "Стол",
    search: "Найти блюдо или ингредиент",
    hits: "Хиты",
    hitsHint: "чаще всего заказывают",
    signature: "Фирменные блюда",
    all: "Всё меню",
    nothingFound: "Ничего не нашлось",
    composition: "Состав",
    allergens: "Аллергены",
    kcal: "ккал",
    protein: "белки",
    fat: "жиры",
    carbs: "углеводы",
    hit: "ХИТ",
    signatureTag: "Фирменное",
    spicy: "Острое",
    vegetarian: "Вегетарианское",
    new: "Новинка",
    close: "Закрыть",
    som: "сом",
  },
  ky: {
    table: "Үстөл",
    search: "Тамак же курамын издөө",
    hits: "Хиттер",
    hitsHint: "эң көп заказ кылынат",
    signature: "Фирмалык тамактар",
    all: "Толук меню",
    nothingFound: "Эч нерсе табылган жок",
    composition: "Курамы",
    allergens: "Аллергендер",
    kcal: "ккал",
    protein: "белок",
    fat: "май",
    carbs: "көмүрсуу",
    hit: "ХИТ",
    signatureTag: "Фирмалык",
    spicy: "Ачуу",
    vegetarian: "Вегетариандык",
    new: "Жаңы",
    close: "Жабуу",
    som: "сом",
  },
} as const;

export type Dict = { [K in keyof (typeof dict)["ru"]]: string };

export function t(lang: Lang): Dict {
  return dict[lang];
}

export function formatSom(n: number): string {
  return `${n.toLocaleString("ru-RU").replace(/ /g, " ")} сом`;
}
