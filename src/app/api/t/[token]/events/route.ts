import { findTableByToken } from "@/server/menu";
import { sseResponse } from "@/server/realtime";

export const dynamic = "force-dynamic";

// Guests only learn that their table changed; they then refetch the state.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findTableByToken(token);
  if (!found) return new Response("not found", { status: 404 });
  const tableId = found.table.id;
  return sseResponse(req, found.venue.id, (e) => {
    if (e.type === "menu") return { type: "menu" };
    if ("tableId" in e && e.tableId === tableId) return { type: "table" };
    return null;
  });
}
