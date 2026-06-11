export default function handler(_req, res) {
  res.status(200).json({
    ok: true,
    service: 'Подарок.бот',
    vercel: !!process.env.VERCEL,
    hasBotToken: !!process.env.BOT_TOKEN,
    hasTurso: !!process.env.TURSO_DATABASE_URL,
  });
}

export const config = { maxDuration: 10 };
