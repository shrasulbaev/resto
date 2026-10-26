import { NextResponse } from "next/server";
import { z } from "zod";
import { guestCall } from "@/server/tables";

const body = z.object({
  key: z.string().max(64).nullish(),
  type: z.enum(["waiter", "bill", "container", "other"]),
  payment: z.enum(["cash", "card"]).optional(),
  comment: z.string().trim().max(200).optional(),
  selection: z
    .array(z.object({ dishId: z.string().uuid(), qty: z.number().int().min(1).max(50), comment: z.string().max(120).optional() }))
    .max(50)
    .optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  const { key, type, payment, comment, selection } = parsed.data;
  if (type === "other" && !comment) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  const result = await guestCall(token, { key, type, payload: { payment, comment, selection } });
  if (!result.ok && result.error === "not_found") return NextResponse.json(result, { status: 404 });
  return NextResponse.json(result);
}
