import { requirePlatform } from "@/server/session";
import { LogoutButton } from "@/components/logout-button";

export default async function PlatformHome() {
  await requirePlatform();
  return (
    <main className="p-8">
      <h1 className="text-2xl font-extrabold">Заведения</h1>
      <LogoutButton />
    </main>
  );
}
