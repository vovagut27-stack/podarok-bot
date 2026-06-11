export default async function handler(_req, res) {
  return res.status(200).json({
    ok: true,
    service: 'Подарок.бот',
    hasBotToken: !!process.env.BOT_TOKEN,
    hasTurso: !!process.env.TURSO_DATABASE_URL,
  });
}

export const config = { maxDuration: 10 };
