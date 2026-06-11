import { initDb } from '../podarokplaner/bot/database.js';
import { processReminders } from '../podarokplaner/bot/notifications.js';

export default async function handler(req, res) {
  const auth = req.headers.authorization;
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
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
