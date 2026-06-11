import { handleApiRequest } from '../podarokplaner/bot/api-router.js';

export default async function handler(req, res) {
  const slug = req.query.slug;
  const parts = Array.isArray(slug) ? slug : slug ? [slug] : [];
  const path = '/api/' + parts.join('/');

  try {
    await handleApiRequest(req, res, path);
  } catch (err) {
    console.error('[api]', path, err);
    res.status(500).json({ error: err.message });
  }
}

export const config = { maxDuration: 30 };
