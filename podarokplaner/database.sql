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
