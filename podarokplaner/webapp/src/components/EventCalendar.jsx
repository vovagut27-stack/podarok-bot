import { useLocale } from '../i18n/LocaleContext';
import EventCard from './EventCard';

export default function EventCalendar({ events, onDelete }) {
  const { t, dateLocale: dl } = useLocale();

  if (events.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📅</div>
        <p>{t('events.empty')}</p>
        <p className="empty-hint">{t('events.emptyHint')}</p>
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
            <EventCard
              key={event.id}
              event={event}
              onDelete={onDelete}
              showCircle
              showDateDetail
            />
          ))}
        </div>
      ))}
    </>
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
