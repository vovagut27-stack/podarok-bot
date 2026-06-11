import crypto from 'crypto';
import {
  upsertUser,
  getUpcomingEvents,
  getUserCircles,
  getWishlistForCelebrant,
} from './database.js';

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || process.env.WEBHOOK_URL || 'http://localhost:3000';

export function validateInitData(initData) {
  if (!initData || !BOT_TOKEN) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN)
    .digest();

  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (calculatedHash !== hash) return null;

  const authDate = parseInt(params.get('auth_date') || '0', 10);
  if (Date.now() / 1000 - authDate > 86400) return null;

  const userStr = params.get('user');
  if (!userStr) return null;

  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function webAppUrl(startParam = '') {
  const base = WEBAPP_URL.replace(/\/$/, '');
  return startParam ? `${base}?startapp=${startParam}` : base;
}

async function api(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function sendMessage(chatId, text, options = {}) {
  return api('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...options });
}

export async function answerCallbackQuery(callbackQueryId, text) {
  return api('answerCallbackQuery', { callback_query_id: callbackQueryId, text });
}

export async function setWebhook(url) {
  return api('setWebhook', {
    url: `${url}/webhook`,
    allowed_updates: ['message', 'callback_query', 'pre_checkout_query'],
    drop_pending_updates: true,
  });
}

export async function setChatMenuButton(chatId, webAppUrl) {
  return api('setChatMenuButton', {
    chat_id: chatId,
    menu_button: {
      type: 'web_app',
      text: 'Мои круги',
      web_app: { url: webAppUrl },
    },
  });
}

function miniAppKeyboard(startParam = '') {
  return {
    inline_keyboard: [[
      {
        text: '🎁 Создать круг',
        web_app: { url: webAppUrl(startParam) },
      },
    ]],
  };
}

function eventTypeEmoji(type) {
  const map = { birthday: '🎂', anniversary: '💍', holiday: '🎄', other: '📅' };
  return map[type] || '📅';
}

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const event = new Date(dateStr + 'T00:00:00');
  return Math.ceil((event - today) / (1000 * 60 * 60 * 24));
}

function formatEventLine(event) {
  const days = daysUntil(event.event_date);
  const emoji = eventTypeEmoji(event.event_type);
  const daysText = days === 0 ? 'сегодня' : days === 1 ? 'завтра' : `через ${days} дн.`;
  return `${emoji} <b>${event.name}</b> — ${daysText} (${event.event_date})\n   Круг: ${event.circle_name}`;
}

export async function handleStart(msg) {
  const user = msg.from;
  await upsertUser(user.id, user.username, user.first_name);

  const startParam = msg.text?.split(' ')[1] || '';
  const webUrl = webAppUrl(startParam ? `circle_${startParam.replace('circle_', '')}` : '');

  await setChatMenuButton(msg.chat.id, webUrl);

  await sendMessage(msg.chat.id,
    `🎁 <b>Добро пожаловать в Подарок.бот!</b>\n\n` +
    `Планируй подарки заранее — для друзей, близких и коллег. Не забывай о важных датах и всегда знай, что подарить.\n\n` +
    `<b>Быстрый старт:</b>\n` +
    `1️⃣ Создай круг подарков\n` +
    `2️⃣ Добавь людей и их даты\n` +
    `3️⃣ Получай напоминания с идеями подарков`,
    { reply_markup: miniAppKeyboard(startParam) }
  );
}

export async function handleRemind(msg) {
  const userId = msg.from.id;
  await upsertUser(userId, msg.from.username, msg.from.first_name);

  const events = await getUpcomingEvents(userId, 3);

  if (events.length === 0) {
    await sendMessage(msg.chat.id,
      '📭 Ближайших событий пока нет.\n\nДобавьте дни рождения в Mini App!',
      { reply_markup: miniAppKeyboard() }
    );
    return;
  }

  const lines = events.map(formatEventLine).join('\n\n');
  await sendMessage(msg.chat.id,
    `📅 <b>Ближайшие события:</b>\n\n${lines}`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '📱 Открыть календарь', web_app: { url: webAppUrl('events') } },
        ]],
      },
    }
  );
}

export async function handleCircles(msg) {
  const userId = msg.from.id;
  await upsertUser(userId, msg.from.username, msg.from.first_name);

  const circles = await getUserCircles(userId);

  if (circles.length === 0) {
    await sendMessage(msg.chat.id,
      '👥 У вас пока нет кругов.\n\nСоздайте первый!',
      { reply_markup: miniAppKeyboard() }
    );
    return;
  }

  const lines = circles.map(c =>
    `• <b>${c.name}</b> — ${c.member_count} чел., ${c.event_count} событий`
  ).join('\n');

  const buttons = circles.slice(0, 5).map(c => ([{
    text: c.name,
    web_app: { url: webAppUrl(`circle_${c.id}`) },
  }]));

  await sendMessage(msg.chat.id,
    `👥 <b>Ваши круги:</b>\n\n${lines}`,
    { reply_markup: { inline_keyboard: buttons } }
  );
}

export async function handleHelp(msg) {
  await sendMessage(msg.chat.id,
    `❓ <b>Помощь — Подарок.бот</b>\n\n` +
    `<b>Команды:</b>\n` +
    `/start — начать работу\n` +
    `/напомнить — ближайшие 3 события\n` +
    `/круги — ваши круги подарков\n` +
    `/помощь — эта справка\n\n` +
    `<b>Как это работает:</b>\n` +
    `• Создайте круг и добавьте людей\n` +
    `• Укажите дни рождения и другие даты\n` +
    `• Заполните wishlist — список желаемых подарков\n` +
    `• Бот напомнит за 7, 3 и 1 день до события\n\n` +
    `<b>Премиум (500 ⭐/мес):</b>\n` +
    `• Безлимитные круги\n` +
    `• Расширенная аналитика\n` +
    `• Кастомные напоминания\n\n` +
    `Поддержка: @podarok_bot_support`,
    { reply_markup: miniAppKeyboard() }
  );
}

export async function handlePreCheckoutQuery(query) {
  await api('answerPreCheckoutQuery', { pre_checkout_query_id: query.id, ok: true });
}

export async function handleSuccessfulPayment(msg) {
  const userId = msg.from.id;
  const until = new Date();
  until.setMonth(until.getMonth() + 1);
  const { setPremium } = await import('./database.js');
  await setPremium(userId, until.toISOString());

  await sendMessage(msg.chat.id,
    `⭐ <b>Спасибо за Premium!</b>\n\n` +
    `Теперь у вас безлимитные круги и все премиум-функции до ${until.toLocaleDateString('ru-RU')}.`
  );
}

export async function sendEventReminder(userId, event, daysBefore) {
  const emoji = eventTypeEmoji(event.event_type);
  const celebrantName = event.celebrant_name || event.name;

  const { items } = await getWishlistForCelebrant(event.circle_id, celebrantName);

  let giftSection = '';
  const topItems = items.slice(0, 5);

  if (topItems.length > 0) {
    giftSection = '\n\n<b>💡 Идеи подарков:</b>\n' +
      topItems.map((item, i) => {
        let line = `${i + 1}. ${item.title}`;
        if (item.price_range) line += ` (${item.price_range})`;
        return line;
      }).join('\n');
  } else {
    giftSection = '\n\n<i>Wishlist пока пуст — спросите именинника!</i>';
  }

  const keyboard = { inline_keyboard: [] };

  topItems.slice(0, 3).forEach(item => {
    if (item.url) {
      keyboard.inline_keyboard.push([{
        text: `🛒 ${item.title.substring(0, 30)}`,
        url: item.url,
      }]);
    }
  });

  keyboard.inline_keyboard.push([{
    text: '📋 Открыть wishlist',
    web_app: { url: webAppUrl(`circle_${event.circle_id}`) },
  }]);

  await sendMessage(userId,
    `${emoji} <b>${event.name}</b> через ${daysBefore} ${daysBefore === 1 ? 'день' : 'дня/дней'}!\n\n` +
    `📅 Дата: ${event.event_date}\n` +
    `👨‍👩‍👧‍👦 Круг: ${event.circle_name}` +
    giftSection,
    { reply_markup: keyboard }
  );
}

export async function sendPremiumInvoice(chatId) {
  const stars = parseInt(process.env.PREMIUM_STARS || '500', 10);
  return api('sendInvoice', {
    chat_id: chatId,
    title: 'Подарок.бот Premium',
    description: 'Безлимитные круги, аналитика подарков, кастомные напоминания',
    payload: 'premium_monthly',
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: 'Premium на 1 месяц', amount: stars }],
  });
}

export async function handleUpdate(update) {
  if (update.pre_checkout_query) {
    await handlePreCheckoutQuery(update.pre_checkout_query);
    return;
  }

  if (update.message?.successful_payment) {
    await handleSuccessfulPayment(update.message);
    return;
  }

  const msg = update.message;
  if (!msg?.text) return;

  const text = msg.text.trim();

  if (text.startsWith('/start')) {
    await handleStart(msg);
  } else if (text.startsWith('/напомнить') || text.startsWith('/remind')) {
    await handleRemind(msg);
  } else if (text.startsWith('/круги') || text.startsWith('/circles')) {
    await handleCircles(msg);
  } else if (text.startsWith('/помощь') || text.startsWith('/help')) {
    await handleHelp(msg);
  } else if (text.startsWith('/premium')) {
    await sendPremiumInvoice(msg.chat.id);
  }
}
