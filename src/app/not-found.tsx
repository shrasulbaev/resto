export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-2 px-6 text-center">
      <h1 className="text-2xl font-extrabold">Страница не найдена</h1>
      <p className="text-muted">Возможно, QR-код устарел. Отсканируйте код на столе ещё раз.</p>
    </main>
  );
}
