import { useState, useEffect } from 'react';
import { api, tg, getStartParam, haptic, buildCircleInviteLink, shareInviteLink } from './api';
import FamilyCircles from './components/FamilyCircles';
import CreateCircle from './components/CreateCircle';
import EventCalendar from './components/EventCalendar';
import Wishlist from './components/Wishlist';
import Settings from './components/Settings';

const VIEWS = {
  home: 'home',
  create: 'create',
  circle: 'circle',
  events: 'events',
  wishlist: 'wishlist',
  settings: 'settings',
};

export default function App() {
  const [view, setView] = useState(VIEWS.home);
  const [user, setUser] = useState(null);
  const [circles, setCircles] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedCircle, setSelectedCircle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    tg?.ready();
    tg?.expand();
    if (tg?.themeParams) {
      const root = document.documentElement;
      Object.entries(tg.themeParams).forEach(([key, value]) => {
        root.style.setProperty(`--tg-theme-${key.replace(/_/g, '-')}`, value);
      });
    }
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [me, circlesData, eventsData] = await Promise.all([
        api.getMe(),
        api.getCircles(),
        api.getUpcomingEvents(),
      ]);
      setUser(me.user);
      setCircles(circlesData);
      setEvents(eventsData);

      const startParam = getStartParam();
      if (startParam.startsWith('circle_')) {
        const circleId = parseInt(startParam.replace('circle_', ''), 10);
        if (circleId) {
          await api.joinCircle(circleId);
          const data = await api.getCircle(circleId);
          setSelectedCircle(data);
          setView(VIEWS.circle);
        }
      } else if (startParam === 'events') {
        setView(VIEWS.events);
      }
    } catch (err) {
      const msg = err.status === 401
        ? 'Откройте приложение через Telegram-бота'
        : err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function navigate(to, circle = null) {
    haptic('light');
    setView(to);
    if (circle) setSelectedCircle(circle);
    setError(null);
  }

  async function handleCircleCreated(circle) {
    await loadData();
    const data = await api.getCircle(circle.id);
    setSelectedCircle(data);
    navigate(VIEWS.circle);
  }

  async function refreshCircle() {
    if (selectedCircle?.circle?.id) {
      const data = await api.getCircle(selectedCircle.circle.id);
      setSelectedCircle(data);
      await loadData();
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <div style={{ fontSize: 32, marginBottom: 8 }}>🎁</div>
        Загрузка...
      </div>
    );
  }

  const headerTitles = {
    [VIEWS.home]: { title: '🎁 Подарок.бот', subtitle: 'Планируй подарки заранее' },
    [VIEWS.create]: { title: 'Новый круг', subtitle: 'Объедините людей для совместных подарков' },
    [VIEWS.circle]: { title: selectedCircle?.circle?.name || 'Круг', subtitle: 'Управление кругом' },
    [VIEWS.events]: { title: '📅 Календарь', subtitle: 'Ближайшие события' },
    [VIEWS.wishlist]: { title: '📋 Wishlist', subtitle: selectedCircle?.circle?.name },
    [VIEWS.settings]: { title: '⚙️ Настройки', subtitle: 'Premium и профиль' },
  };

  const header = headerTitles[view] || headerTitles[VIEWS.home];

  return (
    <>
      <header className="app-header">
        {view !== VIEWS.home && (
          <button className="back-btn" onClick={() => navigate(VIEWS.home)}>
            ← Назад
          </button>
        )}
        <h1>{header.title}</h1>
        <p>{header.subtitle}</p>
        {user?.is_premium && <span className="premium-badge">⭐ Premium</span>}
      </header>

      <div className="content">
        {error && <div className="error-banner">{error}</div>}

        {view === VIEWS.home && (
          <FamilyCircles
            circles={circles}
            events={events}
            onCreate={() => navigate(VIEWS.create)}
            onSelect={(c) => {
              api.getCircle(c.id).then(data => {
                setSelectedCircle(data);
                navigate(VIEWS.circle);
              });
            }}
            onViewEvents={() => navigate(VIEWS.events)}
          />
        )}

        {view === VIEWS.create && (
          <CreateCircle
            onCreated={handleCircleCreated}
            onCancel={() => navigate(VIEWS.home)}
          />
        )}

        {view === VIEWS.circle && selectedCircle && (
          <CircleDetail
            data={selectedCircle}
            onRefresh={refreshCircle}
            onWishlist={() => navigate(VIEWS.wishlist, selectedCircle)}
            onAddEvent={refreshCircle}
          />
        )}

        {view === VIEWS.events && (
          <EventCalendar events={events} circles={circles} />
        )}

        {view === VIEWS.wishlist && selectedCircle && (
          <Wishlist circleId={selectedCircle.circle.id} />
        )}

        {view === VIEWS.settings && (
          <Settings user={user} onRefresh={loadData} />
        )}
      </div>

      <nav className="bottom-nav">
        <button
          className={`nav-item ${view === VIEWS.home || view === VIEWS.circle || view === VIEWS.create ? 'active' : ''}`}
          onClick={() => navigate(VIEWS.home)}
        >
          <span>🏠</span>
          <span>Круги</span>
        </button>
        <button
          className={`nav-item ${view === VIEWS.events ? 'active' : ''}`}
          onClick={() => navigate(VIEWS.events)}
        >
          <span>📅</span>
          <span>События</span>
        </button>
        <button
          className={`nav-item ${view === VIEWS.settings ? 'active' : ''}`}
          onClick={() => navigate(VIEWS.settings)}
        >
          <span>⚙️</span>
          <span>Ещё</span>
        </button>
      </nav>
    </>
  );
}

function CircleDetail({ data, onRefresh, onWishlist, onAddEvent }) {
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState({
    name: '',
    eventDate: '',
    eventType: 'birthday',
    celebrantName: '',
  });
  const [memberName, setMemberName] = useState('');
  const [saving, setSaving] = useState(false);
  const [botUsername, setBotUsername] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.getConfig().then(cfg => setBotUsername(cfg.botUsername || ''));
  }, []);

  const inviteLink = buildCircleInviteLink(botUsername, data.circle.id);

  function memberLabel(m) {
    const name = m.display_name || m.first_name || (m.username ? `@${m.username}` : `User ${m.user_id}`);
    return name;
  }

  function handleShareInvite() {
    if (!inviteLink) return;
    haptic('medium');
    shareInviteLink(inviteLink, data.circle.name);
  }

  async function handleCopyInvite() {
    if (!inviteLink) return;
    haptic('light');
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert(inviteLink);
    }
  }

  async function handleAddEvent(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createEvent(data.circle.id, eventForm);
      setShowEventForm(false);
      setEventForm({ name: '', eventDate: '', eventType: 'birthday', celebrantName: '' });
      onAddEvent();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMember(e) {
    e.preventDefault();
    if (!memberName.trim()) return;
    setSaving(true);
    try {
      await api.addMember(data.circle.id, memberName.trim());
      setMemberName('');
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  const telegramMembers = data.members.filter(m => m.user_id);
  const nameOnlyMembers = data.members.filter(m => !m.user_id);

  return (
    <>
      <div className="card">
        <div className="card-title">{data.circle.name}</div>
        <div className="card-subtitle">
          {data.members.length} участников · {data.events.length} событий
          {telegramMembers.length > 0 && ` · ${telegramMembers.length} в боте`}
        </div>
      </div>

      <div className="section-title">Участники</div>
      <div className="card">
        {data.members.length === 0 ? (
          <div className="card-subtitle">Пока никого — пригласите друзей по ссылке ниже</div>
        ) : (
          <>
            {telegramMembers.length > 0 && (
              <div className="member-group">
                <div className="member-group-label">В Telegram</div>
                {telegramMembers.map(m => (
                  <span key={m.user_id} className="member-tag member-tag--bot">
                    {memberLabel(m)}
                    {m.role === 'admin' && ' 👑'}
                  </span>
                ))}
              </div>
            )}
            {nameOnlyMembers.length > 0 && (
              <div className="member-group">
                <div className="member-group-label">Только имя (ещё не в боте)</div>
                {nameOnlyMembers.map(m => (
                  <span key={m.id} className="member-tag member-tag--contact">
                    {memberLabel(m)}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
        <form onSubmit={handleAddMember} style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <input
            placeholder="Имя участника"
            value={memberName}
            onChange={e => setMemberName(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            +
          </button>
        </form>
      </div>

      <div className="section-title">События</div>
      {data.events.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">📅</div>
          <p>Добавьте первое событие</p>
        </div>
      ) : (
        data.events.map(ev => (
          <EventCard key={ev.id} event={ev} />
        ))
      )}

      {showEventForm ? (
        <form className="card" onSubmit={handleAddEvent}>
          <div className="form-group">
            <label>Название события</label>
            <input
              required
              placeholder="День рождения Маши"
              value={eventForm.name}
              onChange={e => setEventForm({ ...eventForm, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Именинник</label>
            <input
              placeholder="Маша"
              value={eventForm.celebrantName}
              onChange={e => setEventForm({ ...eventForm, celebrantName: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Дата</label>
            <input
              required
              type="date"
              value={eventForm.eventDate}
              onChange={e => setEventForm({ ...eventForm, eventDate: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Тип</label>
            <select
              value={eventForm.eventType}
              onChange={e => setEventForm({ ...eventForm, eventType: e.target.value })}
            >
              <option value="birthday">🎂 День рождения</option>
              <option value="anniversary">💍 Годовщина</option>
              <option value="holiday">🎄 Праздник</option>
              <option value="other">📅 Другое</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowEventForm(false)}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Сохранение...' : 'Добавить'}
            </button>
          </div>
        </form>
      ) : (
        <button className="btn btn-primary" onClick={() => setShowEventForm(true)}>
          + Добавить событие
        </button>
      )}

      <div style={{ marginTop: 12 }}>
        <button className="btn btn-secondary" onClick={onWishlist}>
          📋 Мой wishlist
        </button>
      </div>

      <div className="section-title">Пригласить в круг</div>
      <div className="card invite-card">
        <div className="card-subtitle" style={{ marginBottom: 12 }}>
          Отправьте ссылку — человек увидит, кто уже в круге, и сможет присоединиться через бота.
        </div>
        {inviteLink ? (
          <>
            <code className="invite-link">{inviteLink}</code>
            <div className="invite-actions">
              <button type="button" className="btn btn-primary" onClick={handleShareInvite}>
                📤 Поделиться в Telegram
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleCopyInvite}>
                {copied ? '✓ Скопировано' : '📋 Копировать ссылку'}
              </button>
            </div>
          </>
        ) : (
          <div className="card-subtitle">
            Задайте <code>BOT_USERNAME</code> в настройках Vercel (например, <code>podarok_bot</code>), чтобы включить приглашения.
          </div>
        )}
      </div>
    </>
  );
}

function EventCard({ event }) {
  const days = daysUntil(event.event_date);
  const emoji = { birthday: '🎂', anniversary: '💍', holiday: '🎄', other: '📅' }[event.event_type] || '📅';

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="card-title">{emoji} {event.name}</div>
          <div className="card-subtitle">{event.event_date}</div>
        </div>
        <div className="countdown">
          {days === 0 ? 'Сегодня!' : days === 1 ? 'Завтра' : `${days}д`}
        </div>
      </div>
    </div>
  );
}

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const event = new Date(dateStr + 'T00:00:00');
  return Math.ceil((event - today) / (1000 * 60 * 60 * 24));
}
