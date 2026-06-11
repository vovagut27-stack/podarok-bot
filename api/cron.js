import { initDb } from '../podarokplaner/bot/database.js';
import { processReminders } from '../podarokplaner/bot/notifications.js';

export default async function handler(req, res) {
  const auth = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (process.env.VERCEL) {
    if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  } else if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await initDb();
    await processReminders();
    res.json({ ok: true });
  } catch (err) {
    console.error('[cron] Error:', err);
    res.status(500).json({ error: err.message });
  }
}

export const config = { maxDuration: 60 };
