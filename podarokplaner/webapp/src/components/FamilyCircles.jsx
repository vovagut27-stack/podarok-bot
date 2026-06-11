export default function FamilyCircles({ circles, events, onCreate, onSelect, onViewEvents }) {
  return (
    <>
      {events.length > 0 && (
        <>
          <div className="section-title">Ближайшие события</div>
          {events.slice(0, 5).map(event => (
            <div key={event.id} className="card" onClick={onViewEvents} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="card-title">
                    {eventTypeEmoji(event.event_type)} {event.name}
                  </div>
                  <div className="card-subtitle">{event.circle_name} · {event.event_date}</div>
                </div>
                <span className="badge">{formatDays(event.event_date)}</span>
              </div>
            </div>
          ))}
        </>
      )}

      <div className="section-title">Мои семейные круги</div>

      {circles.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">👨‍👩‍👧‍👦</div>
          <p>Создайте первый семейный круг<br />и добавьте близких</p>
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
              {circle.member_count} участников · {circle.event_count} событий
            </div>
          </div>
        ))
      )}

      <button className="btn btn-primary" onClick={onCreate} style={{ marginTop: 16 }}>
        + Создать новый круг
      </button>
    </>
  );
}

function eventTypeEmoji(type) {
  return { birthday: '🎂', anniversary: '💍', holiday: '🎄', other: '📅' }[type] || '📅';
}

function formatDays(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const event = new Date(dateStr + 'T00:00:00');
  const days = Math.ceil((event - today) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Сегодня';
  if (days === 1) return 'Завтра';
  return `${days} дн.`;
}
