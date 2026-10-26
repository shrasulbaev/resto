import { readImage } from "@/server/uploads";

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const data = await readImage(name);
  if (!data) return new Response("not found", { status: 404 });
  // Names are random and never reused, so the file can be cached forever.
  return new Response(new Uint8Array(data), {
    headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable" },
  });
}
