const BOT_TOKEN = process.env.BOT_TOKEN;

async function tgApi(method, body) {
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

export function getCreatorId() {
  const id = parseInt(process.env.CREATOR_TELEGRAM_ID || '', 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function textAfterCommand(msg) {
  const text = (msg.text || msg.caption || '').replace(/^\uFEFF/, '').trim();
  const entity = msg.entities?.find(e => e.type === 'bot_command')
    || msg.caption_entities?.find(e => e.type === 'bot_command');
  if (entity && text) {
    return text.slice(entity.offset + entity.length).trim();
  }
  return text.replace(/^\/[^\s]+\s*/, '').trim();
}

export async function sendReportToCreator(from, messageText, source = 'bot') {
  const creatorId = getCreatorId();
  if (!creatorId) {
    const err = new Error('CREATOR_TELEGRAM_ID not configured');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  const body = messageText?.trim();
  if (!body) {
    const err = new Error('Empty report');
    err.code = 'EMPTY';
    throw err;
  }

  if (from.id === creatorId) {
    const err = new Error('Creator cannot report to self');
    err.code = 'SELF';
    throw err;
  }

  const name = from.first_name || 'User';
  const username = from.username ? `@${from.username}` : '—';

  await tgApi('sendMessage', {
    chat_id: creatorId,
    parse_mode: 'HTML',
    text:
      '📩 <b>Report / Репорт</b>\n' +
      `👤 ${escapeHtml(name)} (${escapeHtml(username)})\n` +
      `🆔 <code>${from.id}</code>\n` +
      `📍 ${escapeHtml(source)}\n\n` +
      escapeHtml(body.slice(0, 3500)),
  });
}

export async function sendPlainMessage(chatId, text) {
  await tgApi('sendMessage', { chat_id: chatId, text });
}
