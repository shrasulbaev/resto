import { NextResponse } from "next/server";
import { getSession } from "@/server/session";

// Start page of the installed app: sends each person to their screen.
export async function GET(req: Request) {
  const s = await getSession();
  const to =
    s?.kind === "staff" ? (s.role === "kitchen" ? "/kitchen" : "/waiter")
    : s?.kind === "user" ? (s.role === "platform" ? "/platform" : "/admin")
    : "/staff";
  return NextResponse.redirect(new URL(to, req.url));
}
