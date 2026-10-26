import { MenuEditor } from "@/components/admin/menu-editor";
import { adminMenu } from "@/server/admin-menu";
import { requireOwner } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function AdminMenuPage() {
  const s = await requireOwner();
  const menu = await adminMenu(s.venueId);
  return (
    <MenuEditor
      categories={menu.map((c) => ({
        id: c.id,
        nameRu: c.nameRu,
        nameKy: c.nameKy ?? "",
        dishes: c.dishes.map((d) => ({
          id: d.id, name: d.nameRu, price: d.price, photoUrl: d.photoUrl, inStock: d.inStock, hitPinned: d.hitPinned,
          isSignature: d.isSignature, missingKy: !d.nameKy,
        })),
      }))}
    />
  );
}
