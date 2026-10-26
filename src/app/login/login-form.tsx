"use client";

import { useActionState } from "react";
import { loginUser, type FormState } from "@/app/actions/auth";
import { btnPrimary, input, label } from "@/lib/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(loginUser, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className={label}>
        Почта
        <input name="email" type="email" required autoComplete="email" className={input} />
      </label>
      <label className={label}>
        Пароль
        <input name="password" type="password" required autoComplete="current-password" className={input} />
      </label>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button type="submit" disabled={pending} className={btnPrimary}>
        Войти
      </button>
    </form>
  );
}
