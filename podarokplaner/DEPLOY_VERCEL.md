# Как выложить «Подарок.бот» на Vercel

Пошаговая инструкция для новичков. В конце у вас будет публичная ссылка вида  
`https://podarok-bot.vercel.app`

---

## Что такое Vercel и зачем он нужен

**Vercel** — бесплатный хостинг для сайтов и приложений. Вы загружаете код, Vercel сам его собирает и даёт вам ссылку в интернете.

Наше приложение состоит из двух частей:
- **Mini App** (интерфейс в браузере/Telegram) — статические файлы
- **API + бот** (сохранение данных, команды Telegram) — серверные функции

На Vercel нельзя хранить базу данных в файле на диске (она бы стиралась). Поэтому мы используем **Turso** — бесплатную облачную базу данных, совместимую с SQLite.

---

## Шаг 0. Что понадобится

- Аккаунт на [GitHub](https://github.com) (бесплатно)
- Аккаунт на [Vercel](https://vercel.com) (бесплатно, можно войти через GitHub)
- Аккаунт на [Turso](https://turso.tech) (бесплатно)
- Telegram-бот от [@BotFather](https://t.me/BotFather) (если ещё не создан)

---

## Шаг 1. Загрузите код на GitHub

### 1.1. Создайте репозиторий на GitHub

1. Откройте [github.com/new](https://github.com/new)
2. Название: `podarok-bot` (или любое)
3. Выберите **Private** или **Public**
4. Нажмите **Create repository**

### 1.2. Загрузите папку проекта

Откройте терминал в папке `podarokplaner` и выполните:

```bash
git init
git add .
git commit -m "Initial commit: Подарок.бот MVP"
git branch -M main
git remote add origin https://github.com/ВАШ_ЛОГИН/podarok-bot.git
git push -u origin main
```

Замените `ВАШ_ЛОГИН` на свой логин GitHub.

> **Совет:** если Git не установлен, скачайте [Git for Windows](https://git-scm.com/download/win) или загрузите файлы через кнопку «Upload files» на GitHub.

---

## Шаг 2. Создайте базу данных в Turso

### 2.1. Регистрация

1. Перейдите на [turso.tech](https://turso.tech)
2. Нажмите **Sign up** → войдите через GitHub

### 2.2. Создайте базу

1. В панели Turso нажмите **Create Database**
2. Имя: `podarok-bot`
3. Region: выберите ближайший (например, Frankfurt)
4. Нажмите **Create**

### 2.3. Скопируйте ключи

1. Откройте созданную базу
2. Вкладка **Connect** → скопируйте:
   - **Database URL** (начинается с `libsql://...`)
   - **Auth Token** (нажмите Create Token, если его нет)

Сохраните оба значения в блокнот — они понадобятся на шаге 4.

### 2.4. Инициализируйте таблицы

На своём компьютере в папке `podarokplaner` создайте файл `.env`:

```
TURSO_DATABASE_URL=libsql://ваша-база.turso.io
TURSO_AUTH_TOKEN=ваш_токен
```

Затем выполните:

```bash
npm install
npm run db:init
```

Должно появиться: `Database schema initialized successfully.`

---

## Шаг 3. Создайте Telegram-бота

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте `/newbot`
3. Имя бота: `Подарок.бот`
4. Username: `podarok_bot` (или другой свободный, должен заканчиваться на `_bot`)
5. **Сохраните токен** — длинная строка вида `7123456789:AAH...`

### Настройте бота (пока без URL — добавите после деплоя)

```
/setdescription → Планируй семейные подарки заранее
/setcommands →
start - Начать
remind - Ближайшие события
circles - Мои круги
help - Справка
premium - Premium
```

---

## Шаг 4. Деплой на Vercel

### 4.1. Подключите проект

1. Откройте [vercel.com/new](https://vercel.com/new)
2. Нажмите **Import** рядом с вашим репозиторием `podarok-bot`
3. **Root Directory** — нажмите Edit и укажите `podarokplaner` (если репозиторий содержит только эту папку — оставьте как есть)

### 4.2. Добавьте переменные окружения

Перед нажатием **Deploy**, раскройте **Environment Variables** и добавьте:

| Имя | Значение | Зачем |
|-----|----------|-------|
| `BOT_TOKEN` | токен от BotFather | бот в Telegram |
| `TURSO_DATABASE_URL` | `libsql://...` из Turso | база данных |
| `TURSO_AUTH_TOKEN` | токен из Turso | доступ к базе |
| `WEBHOOK_URL` | пока оставьте пустым | добавите после деплоя |
| `WEBAPP_URL` | пока оставьте пустым | добавите после деплоя |
| `CRON_SECRET` | любая длинная строка, напр. `my-secret-abc123xyz` | защита напоминаний |
| `PREMIUM_STARS` | `500` | цена Premium |
| `DEV_MODE` | `false` | отключить тестовый режим |

### 4.3. Запустите деплой

Нажмите **Deploy** и подождите 1–3 минуты.

Когда увидите **Congratulations!** — скопируйте ваш URL, например:  
`https://podarok-bot.vercel.app`

---

## Шаг 5. Подключите Telegram к Vercel

### 5.1. Обновите переменные на Vercel

1. Vercel → ваш проект → **Settings** → **Environment Variables**
2. Добавьте или обновите:
   - `WEBHOOK_URL` = `https://podarok-bot.vercel.app` (ваш URL **без** слэша в конце)
   - `WEBAPP_URL` = тот же URL
3. **Deployments** → три точки у последнего деплоя → **Redeploy** (чтобы переменные применились)

### 5.2. Зарегистрируйте webhook

Откройте в браузере (подставьте свой токен и URL):

```
https://api.telegram.org/botВАШ_ТОКЕН/setWebhook?url=https://podarok-bot.vercel.app/webhook
```

В ответе должно быть: `{"ok":true,...}`

### 5.3. Настройте Mini App в BotFather

1. [@BotFather](https://t.me/BotFather) → `/mybots` → ваш бот
2. **Bot Settings** → **Menu Button** → **Configure menu button**
3. URL: `https://podarok-bot.vercel.app`
4. Текст кнопки: `Мои круги`

Также: **Bot Settings** → **Configure Mini App** → URL: тот же.

---

## Шаг 6. Проверьте, что всё работает

### В браузере

Откройте: `https://podarok-bot.vercel.app`

> Mini App в браузере без Telegram покажет ошибку авторизации — это нормально. Полный интерфейс работает внутри Telegram.

Проверка API: `https://podarok-bot.vercel.app/api/health`  
Должно вернуть: `{"ok":true,"service":"Подарок.бот"}`

### В Telegram

1. Найдите своего бота
2. Отправьте `/start`
3. Нажмите **Создать семейный круг** — откроется Mini App
4. Создайте круг и добавьте событие

---

## Шаг 7. Как обновлять приложение

После изменений в коде:

```bash
git add .
git commit -m "Описание изменений"
git push
```

Vercel автоматически пересоберёт и опубликует новую версию за 1–2 минуты.

---

## Частые проблемы

### «Unauthorized» в Mini App
- Убедитесь, что `DEV_MODE=false` на Vercel
- Mini App нужно открывать **из Telegram**, не из обычного браузера

### Бот не отвечает
- Проверьте webhook:  
  `https://api.telegram.org/botТОКЕН/getWebhookInfo`
- `url` должен быть ваш Vercel URL + `/webhook`
- Проверьте, что `BOT_TOKEN` правильный в Vercel

### Данные не сохраняются
- Проверьте `TURSO_DATABASE_URL` и `TURSO_AUTH_TOKEN`
- Запустите `npm run db:init` локально с теми же ключами

### Ошибка при деплое
- Убедитесь, что **Root Directory** = `podarokplaner`
- Проверьте логи: Vercel → Deployments → ваш деплой → **Building**

---

## Схема: как всё связано

```
Пользователь в Telegram
        │
        ▼
   Telegram Bot  ──webhook──►  Vercel (/webhook)
        │                           │
        │                           ├── API (/api/...)
        ▼                           │
   Mini App  ◄──открывается──►  Vercel (сайт)
                                    │
                                    ▼
                              Turso (база данных)
```

---

## Стоимость

| Сервис | Бесплатный лимит |
|--------|------------------|
| Vercel | 100 GB трафика/мес, достаточно для MVP |
| Turso | 500 MB базы, 1 млрд строк чтения/мес |
| Telegram Bot | бесплатно |

Для семейного MVP этого более чем достаточно.
