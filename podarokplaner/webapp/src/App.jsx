import { useState, useEffect } from 'react';
import { api, tg, getStartParam, haptic, buildCircleInviteLink, shareInviteLink } from './api';
import { useLocale } from './i18n/LocaleContext';
import { translateApiError } from './i18n/translations';
import { isPremiumUser } from './userUtils';
import { circleInitials } from './ui';
import FamilyCircles from './components/FamilyCircles';
import CreateCircle from './components/CreateCircle';
import EventCalendar from './components/EventCalendar';
import Wishlist from './components/Wishlist';
import Settings from './components/Settings';
import EventCard from './components/EventCard';

const VIEWS = {
  home: 'home',
  create: 'create',
  circle: 'circle',
  events: 'events',
  wishlist: 'wishlist',
  settings: 'settings',
};

export default function App() {
  const { t, locale, setLocale } = useLocale();
  const [view, setView] = useState(VIEWS.home);
  const [user, setUser] = useState(null);
  const [circles, setCircles] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedCircle, setSelectedCircle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [focusReport, setFocusReport] = useState(false);

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

      if (me.user?.locale === 'en' || me.user?.locale === 'ru') {
        setLocale(me.user.locale);
      }

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
      } else if (startParam === 'report') {
        setFocusReport(true);
        setView(VIEWS.settings);
      }
    } catch (err) {
      const msg = err.status === 401
        ? t('errors.openInTelegram')
        : translateApiError(err.message, locale);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function navigate(to, circle = null) {
    haptic('light');
    setView(to);
    if (to !== VIEWS.settings) setFocusReport(false);
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

  async function handleDeleteEvent(eventId) {
    try {
      await api.deleteEvent(eventId);
      haptic('success');
      await loadData();
      if (selectedCircle?.circle?.id) {
        const data = await api.getCircle(selectedCircle.circle.id);
        setSelectedCircle(data);
      }
    } catch (err) {
      alert(translateApiError(err.message, locale));
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-gift">🎁</div>
        {t('app.loading')}
      </div>
    );
  }

  const headerTitles = {
    [VIEWS.home]: { title: t('home.title'), subtitle: t('home.subtitle') },
    [VIEWS.create]: { title: t('create.title'), subtitle: t('create.subtitle') },
    [VIEWS.circle]: {
      title: selectedCircle?.circle?.name || t('circle.defaultName'),
      subtitle: t('circle.subtitle'),
    },
    [VIEWS.events]: { title: t('events.title'), subtitle: t('events.subtitle') },
    [VIEWS.wishlist]: { title: t('wishlist.title'), subtitle: selectedCircle?.circle?.name },
    [VIEWS.settings]: { title: t('settings.title'), subtitle: t('settings.subtitle') },
  };

  const header = headerTitles[view] || headerTitles[VIEWS.home];

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          {view !== VIEWS.home && (
            <button type="button" className="back-btn" onClick={() => navigate(VIEWS.home)}>
              ← {t('app.back')}
            </button>
          )}
          <div className="app-header-top">
            <div>
              <h1>{header.title}</h1>
              <p>{header.subtitle}</p>
            </div>
            {isPremiumUser(user) && <span className="premium-badge">⭐ Premium</span>}
          </div>
        </div>
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
            currentUserId={user?.telegram_id ?? user?.id}
            onRefresh={refreshCircle}
            onWishlist={() => navigate(VIEWS.wishlist, selectedCircle)}
            onAddEvent={refreshCircle}
          />
        )}

        {view === VIEWS.events && (
          <EventCalendar events={events} onDelete={handleDeleteEvent} />
        )}

        {view === VIEWS.wishlist && selectedCircle && (
          <Wishlist circleId={selectedCircle.circle.id} />
        )}

        {view === VIEWS.settings && (
          <Settings user={user} focusReport={focusReport} />
        )}
      </div>

      <nav className="bottom-nav">
        <button
          type="button"
          className={`nav-item ${view === VIEWS.home || view === VIEWS.circle || view === VIEWS.create ? 'active' : ''}`}
          onClick={() => navigate(VIEWS.home)}
        >
          <span className="nav-icon">🏠</span>
          <span>{t('nav.circles')}</span>
        </button>
        <button
          type="button"
          className={`nav-item ${view === VIEWS.events ? 'active' : ''}`}
          onClick={() => navigate(VIEWS.events)}
        >
          <span className="nav-icon">📅</span>
          <span>{t('nav.events')}</span>
        </button>
        <button
          type="button"
          className={`nav-item ${view === VIEWS.settings ? 'active' : ''}`}
          onClick={() => navigate(VIEWS.settings)}
        >
          <span className="nav-icon">✨</span>
          <span>{t('nav.more')}</span>
        </button>
      </nav>
    </>
  );
}

function CircleDetail({ data, currentUserId, onRefresh, onWishlist, onAddEvent }) {
  const { t, locale } = useLocale();
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
    return m.display_name || m.first_name || (m.username ? `@${m.username}` : `User ${m.user_id}`);
  }

  function handleShareInvite() {
    if (!inviteLink) return;
    haptic('medium');
    const shareText = t('share.inviteText', { name: data.circle.name });
    shareInviteLink(inviteLink, shareText, t('app.name'));
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
      alert(translateApiError(err.message, locale));
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
      alert(translateApiError(err.message, locale));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEvent(eventId) {
    try {
      await api.deleteEvent(eventId);
      haptic('success');
      onRefresh();
    } catch (err) {
      alert(translateApiError(err.message, locale));
    }
  }

  async function handleRemoveMember(member) {
    const name = memberLabel(member);
    if (!confirm(t('circle.removeMemberConfirm', { name }))) return;
    haptic('medium');
    try {
      await api.removeMember(data.circle.id, String(member.id));
      haptic('success');
      onRefresh();
    } catch (err) {
      alert(translateApiError(err.message, locale));
    }
  }

  const canManageMembers = (() => {
    if (!currentUserId) return false;
    if (Number(data.circle.creator_id) === Number(currentUserId)) return true;
    const me = data.members.find(m => Number(m.user_id) === Number(currentUserId));
    return me?.role === 'admin';
  })();

  function canRemoveMember(member) {
    if (!canManageMembers) return false;
    if (member.user_id && Number(member.user_id) === Number(data.circle.creator_id)) {
      return false;
    }
    return true;
  }

  const telegramMembers = data.members.filter(m => m.user_id);
  const nameOnlyMembers = data.members.filter(m => !m.user_id);

  return (
    <>
      <div className="card hero-card">
        <div className="circle-row">
          <div
            className="circle-avatar"
            style={{ background: 'rgba(255,255,255,0.25)', boxShadow: 'none' }}
          >
            {circleInitials(data.circle.name)}
          </div>
          <div className="circle-row-body">
            <div className="card-title">{data.circle.name}</div>
            <div className="card-subtitle">
              {t('circle.stats', { members: data.members.length, events: data.events.length })}
              {telegramMembers.length > 0 && t('circle.statsInBot', { count: telegramMembers.length })}
            </div>
          </div>
        </div>
      </div>

      <div className="section-title">{t('circle.members')}</div>
      <div className="card">
        {data.members.length === 0 ? (
          <div className="card-subtitle">{t('circle.membersEmpty')}</div>
        ) : (
          <>
            {telegramMembers.length > 0 && (
              <div className="member-group">
                <div className="member-group-label">{t('circle.inTelegram')}</div>
                <div className="member-list">
                  {telegramMembers.map(m => (
                    <MemberRow
                      key={m.user_id}
                      label={memberLabel(m) + (m.role === 'admin' ? ' 👑' : '')}
                      variant="bot"
                      canRemove={canRemoveMember(m)}
                      onRemove={() => handleRemoveMember(m)}
                      removeLabel={t('circle.removeMember')}
                    />
                  ))}
                </div>
              </div>
            )}
            {nameOnlyMembers.length > 0 && (
              <div className="member-group">
                <div className="member-group-label">{t('circle.nameOnly')}</div>
                <div className="member-list">
                  {nameOnlyMembers.map(m => (
                    <MemberRow
                      key={m.id}
                      label={memberLabel(m)}
                      variant="contact"
                      canRemove={canRemoveMember(m)}
                      onRemove={() => handleRemoveMember(m)}
                      removeLabel={t('circle.removeMember')}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        <form onSubmit={handleAddMember} className="input-row">
          <input
            className="input-inline"
            placeholder={t('circle.memberPlaceholder')}
            value={memberName}
            onChange={e => setMemberName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            +
          </button>
        </form>
      </div>

      <div className="section-title">{t('circle.events')}</div>
      {data.events.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <p>{t('circle.eventsEmpty')}</p>
        </div>
      ) : (
        data.events.map(ev => (
          <EventCard key={ev.id} event={ev} onDelete={handleDeleteEvent} />
        ))
      )}

      {showEventForm ? (
        <form className="card" onSubmit={handleAddEvent}>
          <div className="form-group">
            <label>{t('circle.eventName')}</label>
            <input
              required
              placeholder={t('circle.eventNamePlaceholder')}
              value={eventForm.name}
              onChange={e => setEventForm({ ...eventForm, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>{t('circle.celebrant')}</label>
            <input
              placeholder={t('circle.celebrantPlaceholder')}
              value={eventForm.celebrantName}
              onChange={e => setEventForm({ ...eventForm, celebrantName: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>{t('circle.date')}</label>
            <input
              required
              type="date"
              value={eventForm.eventDate}
              onChange={e => setEventForm({ ...eventForm, eventDate: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>{t('circle.type')}</label>
            <select
              value={eventForm.eventType}
              onChange={e => setEventForm({ ...eventForm, eventType: e.target.value })}
            >
              <option value="birthday">{t('eventType.birthday')}</option>
              <option value="anniversary">{t('eventType.anniversary')}</option>
              <option value="holiday">{t('eventType.holiday')}</option>
              <option value="other">{t('eventType.other')}</option>
            </select>
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-secondary" onClick={() => setShowEventForm(false)}>
              {t('create.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('circle.saving') : t('circle.add')}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => setShowEventForm(true)}>
          📅 {t('circle.addEvent')}
        </button>
      )}

      <div className="action-stack">
        <button type="button" className="btn btn-secondary" onClick={onWishlist}>
          🎁 {t('circle.myWishlist')}
        </button>
      </div>

      <div className="section-title">{t('circle.inviteSection')}</div>
      <div className="card invite-card">
        <div className="card-subtitle" style={{ marginBottom: 12 }}>
          {t('circle.inviteHint')}
        </div>
        {inviteLink ? (
          <>
            <code className="invite-link">{inviteLink}</code>
            <div className="invite-actions">
              <button type="button" className="btn btn-primary" onClick={handleShareInvite}>
                {t('circle.shareTelegram')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleCopyInvite}>
                {copied ? t('circle.copied') : t('circle.copyLink')}
              </button>
            </div>
          </>
        ) : (
          <div className="card-subtitle">{t('circle.inviteSetup')}</div>
        )}
      </div>
    </>
  );
}

function MemberRow({ label, variant, canRemove, onRemove, removeLabel }) {
  return (
    <div className="member-row">
      <span className={`member-tag member-tag--${variant}`}>{label}</span>
      {canRemove && (
        <button
          type="button"
          className="member-remove-btn btn btn-ghost btn-sm btn-delete"
          onClick={onRemove}
          aria-label={removeLabel}
        >
          ✕
        </button>
      )}
    </div>
  );
}
