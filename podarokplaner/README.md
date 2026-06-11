# Подарок.бот

Семейный wishlist-бот для Telegram с Mini App для планирования подарков.

## Стек

- **Backend:** Node.js + Express + SQLite
- **Bot:** Telegram Bot API (webhook)
- **Mini App:** React + Vite
- **Payments:** Telegram Stars (XTR)

## Быстрый старт

### 1. Создайте бота

1. Откройте [@BotFather](https://t.me/BotFather)
2. `/newbot` → имя: `Подарок.бот`, username: `@podarok_bot`
3. Сохраните токен
4. Установите команды:
   ```
   start - Начать работу
   remind - Ближайшие события
   circles - Мои семейные круги
   help - Справка
   premium - Оформить Premium
   ```
5. Описание: `Планируй семейные подарки заранее`
6. Menu Button → Web App → URL вашего сервера

### 2. Настройка

```bash
cd podarokplaner
cp .env.example .env
# Отредактируйте .env — добавьте BOT_TOKEN и WEBHOOK_URL
```

### 3. Установка и сборка

```bash
npm run setup
```

### 4. Запуск

```bash
npm start
```

Сервер слушает порт `3000` (или `PORT` из `.env`):
- `POST /webhook` — Telegram updates
- `GET /api/*` — Mini App API
- `GET /*` — Mini App (React)

### 5. Webhook (production)

Укажите в `.env`:
```
BOT_TOKEN=123456:ABC...
WEBHOOK_URL=https://your-domain.com
WEBAPP_URL=https://your-domain.com
PORT=3000
PREMIUM_STARS=500
```

При старте сервер автоматически вызовет `setWebhook`.

Для локальной разработки используйте [ngrok](https://ngrok.com):
```bash
ngrok http 3000
# WEBHOOK_URL=https://xxxx.ngrok.io
```

## Структура

```
podarokplaner/
├── bot/
│   ├── index.js          # Express + webhook + API
│   ├── handlers.js       # Команды бота
│   ├── notifications.js  # Напоминания (cron)
│   └── database.js       # SQLite
├── webapp/               # React Mini App
├── database.sql          # Схема БД
└── package.json
```

## Команды бота

| Команда | Описание |
|---------|----------|
| `/start` | Приветствие + кнопка «Создать круг» |
| `/напомнить` | Ближайшие 3 события |
| `/круги` | Список семейных кругов |
| `/premium` | Оплата Premium через Stars |
| `/помощь` | FAQ |

## User Journey

1. `/start` → «Создать семейный круг» → Mini App
2. Создать круг, добавить участников и даты рождения
3. Заполнить wishlist желаемых подарков
4. Получать напоминания за 7, 3 и 1 день до события с идеями подарков

## Premium

- Бесплатно: до 3 семейных кругов
- Premium (500 ⭐/мес): безлимитные круги, аналитика, кастомные напоминания

## Deep Links

```
t.me/podarok_bot/app?startapp=circle_{id}
```

## Лицензия

MIT
