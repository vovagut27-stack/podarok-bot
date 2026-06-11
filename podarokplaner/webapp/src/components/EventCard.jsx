import { useLocale } from '../i18n/LocaleContext';
import { eventAccent, eventEmoji } from '../ui';
import { haptic } from '../api';

export default function EventCard({
  event,
  onDelete,
  showCircle = false,
  showDateDetail = false,
}) {
  const { t, dateLocale: dl } = useLocale();
  const days = daysUntil(event.event_date);
  const accent = eventAccent(event.event_type);

  let countdown;
  if (days === 0) countdown = t('time.todayExcl');
  else if (days === 1) countdown = t('time.tomorrow');
  else if (days <= 7) countdown = t('time.days', { n: days });
  else if (days <= 30) countdown = t('time.daysShort', { n: days });
  else countdown = t('time.weeks', { n: Math.ceil(days / 7) });

  async function handleDelete(e) {
    e.stopPropagation();
    if (!onDelete) return;
    if (!confirm(t('events.deleteConfirm'))) return;
    haptic('medium');
    try {
      await onDelete(event.id);
    } catch (err) {
      console.error('[EventCard] delete failed:', err);
    }
  }

  return (
    <div className="card event-card-wrap">
      {onDelete && (
        <button
          type="button"
          className="event-delete-btn btn btn-ghost btn-sm btn-delete"
          onClick={handleDelete}
          aria-label={t('events.delete')}
        >
          ✕
        </button>
      )}
      <div className="event-card">
        <div className="event-card-accent" style={{ background: accent }} />
        <div className="event-card-icon" style={{ background: `${accent}18` }}>
          {eventEmoji(event.event_type)}
        </div>
        <div className="event-card-body">
          <div className="card-title">{event.name}</div>
          {showCircle ? (
            <div className="card-subtitle">
              {event.circle_name}
              {event.celebrant_name && ` · ${event.celebrant_name}`}
            </div>
          ) : (
            <div className="card-subtitle">{event.event_date}</div>
          )}
          {showDateDetail && (
            <div className="event-date-detail">
              {formatDate(event.event_date, dl)}
            </div>
          )}
        </div>
        <div className={`countdown ${days <= 7 ? '' : 'countdown--muted'}`}>
          {countdown}
        </div>
      </div>
    </div>
  );
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
