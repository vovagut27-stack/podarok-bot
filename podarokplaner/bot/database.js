import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localDbPath = join(__dirname, '..', 'data', 'podarokplaner.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  telegram_id INTEGER PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  is_premium BOOLEAN DEFAULT FALSE,
  premium_until DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS family_circles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  creator_id INTEGER REFERENCES users(telegram_id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS circle_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER REFERENCES family_circles(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(telegram_id),
  role TEXT DEFAULT 'member',
  display_name TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_circle_user ON circle_members(circle_id, user_id)
  WHERE user_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS circle_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER REFERENCES family_circles(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER REFERENCES family_circles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_type TEXT DEFAULT 'birthday',
  celebrant_id INTEGER REFERENCES users(telegram_id),
  celebrant_name TEXT
);
CREATE TABLE IF NOT EXISTS wishlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(telegram_id),
  circle_id INTEGER REFERENCES family_circles(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'Мой список желаний'
);
CREATE TABLE IF NOT EXISTS wishlist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wishlist_id INTEGER REFERENCES wishlists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price_range TEXT,
  url TEXT,
  priority INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS notifications_sent (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(telegram_id),
  days_before INTEGER NOT NULL,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, user_id, days_before)
);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_circle_members_user ON circle_members(user_id);
`.trim();

let client;
let dbReady;

function tursoHttpUrl(raw) {
  return raw.replace('libsql://', 'https://');
}

async function createDbClient() {
  assertEnv();

  if (process.env.TURSO_DATABASE_URL) {
    const { createClient } = await import('@libsql/client/web');
    return createClient({
      url: tursoHttpUrl(process.env.TURSO_DATABASE_URL),
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }

  const { createClient } = await import('@libsql/client');
  mkdirSync(join(__dirname, '..', 'data'), { recursive: true });
  return createClient({ url: `file:${localDbPath}` });
}

function getClient() {
  if (!client) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return client;
}

async function runSchema() {
  const statements = SCHEMA.split(';').map(s => s.trim()).filter(Boolean);
  for (const sql of statements) {
    await getClient().execute(sql);
  }
}

function assertEnv() {
  if (!process.env.VERCEL) return;
  const missing = [];
  if (!process.env.TURSO_DATABASE_URL) missing.push('TURSO_DATABASE_URL');
  if (!process.env.TURSO_AUTH_TOKEN) missing.push('TURSO_AUTH_TOKEN');
  if (!process.env.BOT_TOKEN) missing.push('BOT_TOKEN');
  if (missing.length) {
    throw new Error(`Missing Vercel env vars: ${missing.join(', ')}`);
  }
}

export async function initDb() {
  if (!dbReady) {
    dbReady = (async () => {
      assertEnv();
      client = await createDbClient();
      const check = await client.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
      );
      if (check.rows.length === 0) {
        await runSchema();
      }
    })();
  }
  await dbReady;
  return getClient();
}

async function one(sql, args = []) {
  const result = await getClient().execute({ sql, args });
  return result.rows[0] ?? null;
}

async function all(sql, args = []) {
  const result = await getClient().execute({ sql, args });
  return result.rows;
}

async function exec(sql, args = []) {
  return getClient().execute({ sql, args });
}

function num(value) {
  return value == null ? null : Number(value);
}

export async function upsertUser(telegramId, username, firstName) {
  await exec(`
    INSERT INTO users (telegram_id, username, first_name)
    VALUES (?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      username = excluded.username,
      first_name = excluded.first_name
  `, [telegramId, username || null, firstName || null]);
  return one('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);
}

export async function getUser(telegramId) {
  return one('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);
}

export async function setPremium(telegramId, until) {
  await exec(`
    UPDATE users SET is_premium = 1, premium_until = ? WHERE telegram_id = ?
  `, [until, telegramId]);
}

export async function canCreateCircle(userId) {
  const user = await getUser(userId);
  if (user?.is_premium) return true;
  const count = await one(`
    SELECT COUNT(*) as count FROM family_circles WHERE creator_id = ?
  `, [userId]);
  return Number(count.count) < 3;
}

export async function createCircle(name, creatorId) {
  const result = await exec(`
    INSERT INTO family_circles (name, creator_id) VALUES (?, ?)
  `, [name, creatorId]);
  const circleId = num(result.lastInsertRowid);
  await exec(`
    INSERT INTO circle_members (circle_id, user_id, role) VALUES (?, ?, 'admin')
  `, [circleId, creatorId]);
  return getCircle(circleId);
}

export async function getCircle(circleId) {
  return one('SELECT * FROM family_circles WHERE id = ?', [circleId]);
}

export async function getUserCircles(userId) {
  return all(`
    SELECT fc.*, cm.role,
      (SELECT COUNT(*) FROM circle_members WHERE circle_id = fc.id) +
      (SELECT COUNT(*) FROM circle_contacts WHERE circle_id = fc.id) as member_count,
      (SELECT COUNT(*) FROM events WHERE circle_id = fc.id) as event_count
    FROM family_circles fc
    JOIN circle_members cm ON cm.circle_id = fc.id
    WHERE cm.user_id = ?
    ORDER BY fc.created_at DESC
  `, [userId]);
}

export async function addCircleMember(circleId, userId, role = 'member', displayName = null) {
  await exec(`
    INSERT OR IGNORE INTO circle_members (circle_id, user_id, role, display_name)
    VALUES (?, ?, ?, ?)
  `, [circleId, userId, role, displayName]);
}

export async function joinCircle(circleId, userId, displayName = null) {
  const circle = await getCircle(circleId);
  if (!circle) return { ok: false, error: 'Круг не найден' };

  const alreadyMember = await isCircleMember(circleId, userId);
  if (!alreadyMember) {
    await addCircleMember(circleId, userId, 'member', displayName);
  }
  return { ok: true, alreadyMember, circle };
}

export async function getCirclePreview(circleId) {
  const circle = await getCircle(circleId);
  if (!circle) return null;
  const members = await getCircleMembers(circleId);
  return {
    circle,
    members,
    memberCount: members.length,
    telegramMemberCount: members.filter(m => m.user_id).length,
  };
}

export async function addCircleContact(circleId, name) {
  await exec(`INSERT INTO circle_contacts (circle_id, name) VALUES (?, ?)`, [circleId, name]);
}

export async function getCircleContacts(circleId) {
  return all(`SELECT * FROM circle_contacts WHERE circle_id = ? ORDER BY id`, [circleId]);
}

export async function getCircleMembers(circleId) {
  const members = await all(`
    SELECT cm.*, u.username, u.first_name
    FROM circle_members cm
    LEFT JOIN users u ON u.telegram_id = cm.user_id
    WHERE cm.circle_id = ?
  `, [circleId]);

  const contacts = (await getCircleContacts(circleId)).map(c => ({
    id: `contact_${c.id}`,
    circle_id: c.circle_id,
    user_id: null,
    role: 'contact',
    display_name: c.name,
    username: null,
    first_name: c.name,
  }));

  return [...members, ...contacts];
}

export async function isCircleMember(circleId, userId) {
  const row = await one(`
    SELECT 1 as ok FROM circle_members WHERE circle_id = ? AND user_id = ?
  `, [circleId, userId]);
  return !!row;
}

export async function createEvent(circleId, name, eventDate, eventType, celebrantId, celebrantName) {
  const result = await exec(`
    INSERT INTO events (circle_id, name, event_date, event_type, celebrant_id, celebrant_name)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [circleId, name, eventDate, eventType || 'birthday', celebrantId || null, celebrantName || null]);
  return getEvent(num(result.lastInsertRowid));
}

export async function getEvent(eventId) {
  return one('SELECT * FROM events WHERE id = ?', [eventId]);
}

export async function getCircleEvents(circleId) {
  return all(`SELECT * FROM events WHERE circle_id = ? ORDER BY event_date ASC`, [circleId]);
}

export async function getUpcomingEvents(userId, limit = 10) {
  return all(`
    SELECT e.*, fc.name as circle_name
    FROM events e
    JOIN family_circles fc ON fc.id = e.circle_id
    JOIN circle_members cm ON cm.circle_id = e.circle_id
    WHERE cm.user_id = ?
      AND date(e.event_date) >= date('now')
    ORDER BY e.event_date ASC
    LIMIT ?
  `, [userId, limit]);
}

export async function getEventsForNotification(daysBefore) {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysBefore);
  const dateStr = targetDate.toISOString().split('T')[0];
  return all(`
    SELECT e.*, fc.name as circle_name
    FROM events e
    JOIN family_circles fc ON fc.id = e.circle_id
    WHERE e.event_date = ?
  `, [dateStr]);
}

export async function markNotificationSent(eventId, userId, daysBefore) {
  await exec(`
    INSERT OR IGNORE INTO notifications_sent (event_id, user_id, days_before)
    VALUES (?, ?, ?)
  `, [eventId, userId, daysBefore]);
}

export async function wasNotificationSent(eventId, userId, daysBefore) {
  const row = await one(`
    SELECT 1 as ok FROM notifications_sent
    WHERE event_id = ? AND user_id = ? AND days_before = ?
  `, [eventId, userId, daysBefore]);
  return !!row;
}

export async function getOrCreateWishlist(userId, circleId) {
  let wishlist = await one(`
    SELECT * FROM wishlists WHERE user_id = ? AND circle_id = ?
  `, [userId, circleId]);
  if (!wishlist) {
    const result = await exec(`
      INSERT INTO wishlists (user_id, circle_id) VALUES (?, ?)
    `, [userId, circleId]);
    wishlist = await one('SELECT * FROM wishlists WHERE id = ?', [num(result.lastInsertRowid)]);
  }
  return wishlist;
}

export async function getWishlistForCelebrant(circleId, celebrantName) {
  const member = await one(`
    SELECT user_id FROM circle_members
    WHERE circle_id = ? AND (display_name = ? OR user_id = ?)
    LIMIT 1
  `, [circleId, celebrantName, parseInt(celebrantName, 10) || 0]);

  if (!member?.user_id) return { wishlist: null, items: [] };

  const wishlist = await one(`
    SELECT * FROM wishlists WHERE user_id = ? AND circle_id = ?
  `, [member.user_id, circleId]);

  if (!wishlist) return { wishlist: null, items: [] };

  const items = await all(`
    SELECT * FROM wishlist_items WHERE wishlist_id = ? ORDER BY priority DESC, id ASC
  `, [wishlist.id]);

  return { wishlist, items };
}

export async function getWishlistItems(wishlistId) {
  return all(`
    SELECT * FROM wishlist_items WHERE wishlist_id = ? ORDER BY priority DESC, id ASC
  `, [wishlistId]);
}

export async function addWishlistItem(wishlistId, title, description, priceRange, url, priority) {
  const result = await exec(`
    INSERT INTO wishlist_items (wishlist_id, title, description, price_range, url, priority)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [wishlistId, title, description || null, priceRange || null, url || null, priority || 1]);
  return one('SELECT * FROM wishlist_items WHERE id = ?', [num(result.lastInsertRowid)]);
}

export async function updateWishlistItem(itemId, data) {
  await exec(`
    UPDATE wishlist_items SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      price_range = COALESCE(?, price_range),
      url = COALESCE(?, url),
      priority = COALESCE(?, priority)
    WHERE id = ?
  `, [data.title, data.description, data.price_range, data.url, data.priority, itemId]);
  return one('SELECT * FROM wishlist_items WHERE id = ?', [itemId]);
}

export async function deleteWishlistItem(itemId) {
  await exec('DELETE FROM wishlist_items WHERE id = ?', [itemId]);
}

export async function deleteEvent(eventId) {
  await exec('DELETE FROM events WHERE id = ?', [eventId]);
}

export async function getCircleMemberIds(circleId) {
  const rows = await all(`SELECT user_id FROM circle_members WHERE circle_id = ?`, [circleId]);
  return rows.map(r => Number(r.user_id));
}

export async function getGiftStats(userId) {
  const circles = await getUserCircles(userId);
  const upcoming = await getUpcomingEvents(userId, 100);
  return {
    circleCount: circles.length,
    upcomingCount: upcoming.length,
    nextEvent: upcoming[0] || null,
  };
}
