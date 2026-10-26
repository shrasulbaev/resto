export function LogoutButton() {
  return (
    <form action="/logout" method="post">
      <button type="submit" className="text-sm font-semibold text-muted hover:text-text">
        Выйти
      </button>
    </form>
  );
}
