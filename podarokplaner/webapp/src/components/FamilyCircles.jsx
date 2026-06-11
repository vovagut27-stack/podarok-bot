import { useLocale } from '../i18n/LocaleContext';

export default function FamilyCircles({ circles, events, onCreate, onSelect, onViewEvents }) {
  const { t } = useLocale();

  return (
    <>
      {events.length > 0 && (
        <>
          <div className="section-title">{t('home.upcomingEvents')}</div>
          {events.slice(0, 5).map(event => (
            <div key={event.id} className="card" onClick={onViewEvents} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="card-title">
                    {eventTypeEmoji(event.event_type)} {event.name}
                  </div>
                  <div className="card-subtitle">{event.circle_name} · {event.event_date}</div>
                </div>
                <span className="badge">{formatDays(event.event_date, t)}</span>
              </div>
            </div>
          ))}
        </>
      )}

      <div className="section-title">{t('home.myCircles')}</div>

      {circles.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">👥</div>
          <p style={{ whiteSpace: 'pre-line' }}>{t('home.emptyCircles')}</p>
        </div>
      ) : (
        circles.map(circle => (
          <div
            key={circle.id}
            className="card"
            onClick={() => onSelect(circle)}
            style={{ cursor: 'pointer' }}
          >
            <div className="card-title">{circle.name}</div>
            <div className="card-subtitle">
              {t('home.membersEvents', {
                members: circle.member_count,
                events: circle.event_count,
              })}
            </div>
          </div>
        ))
      )}

      <button className="btn btn-primary" onClick={onCreate} style={{ marginTop: 16 }}>
        {t('home.createCircle')}
      </button>
    </>
  );
}

function eventTypeEmoji(type) {
  return { birthday: '🎂', anniversary: '💍', holiday: '🎄', other: '📅' }[type] || '📅';
}

function formatDays(dateStr, t) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const event = new Date(dateStr + 'T00:00:00');
  const days = Math.ceil((event - today) / (1000 * 60 * 60 * 24));
  if (days === 0) return t('time.today');
  if (days === 1) return t('time.tomorrow');
  return t('time.daysShort', { n: days });
}
