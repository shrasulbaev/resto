import { requireOwner } from "@/server/session";
import { LogoutButton } from "@/components/logout-button";

export default async function AdminHome() {
  await requireOwner();
  return (
    <main className="p-8">
      <h1 className="text-2xl font-extrabold">Админка</h1>
      <LogoutButton />
    </main>
  );
}
