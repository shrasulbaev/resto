import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  // Photos, logos and backgrounds are stored on disk (a Docker volume in production).
  UPLOAD_DIR: z.string().default("./uploads"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

// Read lazily so `next build` works without a database configured.
export function env(): Env {
  cached ??= schema.parse(process.env);
  return cached;
}
