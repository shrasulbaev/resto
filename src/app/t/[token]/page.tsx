import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { GuestWithCalls } from "@/components/guest/table-calls";
import type { GuestDish, GuestMenuData } from "@/components/guest/types";
import { LANG_COOKIE, parseLang, pick } from "@/lib/i18n";
import { findTableByToken, guestMenu, hitDishIds } from "@/server/menu";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findTableByToken(token);
  return { title: found ? `${found.venue.name} — меню` : "Меню" };
}

export default async function TableMenuPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findTableByToken(token);
  if (!found) notFound();
  const { table, venue } = found;
  const lang = parseLang((await cookies()).get(LANG_COOKIE)?.value);
  const [menu, hitIds] = await Promise.all([guestMenu(venue.id), hitDishIds(venue.id)]);

  const dishes: GuestDish[] = menu.flatMap((c) =>
    c.dishes.map((d) => {
      const name = pick(lang, d.nameRu, d.nameKy);
      const description = pick(lang, d.descriptionRu, d.descriptionKy);
      const composition = pick(lang, d.compositionRu, d.compositionKy);
      return {
        id: d.id,
        categoryId: d.categoryId,
        name,
        description,
        composition,
        price: d.price,
        weight: d.weight,
        kcal: d.kcal,
        protein: d.protein,
        fat: d.fat,
        carbs: d.carbs,
        allergens: d.allergens,
        tags: d.tags,
        isSignature: d.isSignature,
        photoUrl: d.photoUrl,
        searchText: [d.nameRu, d.nameKy, d.compositionRu, d.compositionKy, d.descriptionRu].filter(Boolean).join(" ").toLowerCase(),
      };
    }),
  );

  const data: GuestMenuData = {
    lang,
    venue: { name: venue.name, logoUrl: venue.logoUrl, backgroundUrl: venue.backgroundUrl, backgroundDim: venue.backgroundDim },
    tableNumber: table.number,
    tableToken: table.token,
    dishes,
    categories: menu.map((c) => ({ id: c.id, name: pick(lang, c.nameRu, c.nameKy), dishIds: c.dishes.map((d) => d.id) })),
    hitIds: hitIds.filter((id) => dishes.some((d) => d.id === id)),
  };

  return <GuestWithCalls data={data} />;
}
