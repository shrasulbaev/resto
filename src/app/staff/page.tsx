import { redirect } from "next/navigation";
import { btnPrimary, input, label } from "@/lib/ui";

export const metadata = { title: "Вход для персонала — resto" };

async function go(form: FormData) {
  "use server";
  const code = String(form.get("code") ?? "").trim().toLowerCase();
  if (code) redirect(`/s/${encodeURIComponent(code)}`);
}

export default function StaffEntry() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold">Персонал</h1>
        <p className="text-muted">Введите код заведения. Его выдаёт администратор.</p>
      </div>
      <form action={go} className="flex flex-col gap-4">
        <label className={label}>
          Код заведения
          <input name="code" required placeholder="например, ala-too" className={input} />
        </label>
        <button type="submit" className={btnPrimary}>Дальше</button>
      </form>
    </main>
  );
}
