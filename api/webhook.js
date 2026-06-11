import { initDb } from '../podarokplaner/bot/database.js';
import { handleUpdate } from '../podarokplaner/bot/handlers.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, service: 'Подарок.бот webhook' });
  }

  if (!process.env.BOT_TOKEN) {
    console.error('[webhook] BOT_TOKEN missing');
    return res.status(500).json({ error: 'BOT_TOKEN not configured' });
  }

  try {
    await initDb();
    await handleUpdate(req.body);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[webhook]', err);
    return res.status(200).json({ ok: true });
  }
}

export const config = { maxDuration: 30 };
