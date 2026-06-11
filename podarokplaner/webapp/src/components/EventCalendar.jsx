export default function EventCalendar({ events }) {
  if (events.length === 0) {
    return (
      <div className="empty-state">
        <div className="emoji">📅</div>
        <p>Нет предстоящих событий</p>
        <p style={{ fontSize: 13, marginTop: 8 }}>
          Добавьте даты в круге
        </p>
      </div>
    );
  }

  const grouped = groupByMonth(events);

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
                    {formatDate(event.event_date)}
                  </div>
                </div>
                <CountdownBadge dateStr={event.event_date} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

function CountdownBadge({ dateStr }) {
  const days = daysUntil(dateStr);

  if (days === 0) return <span className="badge" style={{ background: '#fef2f2', color: '#dc2626' }}>Сегодня!</span>;
  if (days === 1) return <span className="badge">Завтра</span>;
  if (days <= 7) return <span className="badge">{days} дней</span>;
  if (days <= 30) return <span className="badge" style={{ background: '#f3f4f6', color: '#6b7280' }}>{days} дн.</span>;
  return <span className="badge" style={{ background: '#f3f4f6', color: '#6b7280' }}>{Math.ceil(days / 7)} нед.</span>;
}

function groupByMonth(events) {
  const months = {};
  for (const event of events) {
    const d = new Date(event.event_date + 'T00:00:00');
    const key = d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    if (!months[key]) months[key] = [];
    months[key].push(event);
  }
  return months;
}

function eventTypeEmoji(type) {
  return { birthday: '🎂', anniversary: '💍', holiday: '🎄', other: '📅' }[type] || '📅';
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
}

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const event = new Date(dateStr + 'T00:00:00');
  return Math.ceil((event - today) / (1000 * 60 * 60 * 24));
}
