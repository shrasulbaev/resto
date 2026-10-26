"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { allowAttempt, authenticateStaff, authenticateUser } from "@/server/auth";
import { clearSession, setSession } from "@/server/session";

export type FormState = { error?: string };

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export async function loginUser(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  if (!allowAttempt(`user:${await clientIp()}`, 10)) return { error: "Слишком много попыток. Подождите минуту." };
  const session = await authenticateUser(email, password);
  if (!session || session.kind !== "user") return { error: "Неверная почта или пароль" };
  await setSession(session);
  redirect(session.role === "platform" ? "/platform" : "/admin");
}

export async function loginStaff(_: FormState, form: FormData): Promise<FormState> {
  const slug = String(form.get("slug") ?? "");
  const staffId = String(form.get("staffId") ?? "");
  const pin = String(form.get("pin") ?? "");
  if (!allowAttempt(`staff:${slug}:${await clientIp()}`)) return { error: "Слишком много попыток. Подождите минуту." };
  const session = await authenticateStaff(slug, staffId, pin);
  if (!session || session.kind !== "staff") return { error: "Неверный PIN" };
  await setSession(session);
  redirect(session.role === "kitchen" ? "/kitchen" : "/waiter");
}

export async function logout() {
  await clearSession();
  redirect("/");
}
