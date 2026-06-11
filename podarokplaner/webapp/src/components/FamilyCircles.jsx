import { useLocale } from '../i18n/LocaleContext';
import { circleGradient, circleInitials, eventAccent, eventEmoji } from '../ui';

export default function FamilyCircles({ circles, events, onCreate, onSelect, onViewEvents }) {
  const { t } = useLocale();

  return (
    <>
      <div className="stats-strip">
        <div className="stat-pill">
          <div className="stat-pill-value">{circles.length}</div>
          <div className="stat-pill-label">{t('nav.circles')}</div>
        </div>
        <div className="stat-pill">
          <div className="stat-pill-value">{events.length}</div>
          <div className="stat-pill-label">{t('nav.events')}</div>
        </div>
        <div className="stat-pill">
          <div className="stat-pill-value">
            {events.filter(e => daysUntil(e.event_date) <= 7).length}
          </div>
          <div className="stat-pill-label">{t('time.thisWeek')}</div>
        </div>
      </div>

      {events.length > 0 && (
        <>
          <div className="section-title">{t('home.upcomingEvents')}</div>
          <div className="event-scroll">
            {events.slice(0, 8).map(event => (
              <div
                key={event.id}
                className="event-chip"
                onClick={onViewEvents}
                style={{ borderTop: `3px solid ${eventAccent(event.event_type)}` }}
              >
                <div className="event-chip-emoji">{eventEmoji(event.event_type)}</div>
                <div className="event-chip-title">{event.name}</div>
                <div className="event-chip-meta">
                  {event.circle_name} · {formatDays(event.event_date, t)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-title">{t('home.myCircles')}</div>

      {circles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👥</div>
          <p style={{ whiteSpace: 'pre-line' }}>{t('home.emptyCircles')}</p>
        </div>
      ) : (
        circles.map(circle => (
          <div
            key={circle.id}
            className="card card--interactive"
            onClick={() => onSelect(circle)}
          >
            <div className="circle-row">
              <div
                className="circle-avatar"
                style={{ background: circleGradient(circle.name) }}
              >
                {circleInitials(circle.name)}
              </div>
              <div className="circle-row-body">
                <div className="card-title">{circle.name}</div>
                <div className="card-subtitle">
                  {t('home.membersEvents', {
                    members: circle.member_count,
                    events: circle.event_count,
                  })}
                </div>
              </div>
              <span className="circle-row-arrow">›</span>
            </div>
          </div>
        ))
      )}

      <button type="button" className="btn btn-primary btn-fab" onClick={onCreate}>
        ✨ {t('home.createCircle')}
      </button>
    </>
  );
}

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const event = new Date(dateStr + 'T00:00:00');
  return Math.ceil((event - today) / (1000 * 60 * 60 * 24));
}

function formatDays(dateStr, t) {
  const days = daysUntil(dateStr);
  if (days === 0) return t('time.today');
  if (days === 1) return t('time.tomorrow');
  return t('time.daysShort', { n: days });
}
