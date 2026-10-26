import { notFound } from "next/navigation";
import { LiveRefresh } from "@/components/live-refresh";
import { WaiterTableScreen, type PickerDish } from "@/components/waiter/table-screen";
import { guestMenu } from "@/server/menu";
import { requireStaff } from "@/server/session";
import { waiterTable } from "@/server/waiter";

export const dynamic = "force-dynamic";

export default async function WaiterTablePage({ params }: { params: Promise<{ tableId: string }> }) {
  const s = await requireStaff("waiter");
  const { tableId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(tableId)) notFound();
  const [data, menu] = await Promise.all([waiterTable(s.venueId, tableId), guestMenu(s.venueId)]);
  if (!data) notFound();

  const dishes: PickerDish[] = menu.flatMap((c) =>
    c.dishes.map((d) => ({ id: d.id, name: d.nameRu, price: d.price, category: c.nameRu, self: d.tags.includes("self") })),
  );
  const names = new Map(dishes.map((d) => [d.id, d.name]));

  return (
    <>
      <LiveRefresh alertOn={["item_ready"]} />
      <WaiterTableScreen
        table={{ id: data.table.id, number: data.table.number }}
        visit={data.visit ? { id: data.visit.id, status: data.visit.status, mine: data.visit.waiterId === s.staffId, waiterName: data.waiterName } : null}
        calls={data.calls.map((c) => ({
          id: c.id,
          tableId: c.tableId,
          tableNumber: data.table.number,
          type: c.type,
          status: c.status,
          payload: { ...c.payload, selection: c.status === "new" || c.status === "accepted" ? c.payload.selection : undefined },
          attempt: c.attempt,
          createdAt: c.createdAt.toISOString(),
          escalated: false,
          selectionNames: (c.payload.selection ?? []).map((i) => `${names.get(i.dishId) ?? "—"} × ${i.qty}${i.comment ? ` (${i.comment})` : ""}`),
        }))}
        items={data.items.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, comment: i.comment, status: i.status, sent: !!i.sentAt }))}
        total={data.order?.total ?? 0}
        dishes={dishes}
      />
    </>
  );
}
