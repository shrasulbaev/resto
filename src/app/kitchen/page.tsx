import { requireStaff } from "@/server/session";
import { LogoutButton } from "@/components/logout-button";

export default async function KitchenHome() {
  await requireStaff("kitchen");
  return (
    <main className="p-6">
      <h1 className="text-2xl font-extrabold">Кухня</h1>
      <LogoutButton />
    </main>
  );
}
