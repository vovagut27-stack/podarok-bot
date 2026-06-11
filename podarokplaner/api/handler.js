import { handleApiRequest } from '../bot/api-router.js';

function normalizeRequestBody(req) {
  const raw = req.body;
  if (raw == null || raw === '') return {};
  if (typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
  const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  req.body = normalizeRequestBody(req);

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
