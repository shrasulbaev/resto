import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { venues } from "@/db/schema";
import { adminTables, qrSvg } from "@/server/admin-venue";
import { requireOwner } from "@/server/session";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

// A4 sheet of table cards to print and cut out.
export default async function PrintQrPage() {
  const s = await requireOwner();
  const [venue] = await db().select().from(venues).where(eq(venues.id, s.venueId));
  const list = await adminTables(s.venueId);
  const cards = await Promise.all(list.map(async (t) => ({ id: t.id, number: t.number, svg: await qrSvg(t.token) })));
  return (
    <div className="min-h-dvh bg-white text-black">
      <div className="mx-auto flex max-w-[210mm] items-center justify-between p-4 print:hidden">
        <span className="font-bold">Карточки для столов: {cards.length}</span>
        <PrintButton />
      </div>
      <div className="mx-auto grid max-w-[210mm] grid-cols-3 gap-[6mm] p-[8mm]">
        {cards.map((c) => (
          <div key={c.id} className="flex break-inside-avoid flex-col items-center gap-[2mm] rounded-[4mm] border border-black/20 p-[4mm] text-center">
            <span className="text-[11pt] font-bold">{venue.name}</span>
            <div className="w-full" dangerouslySetInnerHTML={{ __html: c.svg }} />
            <span className="text-[20pt] font-extrabold leading-none">Стол {c.number}</span>
            <span className="text-[8pt] leading-tight">Меню и вызов официанта · Меню жана официантты чакыруу</span>
          </div>
        ))}
      </div>
    </div>
  );
}
