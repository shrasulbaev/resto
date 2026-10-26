import { jwtVerify, SignJWT } from "jose";
import { env } from "./env";

export type Session =
  | { kind: "user"; userId: string; role: "owner" | "platform"; venueId: string | null }
  | { kind: "staff"; staffId: string; role: "waiter" | "kitchen"; venueId: string };

export const SESSION_COOKIE = "resto_session";
export const SESSION_DAYS = 30;

function key() {
  return new TextEncoder().encode(env().SESSION_SECRET);
}

export async function signSession(session: Session): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (payload.kind === "user" || payload.kind === "staff") return payload as unknown as Session;
    return null;
  } catch {
    return null;
  }
}
