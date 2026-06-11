import cron from 'node-cron';
import {
  getEventsForNotification,
  getCircleMemberIds,
  wasNotificationSent,
  markNotificationSent,
} from './database.js';
import { sendEventReminder } from './handlers.js';

const REMINDER_DAYS = [7, 3, 1];

export function startNotificationScheduler() {
  cron.schedule('0 9 * * *', async () => {
    console.log('[notifications] Running daily reminder check...');
    await processReminders();
  }, { timezone: 'Europe/Moscow' });

  console.log('[notifications] Scheduler started (daily at 09:00 MSK)');
}

export async function processReminders() {
  for (const daysBefore of REMINDER_DAYS) {
    const events = await getEventsForNotification(daysBefore);

    for (const event of events) {
      const memberIds = await getCircleMemberIds(event.circle_id);

      for (const userId of memberIds) {
        if (userId === Number(event.celebrant_id)) continue;

        if (await wasNotificationSent(event.id, userId, daysBefore)) continue;

        try {
          await sendEventReminder(userId, event, daysBefore);
          await markNotificationSent(event.id, userId, daysBefore);
          console.log(`[notifications] Sent ${daysBefore}-day reminder for event ${event.id} to user ${userId}`);
        } catch (err) {
          console.error(`[notifications] Failed for event ${event.id}, user ${userId}:`, err.message);
        }
      }
    }
  }
}
