export default function handler(_req, res) {
  res.status(200).json({
    donateUrl: process.env.DONATTY_PAGE_URL?.trim() || '',
    donateSignupUrl: 'https://donatty.com/creator_bots',
    premiumStars: parseInt(process.env.PREMIUM_STARS || '500', 10),
    botUsername: process.env.BOT_USERNAME?.replace(/^@/, '') || '',
    reportEnabled: Boolean(process.env.CREATOR_TELEGRAM_ID?.trim()),
  });
}

export const config = { maxDuration: 10 };
