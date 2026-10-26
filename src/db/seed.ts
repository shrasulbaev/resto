import type { Db } from "./client";
import { categories, dishes, staff, tables, users, venues } from "./schema";
import { hashSecret } from "@/lib/passwords";
import { randomToken } from "@/lib/tokens";

type DishSeed = Omit<typeof dishes.$inferInsert, "venueId" | "categoryId">;

const MENU: { ru: string; ky: string; dishes: DishSeed[] }[] = [
  {
    ru: "Горячее",
    ky: "Ысык тамактар",
    dishes: [
      {
        nameRu: "Бешбармак", nameKy: "Бешбармак", price: 590, weight: "450 г", kcal: 720, protein: 38, fat: 34, carbs: 62,
        descriptionRu: "Домашняя лапша с отварной бараниной и говядиной, луковый соус чык.",
        compositionRu: "баранина, говядина, тесто (мука, яйцо), лук, бульон, специи",
        allergens: ["глютен", "яйцо"], isSignature: true,
      },
      {
        nameRu: "Лагман", nameKy: "Лагман", price: 420, weight: "400 г", kcal: 640, protein: 26, fat: 22, carbs: 80,
        descriptionRu: "Тянутая лапша с говядиной и овощами.",
        compositionRu: "лапша, говядина, перец, морковь, редька, чеснок",
        allergens: ["глютен"],
      },
      {
        nameRu: "Куурдак по-домашнему", nameKy: "Үй куурдагы", price: 520, weight: "350 г", kcal: 810, protein: 34, fat: 58, carbs: 30,
        descriptionRu: "Баранина, лук и картофель, обжаренные в казане.",
        compositionRu: "баранина, картофель, лук, специи", isSignature: true, hitPinned: true,
      },
      { nameRu: "Плов", nameKy: "Палоо", price: 450, weight: "350 г", kcal: 690, protein: 22, fat: 30, carbs: 78, compositionRu: "рис, говядина, морковь, нут, специи" },
      { nameRu: "Манты", nameKy: "Манты", price: 380, weight: "5 шт", kcal: 560, protein: 24, fat: 26, carbs: 54, compositionRu: "тесто, говядина, лук, курдюк", allergens: ["глютен"] },
    ],
  },
  {
    ru: "Супы",
    ky: "Шорполор",
    dishes: [
      { nameRu: "Шорпо", nameKy: "Шорпо", price: 350, weight: "400 г", kcal: 380, protein: 24, fat: 20, carbs: 22, compositionRu: "баранина, картофель, морковь, лук" },
      { nameRu: "Ашлям-фу", nameKy: "Ашлямфу", price: 260, weight: "350 г", kcal: 420, protein: 10, fat: 12, carbs: 64, tags: ["spicy"], isSignature: true, descriptionRu: "Холодная лапша, крахмальное желе, острый соус." },
    ],
  },
  {
    ru: "Выпечка",
    ky: "Нан азыктар",
    dishes: [{ nameRu: "Самса", nameKy: "Самса", price: 190, weight: "1 шт", kcal: 240, protein: 9, fat: 14, carbs: 20, allergens: ["глютен"] }],
  },
  {
    ru: "Напитки",
    ky: "Суусундуктар",
    dishes: [
      { nameRu: "Чай чёрный", nameKy: "Кара чай", price: 165, weight: "0,5 л", kcal: 0 },
      { nameRu: "Вода 0,5", nameKy: "Суу 0,5", price: 140, weight: "0,5 л", kcal: 0 },
      { nameRu: "Айран", nameKy: "Айран", price: 150, weight: "0,3 л", kcal: 110, allergens: ["молоко"] },
    ],
  },
];

export const DEMO = {
  slug: "ala-too",
  ownerEmail: "admin@demo.kg",
  ownerPassword: "demo1234",
  platformEmail: "platform@demo.kg",
  platformPassword: "platform1234",
  waiterPins: { Айбек: "1111", Нурлан: "2222" },
  kitchenPin: "3333",
  tableCount: 10,
};

// Creates the demo venue "Кафе «Ала-Тоо»" with menu, tables and staff.
export async function seedDemo(db: Db) {
  const [venue] = await db
    .insert(venues)
    .values({ slug: DEMO.slug, name: "Кафе «Ала-Тоо»", opensAt: null, closesAt: null })
    .returning();

  await db.insert(users).values([
    { email: DEMO.ownerEmail, passwordHash: await hashSecret(DEMO.ownerPassword), name: "Хозяин", role: "owner", venueId: venue.id },
    { email: DEMO.platformEmail, passwordHash: await hashSecret(DEMO.platformPassword), name: "Платформа", role: "platform" },
  ]);

  for (const [name, pin] of Object.entries(DEMO.waiterPins)) {
    await db.insert(staff).values({ venueId: venue.id, name, role: "waiter", pinHash: await hashSecret(pin) });
  }
  await db.insert(staff).values({ venueId: venue.id, name: "Кухня", role: "kitchen", pinHash: await hashSecret(DEMO.kitchenPin) });

  await db.insert(tables).values(
    Array.from({ length: DEMO.tableCount }, (_, i) => ({ venueId: venue.id, number: i + 1, token: randomToken() })),
  );

  let catSort = 0;
  for (const cat of MENU) {
    const [category] = await db
      .insert(categories)
      .values({ venueId: venue.id, nameRu: cat.ru, nameKy: cat.ky, sort: catSort++ })
      .returning();
    await db.insert(dishes).values(cat.dishes.map((d, i) => ({ ...d, venueId: venue.id, categoryId: category.id, sort: i })));
  }

  return venue;
}
