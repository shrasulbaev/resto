import { LoginForm } from "./login-form";

export const metadata = { title: "Вход для заведения — resto" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold">Вход</h1>
        <p className="text-muted">Для владельца заведения</p>
      </div>
      <LoginForm />
      <a href="/staff" className="text-sm text-muted underline-offset-4 hover:underline">
        Я официант или повар
      </a>
    </main>
  );
}
