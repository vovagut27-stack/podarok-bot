export default function handler(_req, res) {
  res.status(200).json({
    donateUrl: process.env.DONATTY_PAGE_URL?.trim() || '',
    donateSignupUrl: 'https://donatty.com/creator_bots',
    premiumStars: parseInt(process.env.PREMIUM_STARS || '500', 10),
  });
}

export const config = { maxDuration: 10 };
