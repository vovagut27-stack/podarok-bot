import crypto from 'crypto';
import {
  upsertUser,
  getUpcomingEvents,
  getUserCircles,
  getWishlistForCelebrant,
  getCirclePreview,
  getUser,
  setUserLocale,
  getUserLocale,
  isPremiumActive,
} from './database.js';
import { getDonattyPageUrl, appendDonateRow, donattyDonateKeyboard } from './donatty.js';
import { t, normalizeLocale, dateLocale, pluralDaysLabel } from './i18n.js';

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

export function parseCircleStartParam(param = '') {
  if (!param) return null;
  const cleaned = param.replace(/^circle_/, '');
  const id = parseInt(cleaned, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function botInviteUrl(circleId, botUsername) {
  const user = botUsername?.replace(/^@/, '');
  if (!user) return null;
  return `https://t.me/${user}?start=circle_${circleId}`;
}

async function resolveLocale(from) {
  await upsertUser(from.id, from.username, from.first_name, from.language_code);
  return getUserLocale(from.id, from.language_code);
}

function normalizeMessageText(text) {
  return (text || '').replace(/^\uFEFF/, '').trim();
}

function extractIncomingMessage(update) {
  return update.message ?? update.edited_message ?? update.business_message ?? null;
}

function getCommand(text) {
  const normalized = normalizeMessageText(text);
  if (!normalized.startsWith('/')) return '';
  return normalized.split(/\s/)[0].split('@')[0].toLowerCase();
}

function getCommandFromMessage(msg) {
  const text = normalizeMessageText(msg.text || msg.caption || '');
  const cmd = getCommand(text);
  if (cmd) return cmd;

  const entity = msg.entities?.find(e => e.type === 'bot_command')
    || msg.caption_entities?.find(e => e.type === 'bot_command');
  if (entity && text) {
    return text.slice(entity.offset, entity.offset + entity.length).split('@')[0].toLowerCase();
  }
  return '';
}

function matchesCommand(msg, ...names) {
  const cmd = getCommandFromMessage(msg);
  return names.some(n => cmd === n.toLowerCase());
}

function localeFromTelegram(from, dbUser) {
  if (dbUser?.locale === 'en' || dbUser?.locale === 'ru') return dbUser.locale;
  return from?.language_code?.startsWith('en') ? 'en' : 'ru';
}

function buildPremiumInvoiceBody(locale) {
  const stars = Math.max(1, parseInt(process.env.PREMIUM_STARS || '500', 10) || 500);
  return {
    stars,
    body: {
      title: t(locale, 'premium.invoiceTitle').slice(0, 32),
      description: t(locale, 'premium.invoiceDesc').slice(0, 255),
      payload: 'premium_monthly',
      currency: 'XTR',
      prices: [{ label: t(locale, 'premium.invoiceLabel').slice(0, 128), amount: stars }],
    },
  };
}

function formatMemberLine(m, locale) {
  const name = m.display_name || m.first_name || (m.username ? `@${m.username}` : t(locale, 'member.default'));
  const crown = m.role === 'admin' ? ' 👑' : '';
  const inBot = m.user_id ? '' : t(locale, 'member.nameOnly');
  return `• ${name}${crown}${inBot}`;
}

async function api(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) {
    const err = new Error(data.description || 'Telegram API error');
    err.telegram = data;
    throw err;
  }
  return data;
}

export async function sendMessage(chatId, text, options = {}) {
  try {
    return await api('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...options });
  } catch (err) {
    if (options.parse_mode !== false) {
      const plain = text.replace(/<[^>]+>/g, '');
      return api('sendMessage', { chat_id: chatId, text: plain, ...options, parse_mode: undefined });
    }
    throw err;
  }
}

async function sendMessagePlain(chatId, text, options = {}) {
  return api('sendMessage', { chat_id: chatId, text, ...options });
}

export async function answerCallbackQuery(callbackQueryId, text) {
  return api('answerCallbackQuery', { callback_query_id: callbackQueryId, text });
}

export async function setWebhook(url) {
  return api('setWebhook', {
    url: `${url}/webhook`,
    allowed_updates: ['message', 'edited_message', 'callback_query', 'pre_checkout_query', 'business_message'],
    drop_pending_updates: true,
  });
}

export async function registerBotCommands() {
  return api('setMyCommands', {
    commands: [
      { command: 'start', description: 'Начать / Start' },
      { command: 'circles', description: 'Мои круги / My circles' },
      { command: 'remind', description: 'Ближайшие события / Events' },
      { command: 'premium', description: 'Premium ⭐' },
      { command: 'donate', description: 'Поддержать / Donate' },
      { command: 'lang', description: 'Язык / Language' },
      { command: 'help', description: 'Помощь / Help' },
    ],
  });
}

export async function setChatMenuButton(chatId, webAppUrl, locale = 'ru') {
  return api('setChatMenuButton', {
    chat_id: chatId,
    menu_button: {
      type: 'web_app',
      text: t(locale, 'btn.menuCircles'),
      web_app: { url: webAppUrl },
    },
  });
}

function miniAppKeyboard(startParam = '', locale = 'ru') {
  return {
    inline_keyboard: [[
      {
        text: t(locale, 'btn.createCircle'),
        web_app: { url: webAppUrl(startParam) },
      },
    ]],
  };
}

function langKeyboard(activeLocale) {
  const loc = normalizeLocale(activeLocale);
  return {
    inline_keyboard: [[
      {
        text: loc === 'ru' ? '✓ 🇷🇺 Русский' : '🇷🇺 Русский',
        callback_data: 'lang:ru',
      },
      {
        text: loc === 'en' ? '✓ 🇬🇧 English' : '🇬🇧 English',
        callback_data: 'lang:en',
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

function formatEventLine(event, locale) {
  const days = daysUntil(event.event_date);
  const emoji = eventTypeEmoji(event.event_type);
  let daysText;
  if (days === 0) daysText = t(locale, 'event.today');
  else if (days === 1) daysText = t(locale, 'event.tomorrow');
  else daysText = t(locale, 'event.inDays', { n: days });
  return `${emoji} <b>${event.name}</b> — ${daysText} (${event.event_date})\n   ${t(locale, 'event.circle')}: ${event.circle_name}`;
}

function buildHelpText(locale) {
  const stars = parseInt(process.env.PREMIUM_STARS || '500', 10);
  return [
    t(locale, 'help.title'),
    '',
    t(locale, 'help.commands'),
    t(locale, 'help.cmdStart'),
    t(locale, 'help.cmdRemind'),
    t(locale, 'help.cmdCircles'),
    t(locale, 'help.cmdDonate'),
    t(locale, 'help.cmdPremium'),
    ...(locale === 'ru' ? [t(locale, 'help.cmdPremiumRu')] : []),
    t(locale, 'help.cmdLang'),
    t(locale, 'help.cmdHelp'),
    '',
    t(locale, 'help.howTitle'),
    t(locale, 'help.how1'),
    t(locale, 'help.how2'),
    t(locale, 'help.how3'),
    t(locale, 'help.how4'),
    t(locale, 'help.how5'),
    '',
    t(locale, 'help.premiumTitle', { stars }),
    t(locale, 'help.premium1'),
    t(locale, 'help.premium2'),
    t(locale, 'help.premium3'),
    '',
    t(locale, 'help.support'),
  ].join('\n');
}

export async function handleStart(msg) {
  const locale = await resolveLocale(msg.from);

  const rawParam = msg.text?.split(' ')[1] || '';
  const circleId = parseCircleStartParam(rawParam);
  const botUsername = process.env.BOT_USERNAME?.replace(/^@/, '');

  if (circleId) {
    const preview = await getCirclePreview(circleId);
    if (preview) {
      const memberLines = preview.members.map(m => formatMemberLine(m, locale)).join('\n');
      const inviteUrl = botInviteUrl(circleId, botUsername);
      const keyboard = {
        inline_keyboard: [[
          {
            text: t(locale, 'btn.joinCircle'),
            web_app: { url: webAppUrl(`circle_${circleId}`) },
          },
        ]],
      };
      if (inviteUrl) {
        keyboard.inline_keyboard.push([{
          text: t(locale, 'btn.shareInvite'),
          url: `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(t(locale, 'invite.shareText', { name: preview.circle.name }))}`,
        }]);
      }

      await setChatMenuButton(msg.chat.id, webAppUrl(`circle_${circleId}`), locale);
      await sendMessage(msg.chat.id,
        t(locale, 'invite.title', { name: preview.circle.name }) + '\n\n' +
        t(locale, 'invite.members', { count: preview.memberCount }) + '\n' +
        (memberLines || t(locale, 'invite.nobody')) + '\n\n' +
        t(locale, 'invite.hint'),
        { reply_markup: appendDonateRow(keyboard, locale) }
      );
      return;
    }
  }

  const webUrl = webAppUrl(circleId ? `circle_${circleId}` : '');
  await setChatMenuButton(msg.chat.id, webUrl, locale);

  await sendMessage(msg.chat.id,
    t(locale, 'start.welcome') + '\n\n' +
    t(locale, 'start.intro') + '\n\n' +
    t(locale, 'start.quickTitle') + '\n' +
    t(locale, 'start.step1') + '\n' +
    t(locale, 'start.step2') + '\n' +
    t(locale, 'start.step3') + '\n\n' +
    t(locale, 'start.inviteHint'),
    { reply_markup: appendDonateRow(miniAppKeyboard(circleId ? `circle_${circleId}` : '', locale), locale) }
  );
}

export async function handleDonate(msg) {
  const locale = await resolveLocale(msg.from);
  const url = getDonattyPageUrl();

  if (!url) {
    await sendMessage(msg.chat.id,
      t(locale, 'donate.noTitle') + '\n\n' +
      t(locale, 'donate.noPage') + '\n\n' +
      t(locale, 'donate.ownerHint', { url: process.env.DONATTY_SIGNUP_URL || 'https://donatty.com/creator_bots' }),
      { reply_markup: miniAppKeyboard('', locale) }
    );
    return;
  }

  await sendMessage(msg.chat.id,
    t(locale, 'donate.title') + '\n\n' + t(locale, 'donate.text'),
    { reply_markup: donattyDonateKeyboard(locale) }
  );
}

export async function handleRemind(msg) {
  const locale = await resolveLocale(msg.from);
  const events = await getUpcomingEvents(msg.from.id, 3);

  if (events.length === 0) {
    await sendMessage(msg.chat.id,
      t(locale, 'remind.empty'),
      { reply_markup: miniAppKeyboard('', locale) }
    );
    return;
  }

  const lines = events.map(e => formatEventLine(e, locale)).join('\n\n');
  await sendMessage(msg.chat.id,
    t(locale, 'remind.title') + '\n\n' + lines,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: t(locale, 'btn.openCalendar'), web_app: { url: webAppUrl('events') } },
        ]],
      },
    }
  );
}

export async function handleCircles(msg) {
  const locale = await resolveLocale(msg.from);
  const circles = await getUserCircles(msg.from.id);

  if (circles.length === 0) {
    await sendMessage(msg.chat.id,
      t(locale, 'circles.empty'),
      { reply_markup: miniAppKeyboard('', locale) }
    );
    return;
  }

  const lines = circles.map(c =>
    t(locale, 'circles.line', { name: c.name, members: c.member_count, events: c.event_count })
  ).join('\n');

  const buttons = circles.slice(0, 5).map(c => ([{
    text: c.name,
    web_app: { url: webAppUrl(`circle_${c.id}`) },
  }]));

  await sendMessage(msg.chat.id,
    t(locale, 'circles.title') + '\n\n' + lines,
    { reply_markup: { inline_keyboard: buttons } }
  );
}

export async function handleHelp(msg) {
  const locale = await resolveLocale(msg.from);
  await sendMessage(msg.chat.id,
    buildHelpText(locale),
    { reply_markup: appendDonateRow(miniAppKeyboard('', locale), locale) }
  );
}

export async function handleLang(msg) {
  const locale = await resolveLocale(msg.from);
  await sendMessage(msg.chat.id,
    t(locale, 'lang.title'),
    { reply_markup: langKeyboard(locale) }
  );
}

export async function handleCallbackQuery(query) {
  const data = query.data || '';

  if (data.startsWith('lang:')) {
    const next = normalizeLocale(data.split(':')[1]);
    await setUserLocale(query.from.id, next);
    await answerCallbackQuery(query.id, t(next, 'lang.changed'));
    await sendMessage(
      query.message.chat.id,
      next === 'en' ? t(next, 'lang.confirmEn') : t(next, 'lang.confirmRu'),
      { reply_markup: langKeyboard(next) }
    );
    await setChatMenuButton(query.message.chat.id, webAppUrl(), next);
    return;
  }

  await answerCallbackQuery(query.id);
}

export async function handlePreCheckoutQuery(query) {
  await api('answerPreCheckoutQuery', { pre_checkout_query_id: query.id, ok: true });
}

export async function handleSuccessfulPayment(msg) {
  const userId = msg.from.id;
  const locale = await getUserLocale(userId, msg.from.language_code);
  const until = new Date();
  until.setMonth(until.getMonth() + 1);
  const { setPremium } = await import('./database.js');
  await setPremium(userId, until.toISOString());

  await sendMessage(msg.chat.id,
    t(locale, 'premium.thanks') + '\n\n' +
    t(locale, 'premium.until', { date: until.toLocaleDateString(dateLocale(locale)) })
  );
}

export async function sendEventReminder(userId, event, daysBefore) {
  const user = await getUser(userId);
  const locale = normalizeLocale(user?.locale);
  const emoji = eventTypeEmoji(event.event_type);
  const celebrantName = event.celebrant_name || event.name;

  const { items } = await getWishlistForCelebrant(event.circle_id, celebrantName);

  let giftSection = '';
  const topItems = items.slice(0, 5);

  if (topItems.length > 0) {
    giftSection = '\n\n' + t(locale, 'reminder.giftIdeas') + '\n' +
      topItems.map((item, i) => {
        let line = `${i + 1}. ${item.title}`;
        if (item.price_range) line += ` (${item.price_range})`;
        return line;
      }).join('\n');
  } else {
    giftSection = '\n\n' + t(locale, 'reminder.emptyWishlist');
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
    text: t(locale, 'btn.openWishlist'),
    web_app: { url: webAppUrl(`circle_${event.circle_id}`) },
  }]);

  await sendMessage(userId,
    t(locale, 'reminder.body', {
      emoji,
      name: event.name,
      days: daysBefore,
      daysLabel: pluralDaysLabel(locale, daysBefore),
      date: event.event_date,
      circle: event.circle_name,
    }) + giftSection,
    { reply_markup: keyboard }
  );
}

export async function sendPremiumInvoice(chatId, userId, languageCode) {
  let locale = languageCode?.startsWith('en') ? 'en' : 'ru';
  if (userId) {
    try {
      locale = await getUserLocale(userId, languageCode);
    } catch { /* use telegram language */ }
  }
  return deliverPremiumPayment(chatId, locale);
}

async function deliverPremiumPayment(chatId, locale) {
  const { stars, body } = buildPremiumInvoiceBody(locale);
  const errors = [];

  try {
    return await api('sendInvoice', { chat_id: chatId, ...body });
  } catch (err) {
    errors.push(err.message);
    console.warn('[premium] sendInvoice failed:', err.message, err.telegram || '');
  }

  try {
    const link = await api('createInvoiceLink', body);
    const payUrl = link.result;
    if (!payUrl) throw new Error('Empty invoice link');

    await sendMessagePlain(chatId,
      `${t(locale, 'premium.payPrompt')}\n\n${payUrl}`,
      {
        reply_markup: {
          inline_keyboard: [[{
            text: t(locale, 'premium.payBtn', { stars }),
            url: payUrl,
          }]],
        },
      }
    );
    return link;
  } catch (err) {
    errors.push(err.message);
    console.error('[premium] createInvoiceLink failed:', err.message, err.telegram || '');
    const detail = errors.join(' | ') || err.message;
    const errObj = new Error(detail);
    errObj.telegram = err.telegram;
    throw errObj;
  }
}

export async function handlePremium(msg) {
  const locale = localeFromTelegram(msg.from);
  const chatId = msg.chat.id;

  upsertUser(msg.from.id, msg.from.username, msg.from.first_name, msg.from.language_code).catch(() => {});

  try {
    let dbUser = null;
    try {
      dbUser = await getUser(msg.from.id);
    } catch (err) {
      console.error('[premium] getUser failed:', err.message);
    }

    const activeLocale = localeFromTelegram(msg.from, dbUser);
    if (dbUser && isPremiumActive(dbUser)) {
      const until = dbUser.premium_until
        ? t(activeLocale, 'premium.alreadyActiveUntil', {
            date: new Date(dbUser.premium_until).toLocaleDateString(dateLocale(activeLocale)),
          })
        : t(activeLocale, 'premium.alreadyActive');
      await sendMessagePlain(chatId, until);
      return;
    }

    await sendMessagePlain(chatId, t(activeLocale, 'premium.processing'));
    await deliverPremiumPayment(chatId, activeLocale);
  } catch (err) {
    console.error('[premium]', err.message, err.telegram || '');
    let activeLocale = locale;
    try {
      activeLocale = await getUserLocale(msg.from.id, msg.from.language_code);
    } catch { /* ignore */ }
    await sendMessagePlain(chatId, t(activeLocale, 'premium.failed', {
      detail: err.message || 'Unknown error',
    }));
  }
}

export async function handleUpdate(update) {
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }

  if (update.pre_checkout_query) {
    await handlePreCheckoutQuery(update.pre_checkout_query);
    return;
  }

  if (update.message?.successful_payment) {
    await handleSuccessfulPayment(update.message);
    return;
  }
  if (update.business_message?.successful_payment) {
    await handleSuccessfulPayment(update.business_message);
    return;
  }

  const msg = extractIncomingMessage(update);
  if (!msg) return;

  const text = normalizeMessageText(msg.text || msg.caption || '');
  const cmd = getCommandFromMessage(msg);
  if (cmd) console.log('[bot] command:', cmd, 'from', msg.from?.id);

  if (matchesCommand(msg, '/start')) {
    await handleStart(msg);
  } else if (matchesCommand(msg, '/напомнить', '/remind')) {
    await handleRemind(msg);
  } else if (matchesCommand(msg, '/круги', '/circles')) {
    await handleCircles(msg);
  } else if (matchesCommand(msg, '/помощь', '/help')) {
    await handleHelp(msg);
  } else if (matchesCommand(msg, '/lang', '/language', '/язык')) {
    await handleLang(msg);
  } else if (matchesCommand(msg, '/premium', '/премиум')) {
    await handlePremium(msg);
  } else if (matchesCommand(msg, '/donate', '/donat')) {
    await handleDonate(msg);
  } else if (!text) {
    return;
  }
}
