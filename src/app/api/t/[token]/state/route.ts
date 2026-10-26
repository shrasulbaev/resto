import { NextResponse } from "next/server";
import { guestState } from "@/server/tables";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const key = new URL(req.url).searchParams.get("key");
  const state = await guestState(token, key);
  if (!state) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(state, { headers: { "cache-control": "no-store" } });
}
