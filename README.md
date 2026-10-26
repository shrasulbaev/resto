# resto

QR-меню для заведений: гость открывает меню по QR-коду на столе и зовёт официанта,
официант ведёт заказы в веб-приложении, кухня отмечает готовые блюда, админ
управляет меню и смотрит статистику.

## Разработка

Нужны Node.js 22 и Postgres 16.

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d   # или свой Postgres
npm install
npm run db:migrate
npm run dev
```

Проверки перед слиянием в `master`:

```bash
npm run check   # lint + typecheck + тесты
npm run build
```

Тесты используют базу из `.env.test` (`resto_test`).
