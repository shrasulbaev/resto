import { TablesEditor } from "@/components/admin/tables-editor";
import { adminTables, qrSvg, tableUrl } from "@/server/admin-venue";
import { requireOwner } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function AdminTablesPage() {
  const s = await requireOwner();
  const list = await adminTables(s.venueId);
  const rows = await Promise.all(
    list.map(async (t) => ({ id: t.id, number: t.number, status: t.status, url: tableUrl(t.token), svg: await qrSvg(t.token) })),
  );
  return <TablesEditor tables={rows} />;
}
