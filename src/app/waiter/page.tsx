import { requireStaff } from "@/server/session";
import { LogoutButton } from "@/components/logout-button";

export default async function WaiterHome() {
  await requireStaff("waiter");
  return (
    <main className="p-6">
      <h1 className="text-2xl font-extrabold">Вызовы</h1>
      <LogoutButton />
    </main>
  );
}
