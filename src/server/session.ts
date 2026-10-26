import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_DAYS, signSession, verifySession, type Session } from "@/lib/session-token";

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export async function setSession(session: Session) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export type OwnerSession = Extract<Session, { kind: "user" }> & { venueId: string };
export type StaffSession = Extract<Session, { kind: "staff" }>;

export async function requireOwner(): Promise<OwnerSession> {
  const s = await getSession();
  if (s?.kind !== "user" || s.role !== "owner" || !s.venueId) redirect("/login");
  return s as OwnerSession;
}

export async function requirePlatform() {
  const s = await getSession();
  if (s?.kind !== "user" || s.role !== "platform") redirect("/login");
  return s;
}

export async function requireStaff(role: StaffSession["role"]): Promise<StaffSession> {
  const s = await getSession();
  if (s?.kind !== "staff" || s.role !== role) redirect("/staff");
  return s;
}
