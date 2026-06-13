import { initDb } from './database.js';
import { validateInitData, sendPremiumInvoice } from './handlers.js';
import {
  upsertUser,
  getUser,
  setUserLocale,
  canCreateCircle,
  createCircle,
  getUserCircles,
  getCircle,
  getCircleMembers,
  getCirclePreview,
  addCircleContact,
  joinCircle,
  isCircleMember,
  removeMemberFromCircle,
  createEvent,
  getCircleEvents,
  getUpcomingEvents,
  getEvent,
  getOrCreateWishlist,
  getMemberWishlist,
  getCircleMemberWishlists,
  getWishlistById,
  getWishlistItemWithOwner,
  getWishlistItems,
  addWishlistItem,
  updateWishlistItem,
  deleteWishlistItem,
  deleteEvent,
  getGiftStats,
} from './database.js';

function json(res, status, data) {
  res.status(status).json(data);
}

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

function authenticate(req, res) {
  const initData = req.headers['x-telegram-init-data'] || req.body?.initData;
  let user = validateInitData(initData);
  if (!user && process.env.DEV_MODE === 'true') {
    user = { id: 999999, username: 'dev_user', first_name: 'Тестовый пользователь' };
  }
  if (!user) {
    json(res, 401, { error: 'Unauthorized' });
    return null;
  }
  return user;
}

function queryParam(req, key) {
  const fromQuery = req.query?.[key];
  if (fromQuery != null && fromQuery !== '') {
    return Array.isArray(fromQuery) ? fromQuery[0] : fromQuery;
  }
  const rawUrl = req.url || '';
  const idx = rawUrl.indexOf('?');
  if (idx === -1) return null;
  return new URLSearchParams(rawUrl.slice(idx + 1)).get(key);
}

export async function handleApiRequest(req, res, path) {
  await initDb();

  req.body = normalizeRequestBody(req);

  const method = req.method;
  const user = authenticate(req, res);
  if (!user) return;

  // GET /api/bootstrap — один запрос вместо трёх при старте Mini App
  if (method === 'GET' && path === '/api/bootstrap') {
    await upsertUser(user.id, user.username, user.first_name, user.language_code);
    const dbUser = await getUser(user.id);
    const [circles, events] = await Promise.all([
      getUserCircles(user.id),
      getUpcomingEvents(user.id, 50),
    ]);
    return json(res, 200, { user: dbUser, circles, events });
  }

  // GET /api/me
  if (method === 'GET' && path === '/api/me') {
    await upsertUser(user.id, user.username, user.first_name, user.language_code);
    const dbUser = await getUser(user.id);
    return json(res, 200, {
      user: dbUser,
      stats: await getGiftStats(user.id),
    });
  }

  // POST /api/me/locale
  if (method === 'POST' && path === '/api/me/locale') {
    const { locale } = req.body || {};
    if (locale !== 'ru' && locale !== 'en') {
      return json(res, 400, { error: 'Invalid locale' });
    }
    await upsertUser(user.id, user.username, user.first_name, user.language_code);
    await setUserLocale(user.id, locale);
    const dbUser = await getUser(user.id);
    return json(res, 200, { locale: dbUser.locale });
  }

  // GET /api/circles
  if (method === 'GET' && path === '/api/circles') {
    return json(res, 200, await getUserCircles(user.id));
  }

  // POST /api/circles
  if (method === 'POST' && path === '/api/circles') {
    const { name, members } = req.body || {};
    if (!name?.trim()) return json(res, 400, { error: 'Название круга обязательно' });
    if (!(await canCreateCircle(user.id))) {
      return json(res, 403, {
        error: 'Лимит бесплатных кругов (3). Оформите Premium!',
        premiumRequired: true,
      });
    }
    const circle = await createCircle(name.trim(), user.id);
    if (Array.isArray(members)) {
      for (const m of members) {
        if (m.name?.trim()) await addCircleContact(circle.id, m.name.trim());
      }
    }
    return json(res, 200, circle);
  }

  // GET /api/events/upcoming
  if (method === 'GET' && path === '/api/events/upcoming') {
    return json(res, 200, await getUpcomingEvents(user.id, 50));
  }

  // GET /api/circles/:id/preview
  let m = path.match(/^\/api\/circles\/(\d+)\/preview$/);
  if (method === 'GET' && m) {
    const circleId = parseInt(m[1], 10);
    const preview = await getCirclePreview(circleId);
    if (!preview) return json(res, 404, { error: 'Круг не найден' });
    return json(res, 200, preview);
  }

  // POST /api/circles/:id/join
  m = path.match(/^\/api\/circles\/(\d+)\/join$/);
  if (method === 'POST' && m) {
    const circleId = parseInt(m[1], 10);
    await upsertUser(user.id, user.username, user.first_name, user.language_code);
    const result = await joinCircle(circleId, user.id, user.first_name);
    if (!result.ok) return json(res, 404, { error: result.error });
    return json(res, 200, result);
  }

  // GET /api/circles/:id
  m = path.match(/^\/api\/circles\/(\d+)$/);
  if (method === 'GET' && m) {
    const circleId = parseInt(m[1], 10);
    if (!(await isCircleMember(circleId, user.id))) return json(res, 403, { error: 'Нет доступа' });
    return json(res, 200, {
      circle: await getCircle(circleId),
      members: await getCircleMembers(circleId),
      events: await getCircleEvents(circleId),
    });
  }

  // POST /api/circles/:id/members
  m = path.match(/^\/api\/circles\/(\d+)\/members$/);
  if (method === 'POST' && m) {
    const circleId = parseInt(m[1], 10);
    if (!(await isCircleMember(circleId, user.id))) return json(res, 403, { error: 'Нет доступа' });
    const { displayName } = req.body || {};
    if (!displayName?.trim()) return json(res, 400, { error: 'Имя обязательно' });
    await addCircleContact(circleId, displayName.trim());
    return json(res, 200, await getCircleMembers(circleId));
  }

  // DELETE /api/circles/:id/members/:memberRef
  m = path.match(/^\/api\/circles\/(\d+)\/members\/([^/]+)$/);
  if (method === 'DELETE' && m) {
    const circleId = parseInt(m[1], 10);
    const memberRef = decodeURIComponent(m[2]);
    if (!(await isCircleMember(circleId, user.id))) {
      return json(res, 403, { error: 'Нет доступа' });
    }
    try {
      const members = await removeMemberFromCircle(circleId, user.id, memberRef);
      return json(res, 200, { ok: true, members });
    } catch (err) {
      const code = err.code || 'FAILED';
      const status = code === 'FORBIDDEN' ? 403
        : code === 'NOT_FOUND' ? 404
        : code === 'CREATOR' ? 400
        : 500;
      return json(res, status, { error: err.message, code });
    }
  }

  // POST /api/circles/:id/events
  m = path.match(/^\/api\/circles\/(\d+)\/events$/);
  if (method === 'POST' && m) {
    const circleId = parseInt(m[1], 10);
    if (!(await isCircleMember(circleId, user.id))) return json(res, 403, { error: 'Нет доступа' });
    const { name, eventDate, eventType, celebrantName } = req.body || {};
    if (!name?.trim() || !eventDate) return json(res, 400, { error: 'Название и дата обязательны' });
    const event = await createEvent(
      circleId, name.trim(), eventDate, eventType,
      user.id, celebrantName?.trim() || name.trim()
    );
    return json(res, 200, event);
  }

  // GET /api/circles/:id/wishlists
  m = path.match(/^\/api\/circles\/(\d+)\/wishlists$/);
  if (method === 'GET' && m) {
    const circleId = parseInt(m[1], 10);
    if (!(await isCircleMember(circleId, user.id))) return json(res, 403, { error: 'Нет доступа' });
    return json(res, 200, await getCircleMemberWishlists(circleId));
  }

  // GET /api/circles/:id/wishlist
  m = path.match(/^\/api\/circles\/(\d+)\/wishlist$/);
  if (method === 'GET' && m) {
    const circleId = parseInt(m[1], 10);
    if (!(await isCircleMember(circleId, user.id))) return json(res, 403, { error: 'Нет доступа' });

    const memberIdRaw = queryParam(req, 'memberId');
    const targetUserId = memberIdRaw ? parseInt(memberIdRaw, 10) : user.id;
    if (!Number.isFinite(targetUserId)) {
      return json(res, 400, { error: 'Некорректный участник' });
    }
    if (!(await isCircleMember(circleId, targetUserId))) {
      return json(res, 404, { error: 'Участник не найден' });
    }

    const data = await getMemberWishlist(circleId, targetUserId, {
      createIfMissing: targetUserId === user.id,
    });
    return json(res, 200, {
      ...data,
      ownerId: targetUserId,
      readOnly: targetUserId !== user.id,
    });
  }

  // DELETE /api/events/:id
  m = path.match(/^\/api\/events\/(\d+)$/);
  if (method === 'DELETE' && m) {
    const eventId = parseInt(m[1], 10);
    const event = await getEvent(eventId);
    if (!event) return json(res, 404, { error: 'Событие не найдено' });
    if (!(await isCircleMember(event.circle_id, user.id))) {
      return json(res, 403, { error: 'Нет доступа' });
    }
    await deleteEvent(eventId);
    return json(res, 200, { ok: true });
  }

  // POST /api/wishlists/:id/items
  m = path.match(/^\/api\/wishlists\/(\d+)\/items$/);
  if (method === 'POST' && m) {
    const wishlistId = parseInt(m[1], 10);
    const wishlist = await getWishlistById(wishlistId);
    if (!wishlist || Number(wishlist.user_id) !== user.id) {
      return json(res, 403, { error: 'Нет доступа' });
    }
    if (!(await isCircleMember(wishlist.circle_id, user.id))) {
      return json(res, 403, { error: 'Нет доступа' });
    }
    const { title, description, priceRange, url, priority } = req.body || {};
    if (!title?.trim()) return json(res, 400, { error: 'Название обязательно' });
    const item = await addWishlistItem(wishlistId, title.trim(), description, priceRange, url, priority);
    return json(res, 200, item);
  }

  // PUT /api/wishlist-items/:id
  m = path.match(/^\/api\/wishlist-items\/(\d+)$/);
  if (method === 'PUT' && m) {
    const itemId = parseInt(m[1], 10);
    const existing = await getWishlistItemWithOwner(itemId);
    if (!existing) return json(res, 404, { error: 'Не найдено' });
    if (Number(existing.owner_id) !== user.id) {
      return json(res, 403, { error: 'Нет доступа' });
    }
    const body = req.body || {};
    const item = await updateWishlistItem(itemId, {
      title: body.title,
      description: body.description,
      price_range: body.price_range ?? body.priceRange,
      url: body.url,
      priority: body.priority,
    });
    return json(res, 200, item);
  }

  // DELETE /api/wishlist-items/:id
  m = path.match(/^\/api\/wishlist-items\/(\d+)$/);
  if (method === 'DELETE' && m) {
    const itemId = parseInt(m[1], 10);
    const existing = await getWishlistItemWithOwner(itemId);
    if (!existing) return json(res, 404, { error: 'Не найдено' });
    if (Number(existing.owner_id) !== user.id) {
      return json(res, 403, { error: 'Нет доступа' });
    }
    await deleteWishlistItem(itemId);
    return json(res, 200, { ok: true });
  }

  // POST /api/report
  if (method === 'POST' && path === '/api/report') {
    const message = req.body?.message ?? req.body?.text ?? req.body?.body;
    if (!String(message || '').trim()) {
      return json(res, 400, { error: 'Message required', code: 'EMPTY' });
    }
    try {
      await upsertUser(user.id, user.username, user.first_name, user.language_code);
      const { sendReportToCreator, getCreatorId } = await import('./report.js');
      if (!getCreatorId()) {
        return json(res, 503, { error: 'Reports not configured', code: 'NOT_CONFIGURED' });
      }
      await sendReportToCreator(user, String(message).trim(), 'Mini App');
      return json(res, 200, { ok: true });
    } catch (err) {
      console.error('[api/report]', err.message, err.telegram || '');
      const code = err.code || 'FAILED';
      const status = code === 'CREATOR_UNREACHABLE' ? 502
        : code === 'NOT_CONFIGURED' ? 503
        : code === 'EMPTY' ? 400
        : 500;
      return json(res, status, {
        error: err.message || 'Failed to send report',
        code,
      });
    }
  }

  // POST /api/premium/invoice
  if (method === 'POST' && path === '/api/premium/invoice') {
    try {
      await upsertUser(user.id, user.username, user.first_name, user.language_code);
      const result = await sendPremiumInvoice(user.id, user.id, user.language_code);
      return json(res, 200, { ok: true, messageId: result.result?.message_id });
    } catch (err) {
      console.error('[api/premium/invoice]', err.message, err.telegram || '');
      return json(res, 500, { error: err.message || 'Failed to send invoice' });
    }
  }

  return json(res, 404, { error: 'Not found' });
}
