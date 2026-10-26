import { getSession } from "@/server/session";
import { sseResponse } from "@/server/realtime";

export const dynamic = "force-dynamic";

// Staff and owner screens get every event of their own venue.
export async function GET(req: Request) {
  const s = await getSession();
  const venueId = s?.kind === "staff" ? s.venueId : s?.kind === "user" ? s.venueId : null;
  if (!venueId) return new Response("unauthorized", { status: 401 });
  return sseResponse(req, venueId, (e) => e);
}
