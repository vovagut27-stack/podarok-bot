import 'dotenv/config';
import { createApp } from './app.js';
import { startNotificationScheduler } from './notifications.js';

const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

const app = await createApp();

app.listen(PORT, async () => {
  console.log(`[server] Running on port ${PORT}`);

  if (WEBHOOK_URL && process.env.BOT_TOKEN) {
    const { setWebhook } = await import('./handlers.js');
    const result = await setWebhook(WEBHOOK_URL);
    console.log('[webhook] Set webhook:', result.ok ? 'OK' : result.description);
  } else {
    console.log('[webhook] WEBHOOK_URL not set — use polling or set env for production');
  }

  if (!process.env.VERCEL) {
    startNotificationScheduler();
  }
});
