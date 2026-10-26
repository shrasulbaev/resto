"use client";

import { useActionState, useState } from "react";
import { loginStaff, type FormState } from "@/app/actions/auth";
import { btnPrimary } from "@/lib/ui";

type Person = { id: string; name: string; role: "waiter" | "kitchen" };

const ROLE: Record<Person["role"], string> = { waiter: "Официант", kitchen: "Кухня" };

export function PinLogin({ slug, people }: { slug: string; people: Person[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginStaff, {});
  const [who, setWho] = useState<Person | null>(null);
  const [pin, setPin] = useState("");

  if (!who) {
    return (
      <ul className="flex flex-col gap-2">
        {people.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setWho(p)}
              className="flex h-16 w-full items-center justify-between rounded-2xl bg-surface px-5 text-left"
            >
              <span className="text-lg font-bold">{p.name}</span>
              <span className="text-sm text-muted">{ROLE[p.role]}</span>
            </button>
          </li>
        ))}
        {people.length === 0 && <li className="text-muted">Сотрудники ещё не добавлены</li>}
      </ul>
    );
  }

  const press = (d: string) => setPin((p) => (p.length < 6 ? p + d : p));

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="staffId" value={who.id} />
      <input type="hidden" name="pin" value={pin} />
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold">{who.name}</span>
        <button type="button" onClick={() => { setWho(null); setPin(""); }} className="text-sm text-muted">
          Сменить
        </button>
      </div>
      <div aria-label="Введённый PIN" className="flex justify-center gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className={`h-4 w-4 rounded-full ${i < pin.length ? "bg-accent" : "bg-surface-2"}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className="h-16 rounded-2xl bg-surface text-2xl font-bold">
            {d}
          </button>
        ))}
        <button type="button" onClick={() => setPin("")} className="h-16 rounded-2xl text-sm text-muted">
          Стереть
        </button>
        <button type="button" onClick={() => press("0")} className="h-16 rounded-2xl bg-surface text-2xl font-bold">
          0
        </button>
        <span />
      </div>
      {state.error && <p role="alert" className="text-center text-sm text-danger">{state.error}</p>}
      <button type="submit" disabled={pending || pin.length < 4} className={btnPrimary}>
        Войти
      </button>
    </form>
  );
}
