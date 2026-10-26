import { randomBytes } from "node:crypto";

// URL-safe random token, used for table QR codes, guest keys and invites.
export function randomToken(bytes = 16): string {
  return randomBytes(bytes).toString("base64url");
}
