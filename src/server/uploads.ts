import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { env } from "@/lib/env";
import { randomToken } from "@/lib/tokens";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const NAME = /^[A-Za-z0-9_-]+\.webp$/;

function dir() {
  return path.resolve(env().UPLOAD_DIR);
}

// Re-encodes every image to WebP (strips metadata, caps the size) and
// returns its public URL.
export async function saveImage(file: File, maxSide = 1600): Promise<string> {
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) throw new Error("bad_size");
  const input = Buffer.from(await file.arrayBuffer());
  const out = await sharp(input).rotate().resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const name = `${randomToken()}.webp`;
  await mkdir(dir(), { recursive: true });
  await writeFile(path.join(dir(), name), out);
  return `/uploads/${name}`;
}

export async function readImage(name: string) {
  if (!NAME.test(name)) return null;
  return readFile(path.join(dir(), name)).catch(() => null);
}
