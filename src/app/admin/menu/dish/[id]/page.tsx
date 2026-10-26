import { notFound } from "next/navigation";
import { DishForm } from "@/components/admin/dish-form";
import { adminDish, adminMenu, ALLERGENS, TAGS } from "@/server/admin-menu";
import { requireOwner } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function DishPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ category?: string }> }) {
  const s = await requireOwner();
  const { id } = await params;
  const menu = await adminMenu(s.venueId);
  const cats = menu.map((c) => ({ id: c.id, name: c.nameRu }));
  if (cats.length === 0) notFound();
  if (id === "new") {
    const cat = (await searchParams).category;
    return <DishForm id={null} categories={cats} allergens={ALLERGENS} tags={[...TAGS]} initial={{ categoryId: cats.find((c) => c.id === cat)?.id ?? cats[0].id }} />;
  }
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const d = await adminDish(s.venueId, id);
  if (!d) notFound();
  return (
    <DishForm
      id={d.id}
      categories={cats}
      allergens={ALLERGENS}
      tags={[...TAGS]}
      initial={{
        categoryId: d.categoryId, nameRu: d.nameRu, nameKy: d.nameKy ?? "", descriptionRu: d.descriptionRu ?? "", descriptionKy: d.descriptionKy ?? "",
        compositionRu: d.compositionRu ?? "", compositionKy: d.compositionKy ?? "", price: String(d.price), weight: d.weight ?? "",
        kcal: d.kcal?.toString() ?? "", protein: d.protein?.toString() ?? "", fat: d.fat?.toString() ?? "", carbs: d.carbs?.toString() ?? "",
        allergens: d.allergens, tags: d.tags, isSignature: d.isSignature, hitPinned: d.hitPinned, inStock: d.inStock, photoUrl: d.photoUrl,
      }}
    />
  );
}
