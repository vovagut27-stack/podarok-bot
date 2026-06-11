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
  createEvent,
  getCircleEvents,
  getUpcomingEvents,
  getOrCreateWishlist,
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

export async function handleApiRequest(req, res, path) {
  await initDb();

  const method = req.method;
  const user = authenticate(req, res);
  if (!user) return;

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
    return json(res, 200, await getUpcomingEvents(user.id, 10));
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

  // GET /api/circles/:id/wishlist
  m = path.match(/^\/api\/circles\/(\d+)\/wishlist$/);
  if (method === 'GET' && m) {
    const circleId = parseInt(m[1], 10);
    if (!(await isCircleMember(circleId, user.id))) return json(res, 403, { error: 'Нет доступа' });
    const wishlist = await getOrCreateWishlist(user.id, circleId);
    const items = await getWishlistItems(wishlist.id);
    return json(res, 200, { wishlist, items });
  }

  // DELETE /api/events/:id
  m = path.match(/^\/api\/events\/(\d+)$/);
  if (method === 'DELETE' && m) {
    await deleteEvent(parseInt(m[1], 10));
    return json(res, 200, { ok: true });
  }

  // POST /api/wishlists/:id/items
  m = path.match(/^\/api\/wishlists\/(\d+)\/items$/);
  if (method === 'POST' && m) {
    const wishlistId = parseInt(m[1], 10);
    const { title, description, priceRange, url, priority } = req.body || {};
    if (!title?.trim()) return json(res, 400, { error: 'Название обязательно' });
    const item = await addWishlistItem(wishlistId, title.trim(), description, priceRange, url, priority);
    return json(res, 200, item);
  }

  // PUT /api/wishlist-items/:id
  m = path.match(/^\/api\/wishlist-items\/(\d+)$/);
  if (method === 'PUT' && m) {
    const item = await updateWishlistItem(parseInt(m[1], 10), req.body || {});
    return json(res, 200, item);
  }

  // DELETE /api/wishlist-items/:id
  m = path.match(/^\/api\/wishlist-items\/(\d+)$/);
  if (method === 'DELETE' && m) {
    await deleteWishlistItem(parseInt(m[1], 10));
    return json(res, 200, { ok: true });
  }

  // POST /api/report
  if (method === 'POST' && path === '/api/report') {
    const { message } = req.body || {};
    if (!message?.trim()) return json(res, 400, { error: 'Message required' });
    try {
      await upsertUser(user.id, user.username, user.first_name, user.language_code);
      const { sendReportToCreator, getCreatorId } = await import('./report.js');
      if (!getCreatorId()) return json(res, 503, { error: 'Reports not configured' });
      await sendReportToCreator(user, message.trim(), 'Mini App');
      return json(res, 200, { ok: true });
    } catch (err) {
      console.error('[api/report]', err.message);
      return json(res, 500, { error: err.message || 'Failed to send report' });
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
