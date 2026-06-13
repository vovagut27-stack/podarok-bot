import express from 'express';
import cors from 'cors';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './database.js';
import {
  validateInitData,
  handleUpdate,
  sendPremiumInvoice,
} from './handlers.js';
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEBAPP_DIST = join(__dirname, '..', 'webapp', 'dist');

export async function createApp() {
  await initDb();

  const app = express();
  app.use(cors());
  app.use(express.json());

  function authMiddleware(req, res, next) {
    const initData = req.headers['x-telegram-init-data'] || req.body?.initData;
    let user = validateInitData(initData);

    if (!user && process.env.DEV_MODE === 'true') {
      user = { id: 999999, username: 'dev_user', first_name: 'Тестовый пользователь' };
    }

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.telegramUser = user;
    next();
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'Подарок.бот' });
  });

  app.get('/api/bootstrap', authMiddleware, async (req, res) => {
    await upsertUser(
      req.telegramUser.id,
      req.telegramUser.username,
      req.telegramUser.first_name,
      req.telegramUser.language_code
    );
    const user = await getUser(req.telegramUser.id);
    const [circles, events] = await Promise.all([
      getUserCircles(req.telegramUser.id),
      getUpcomingEvents(req.telegramUser.id, 50),
    ]);
    res.json({ user, circles, events });
  });

  app.get('/api/me', authMiddleware, async (req, res) => {
    await upsertUser(
      req.telegramUser.id,
      req.telegramUser.username,
      req.telegramUser.first_name,
      req.telegramUser.language_code
    );
    const user = await getUser(req.telegramUser.id);
    res.json({ user, stats: await getGiftStats(req.telegramUser.id) });
  });

  app.post('/api/me/locale', authMiddleware, async (req, res) => {
    const { locale } = req.body || {};
    if (locale !== 'ru' && locale !== 'en') {
      return res.status(400).json({ error: 'Invalid locale' });
    }
    await upsertUser(
      req.telegramUser.id,
      req.telegramUser.username,
      req.telegramUser.first_name,
      req.telegramUser.language_code
    );
    await setUserLocale(req.telegramUser.id, locale);
    const user = await getUser(req.telegramUser.id);
    res.json({ locale: user.locale });
  });

  app.get('/api/circles', authMiddleware, async (req, res) => {
    res.json(await getUserCircles(req.telegramUser.id));
  });

  app.post('/api/circles', authMiddleware, async (req, res) => {
    const { name, members } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Название круга обязательно' });
    }
    if (!(await canCreateCircle(req.telegramUser.id))) {
      return res.status(403).json({
        error: 'Лимит бесплатных кругов (3). Оформите Premium!',
        premiumRequired: true,
      });
    }

    const circle = await createCircle(name.trim(), req.telegramUser.id);

    if (Array.isArray(members)) {
      for (const m of members) {
        if (m.name?.trim()) {
          await addCircleContact(circle.id, m.name.trim());
        }
      }
    }

    res.json(circle);
  });

  app.get('/api/circles/:id/preview', authMiddleware, async (req, res) => {
    const circleId = parseInt(req.params.id, 10);
    const preview = await getCirclePreview(circleId);
    if (!preview) {
      return res.status(404).json({ error: 'Круг не найден' });
    }
    res.json(preview);
  });

  app.post('/api/circles/:id/join', authMiddleware, async (req, res) => {
    const circleId = parseInt(req.params.id, 10);
    await upsertUser(
      req.telegramUser.id,
      req.telegramUser.username,
      req.telegramUser.first_name,
      req.telegramUser.language_code
    );
    const result = await joinCircle(circleId, req.telegramUser.id, req.telegramUser.first_name);
    if (!result.ok) {
      return res.status(404).json({ error: result.error });
    }
    res.json(result);
  });

  app.get('/api/circles/:id', authMiddleware, async (req, res) => {
    const circleId = parseInt(req.params.id, 10);
    if (!(await isCircleMember(circleId, req.telegramUser.id))) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    res.json({
      circle: await getCircle(circleId),
      members: await getCircleMembers(circleId),
      events: await getCircleEvents(circleId),
    });
  });

  app.post('/api/circles/:id/members', authMiddleware, async (req, res) => {
    const circleId = parseInt(req.params.id, 10);
    if (!(await isCircleMember(circleId, req.telegramUser.id))) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    const { displayName } = req.body;
    if (!displayName?.trim()) {
      return res.status(400).json({ error: 'Имя обязательно' });
    }
    await addCircleContact(circleId, displayName.trim());
    res.json(await getCircleMembers(circleId));
  });

  app.delete('/api/circles/:id/members/:memberRef', authMiddleware, async (req, res) => {
    const circleId = parseInt(req.params.id, 10);
    const memberRef = decodeURIComponent(req.params.memberRef);
    if (!(await isCircleMember(circleId, req.telegramUser.id))) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    try {
      const members = await removeMemberFromCircle(circleId, req.telegramUser.id, memberRef);
      res.json({ ok: true, members });
    } catch (err) {
      const code = err.code || 'FAILED';
      const status = code === 'FORBIDDEN' ? 403
        : code === 'NOT_FOUND' ? 404
        : code === 'CREATOR' ? 400
        : 500;
      res.status(status).json({ error: err.message, code });
    }
  });

  app.post('/api/circles/:id/events', authMiddleware, async (req, res) => {
    const circleId = parseInt(req.params.id, 10);
    if (!(await isCircleMember(circleId, req.telegramUser.id))) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    const { name, eventDate, eventType, celebrantName } = req.body;
    if (!name?.trim() || !eventDate) {
      return res.status(400).json({ error: 'Название и дата обязательны' });
    }
    const event = await createEvent(
      circleId,
      name.trim(),
      eventDate,
      eventType,
      req.telegramUser.id,
      celebrantName?.trim() || name.trim()
    );
    res.json(event);
  });

  app.delete('/api/events/:id', authMiddleware, async (req, res) => {
    const eventId = parseInt(req.params.id, 10);
    const event = await getEvent(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Событие не найдено' });
    }
    if (!(await isCircleMember(event.circle_id, req.telegramUser.id))) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    await deleteEvent(eventId);
    res.json({ ok: true });
  });

  app.get('/api/events/upcoming', authMiddleware, async (req, res) => {
    res.json(await getUpcomingEvents(req.telegramUser.id, 50));
  });

  app.get('/api/circles/:id/wishlists', authMiddleware, async (req, res) => {
    const circleId = parseInt(req.params.id, 10);
    if (!(await isCircleMember(circleId, req.telegramUser.id))) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    res.json(await getCircleMemberWishlists(circleId));
  });

  app.get('/api/circles/:id/wishlist', authMiddleware, async (req, res) => {
    const circleId = parseInt(req.params.id, 10);
    if (!(await isCircleMember(circleId, req.telegramUser.id))) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const memberIdRaw = req.query.memberId;
    const targetUserId = memberIdRaw
      ? parseInt(memberIdRaw, 10)
      : req.telegramUser.id;
    if (!Number.isFinite(targetUserId)) {
      return res.status(400).json({ error: 'Некорректный участник' });
    }
    if (!(await isCircleMember(circleId, targetUserId))) {
      return res.status(404).json({ error: 'Участник не найден' });
    }

    const data = await getMemberWishlist(circleId, targetUserId, {
      createIfMissing: targetUserId === req.telegramUser.id,
    });
    res.json({
      ...data,
      ownerId: targetUserId,
      readOnly: targetUserId !== req.telegramUser.id,
    });
  });

  app.post('/api/wishlists/:id/items', authMiddleware, async (req, res) => {
    const wishlistId = parseInt(req.params.id, 10);
    const wishlist = await getWishlistById(wishlistId);
    if (!wishlist || Number(wishlist.user_id) !== req.telegramUser.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    if (!(await isCircleMember(wishlist.circle_id, req.telegramUser.id))) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    const { title, description, priceRange, url, priority } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ error: 'Название обязательно' });
    }
    const item = await addWishlistItem(
      wishlistId,
      title.trim(),
      description,
      priceRange,
      url,
      priority
    );
    res.json(item);
  });

  app.put('/api/wishlist-items/:id', authMiddleware, async (req, res) => {
    const itemId = parseInt(req.params.id, 10);
    const existing = await getWishlistItemWithOwner(itemId);
    if (!existing) {
      return res.status(404).json({ error: 'Не найдено' });
    }
    if (Number(existing.owner_id) !== req.telegramUser.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    const body = req.body || {};
    const item = await updateWishlistItem(itemId, {
      title: body.title,
      description: body.description,
      price_range: body.price_range ?? body.priceRange,
      url: body.url,
      priority: body.priority,
    });
    res.json(item);
  });

  app.delete('/api/wishlist-items/:id', authMiddleware, async (req, res) => {
    const itemId = parseInt(req.params.id, 10);
    const existing = await getWishlistItemWithOwner(itemId);
    if (!existing) {
      return res.status(404).json({ error: 'Не найдено' });
    }
    if (Number(existing.owner_id) !== req.telegramUser.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    await deleteWishlistItem(itemId);
    res.json({ ok: true });
  });

  app.post('/api/report', authMiddleware, async (req, res) => {
    const message = req.body?.message ?? req.body?.text ?? req.body?.body;
    if (!String(message || '').trim()) {
      return res.status(400).json({ error: 'Message required', code: 'EMPTY' });
    }
    try {
      await upsertUser(
        req.telegramUser.id,
        req.telegramUser.username,
        req.telegramUser.first_name,
        req.telegramUser.language_code
      );
      const { sendReportToCreator, getCreatorId } = await import('./report.js');
      if (!getCreatorId()) {
        return res.status(503).json({ error: 'Reports not configured', code: 'NOT_CONFIGURED' });
      }
      await sendReportToCreator(req.telegramUser, String(message).trim(), 'Mini App');
      res.json({ ok: true });
    } catch (err) {
      console.error('[api/report]', err.message, err.telegram || '');
      const code = err.code || 'FAILED';
      const status = code === 'CREATOR_UNREACHABLE' ? 502
        : code === 'NOT_CONFIGURED' ? 503
        : code === 'EMPTY' ? 400
        : 500;
      res.status(status).json({
        error: err.message || 'Failed to send report',
        code,
      });
    }
  });

  app.post('/api/premium/invoice', authMiddleware, async (req, res) => {
    try {
      await upsertUser(
        req.telegramUser.id,
        req.telegramUser.username,
        req.telegramUser.first_name,
        req.telegramUser.language_code
      );
      const result = await sendPremiumInvoice(
        req.telegramUser.id,
        req.telegramUser.id,
        req.telegramUser.language_code
      );
      res.json({ ok: true, messageId: result.result?.message_id });
    } catch (err) {
      console.error('[api/premium/invoice]', err.message, err.telegram || '');
      res.status(500).json({ error: err.message || 'Failed to send invoice' });
    }
  });

  const webhookHandler = async (req, res) => {
    if (!process.env.BOT_TOKEN) {
      console.error('[webhook] BOT_TOKEN is not set');
      return res.status(500).json({ error: 'BOT_TOKEN not configured' });
    }
    try {
      await handleUpdate(req.body);
      res.sendStatus(200);
    } catch (err) {
      console.error('[webhook] Error:', err);
      res.status(500).json({ error: err.message });
    }
  };

  app.post('/webhook', webhookHandler);
  app.post('/api/webhook', webhookHandler);

  if (!process.env.VERCEL) {
    app.use(express.static(WEBAPP_DIST));
    app.get('*', (req, res) => {
      res.sendFile(join(WEBAPP_DIST, 'index.html'), (err) => {
        if (err) res.status(404).send('Mini App not built. Run: npm run build:webapp');
      });
    });
  }

  return app;
}
