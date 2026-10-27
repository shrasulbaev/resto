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

## Запуск в прод (любой VPS с Docker)

Нужен сервер с Docker (1 vCPU / 1 ГБ хватает для начала) и домен, указывающий на него (A-запись).

```bash
git clone <repo> resto && cd resto
cp .env.production.example .env
nano .env                      # домен, пароли, SESSION_SECRET (openssl rand -hex 32)
docker compose up -d --build
```

Что произойдёт:

- поднимутся Postgres, приложение и Caddy; Caddy сам получит HTTPS-сертификат для домена;
- при каждом старте применяются миграции базы;
- при первом старте создаётся админ платформы из `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD`.

Дальше: войдите на `https://ДОМЕН/login` админом платформы и создайте заведение — у него появятся
владелец (вход туда же), столы и код для входа персонала (`https://ДОМЕН/s/КОД`).

Push-уведомления персоналу: сгенерируйте ключи один раз и впишите в `.env`, затем `docker compose up -d`:

```bash
docker compose run --rm --no-deps app npx web-push generate-vapid-keys
```

На iPhone уведомления работают из приложения, добавленного на экран «Домой» (iOS 16.4+).

Telegram-журнал (необязательно): создайте бота у @BotFather, впишите `TELEGRAM_BOT_TOKEN`,
владелец подключает свой чат в «Настройки → Telegram-журнал».

Обновление: `git pull && docker compose up -d --build`.
Бэкап базы: `docker compose exec db pg_dump -U resto resto > backup.sql`.
Фото лежат в томе `uploads`, база — в томе `db`.

## Бесплатный тестовый сервер (Render)

Для проверки на пару дней: [развернуть на Render](https://render.com/deploy?repo=https://github.com/shrasulbaev/resto).
Render прочитает `render.yaml`, создаст сервер и базу, при первом запуске заполнит демо-кафе
(учётки ниже) и сам создаст ключи для push. Бесплатный сервер засыпает через 15 минут без
посетителей: первое открытие после паузы занимает около минуты. Загруженные фото не
переживают перезапуск. Для настоящей работы — `docker-compose.yml` выше.

## Демо-данные локально

```bash
npm run db:seed   # «Кафе Ала-Тоо»: admin@demo.kg / demo1234, официанты Айбек 1111 и Нурлан 2222, кухня 3333
```
