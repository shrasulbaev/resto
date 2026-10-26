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
    mySelection: "Мой выбор",
    notAnOrder: "это ещё не заказ",
    addToSelection: "В мой выбор",
    added: "Добавлено в выбор",
    commentPlaceholder: "Комментарий, например: без лука",
    total: "Итого",
    emptySelection: "Добавляйте блюда кнопкой «+», а потом покажите выбор официанту.",
    kcalWarn: "больше вашей нормы",
    kcalNorm: "Предупреждать, если больше",
    kcalOff: "не предупреждать",
    less: "Меньше",
    more: "Больше",
    callWaiter: "Позвать официанта",
    callWithSelection: "Позвать официанта с выбором",
    callSent: "Официант вызван",
    callN: "Вызов {n} из {max}",
    nextCallIn: "повторить через {t}",
    callAgain: "Позвать ещё раз",
    noResponse: "Официант пока не ответил. Пожалуйста, подойдите к администратору.",
    waiterComing: "Стол открыт",
    waiterIs: "Ваш официант: {name}",
    bill: "Счёт",
    billCash: "Наличными",
    billCard: "Картой",
    container: "Контейнер",
    other: "Другое",
    otherPlaceholder: "Что нужно? Например: салфетки",
    send: "Отправить",
    requested: "Отправлено",
    waitAMinute: "Запрос уже отправлен, официант скоро подойдёт",
    closedHours: "Сейчас заведение закрыто, вызов официанта недоступен.",
    howToPay: "Как будете платить?",
    tableClosed: "Стол закрыт. Чтобы позвать официанта, нажмите кнопку.",
    error: "Не получилось, попробуйте ещё раз",
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
    mySelection: "Менин тандоом",
    notAnOrder: "бул азырынча заказ эмес",
    addToSelection: "Тандоого кошуу",
    added: "Тандоого кошулду",
    commentPlaceholder: "Комментарий, мисалы: пиязсыз",
    total: "Жалпы",
    emptySelection: "Тамактарды «+» менен кошуп, тандооңузду официантка көрсөтүңүз.",
    kcalWarn: "нормаңыздан көп",
    kcalNorm: "Ашып кетсе эскертүү",
    kcalOff: "эскертпөө",
    less: "Азыраак",
    more: "Көбүрөөк",
    callWaiter: "Официантты чакыруу",
    callWithSelection: "Тандоо менен официантты чакыруу",
    callSent: "Официант чакырылды",
    callN: "{max} чакыруунун {n}-си",
    nextCallIn: "{t} кийин кайталоо",
    callAgain: "Дагы чакыруу",
    noResponse: "Официант азырынча жооп берген жок. Администраторго кайрылыңыз.",
    waiterComing: "Үстөл ачык",
    waiterIs: "Сиздин официант: {name}",
    bill: "Эсеп",
    billCash: "Накталай",
    billCard: "Карта менен",
    container: "Контейнер",
    other: "Башка",
    otherPlaceholder: "Эмне керек? Мисалы: салфетка",
    send: "Жөнөтүү",
    requested: "Жөнөтүлдү",
    waitAMinute: "Суроо жөнөтүлгөн, официант жакында келет",
    closedHours: "Азыр мекеме жабык, официантты чакыруу мүмкүн эмес.",
    howToPay: "Кантип төлөйсүз?",
    tableClosed: "Үстөл жабык. Официантты чакыруу үчүн баскычты басыңыз.",
    error: "Болгон жок, дагы аракет кылыңыз",
  },
} as const;

export type Dict = { [K in keyof (typeof dict)["ru"]]: string };

export function t(lang: Lang): Dict {
  return dict[lang];
}

export function fill(s: string, vars: Record<string, string | number>) {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

export function formatSom(n: number): string {
  return `${n.toLocaleString("ru-RU").replace(/ /g, " ")} сом`;
}
