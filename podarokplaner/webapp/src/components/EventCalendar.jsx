import { useLocale } from '../i18n/LocaleContext';

export default function EventCalendar({ events }) {
  const { t, dateLocale: dl } = useLocale();

  if (events.length === 0) {
    return (
      <div className="empty-state">
        <div className="emoji">📅</div>
        <p>{t('events.empty')}</p>
        <p style={{ fontSize: 13, marginTop: 8 }}>{t('events.emptyHint')}</p>
      </div>
    );
  }

  const grouped = groupByMonth(events, dl);

  return (
    <>
      {Object.entries(grouped).map(([month, monthEvents]) => (
        <div key={month}>
          <div className="section-title">{month}</div>
          {monthEvents.map(event => (
            <div key={event.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="card-title">
                    {eventTypeEmoji(event.event_type)} {event.name}
                  </div>
                  <div className="card-subtitle">
                    {event.circle_name}
                    {event.celebrant_name && ` · ${event.celebrant_name}`}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 4, color: 'var(--tg-theme-hint-color)' }}>
                    {formatDate(event.event_date, dl)}
                  </div>
                </div>
                <CountdownBadge dateStr={event.event_date} t={t} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

function CountdownBadge({ dateStr, t }) {
  const days = daysUntil(dateStr);

  if (days === 0) {
    return <span className="badge" style={{ background: '#fef2f2', color: '#dc2626' }}>{t('time.todayExcl')}</span>;
  }
  if (days === 1) return <span className="badge">{t('time.tomorrow')}</span>;
  if (days <= 7) return <span className="badge">{t('time.days', { n: days })}</span>;
  if (days <= 30) return <span className="badge" style={{ background: '#f3f4f6', color: '#6b7280' }}>{t('time.daysShort', { n: days })}</span>;
  return (
    <span className="badge" style={{ background: '#f3f4f6', color: '#6b7280' }}>
      {t('time.weeks', { n: Math.ceil(days / 7) })}
    </span>
  );
}

function groupByMonth(events, dl) {
  const months = {};
  for (const event of events) {
    const d = new Date(event.event_date + 'T00:00:00');
    const key = d.toLocaleDateString(dl, { month: 'long', year: 'numeric' });
    if (!months[key]) months[key] = [];
    months[key].push(event);
  }
  return months;
}

function eventTypeEmoji(type) {
  return { birthday: '🎂', anniversary: '💍', holiday: '🎄', other: '📅' }[type] || '📅';
}

function formatDate(dateStr, dl) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(dl, { weekday: 'long', day: 'numeric', month: 'long' });
}

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const event = new Date(dateStr + 'T00:00:00');
  return Math.ceil((event - today) / (1000 * 60 * 60 * 24));
}
