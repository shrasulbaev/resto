import { NextResponse } from "next/server";
import { recordInterest } from "@/server/menu";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json().catch(() => null);
  if (typeof body?.dishId !== "string") return NextResponse.json({ error: "bad request" }, { status: 400 });
  await recordInterest(token, body.dishId);
  return NextResponse.json({ ok: true });
}
