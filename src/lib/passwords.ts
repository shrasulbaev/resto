import bcrypt from "bcryptjs";

export function hashSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, 10);
}

export function verifySecret(secret: string, hash: string): Promise<boolean> {
  return bcrypt.compare(secret, hash);
}
