import { handleApiRequest } from '../bot/api-router.js';

export default async function handler(req, res) {
  const pathParam = req.query.path;
  const subpath = Array.isArray(pathParam) ? pathParam.join('/') : (pathParam || '');
  const path = '/api/' + subpath.replace(/^\/+/, '');

  try {
    await handleApiRequest(req, res, path);
  } catch (err) {
    console.error('[api]', path, err);
    res.status(500).json({ error: err.message });
  }
}

export const config = { maxDuration: 30 };
