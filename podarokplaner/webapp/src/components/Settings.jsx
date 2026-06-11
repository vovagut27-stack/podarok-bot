import { api, tg, haptic } from '../api';

export default function Settings({ user, onRefresh }) {
  const stats = user ? {
    premium: user.is_premium,
    premiumUntil: user.premium_until,
  } : {};

  async function handlePremium() {
    haptic('medium');
    try {
      await api.requestPremium();
      tg?.close();
    } catch (err) {
      alert('Для оплаты Premium напишите боту команду /premium');
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-title">
          {user?.first_name || 'Пользователь'}
          {stats.premium && <span className="premium-badge" style={{ marginLeft: 8 }}>⭐ Premium</span>}
        </div>
        {user?.username && (
          <div className="card-subtitle">@{user.username}</div>
        )}
      </div>

      <div className="section-title">Premium</div>
      <div className="card">
        {stats.premium ? (
          <>
            <div className="card-title">⭐ Premium активен</div>
            <div className="card-subtitle">
              {stats.premiumUntil
                ? `До ${new Date(stats.premiumUntil).toLocaleDateString('ru-RU')}`
                : 'Безлимитные возможности'}
            </div>
          </>
        ) : (
          <>
            <div className="card-title">Бесплатный план</div>
            <div className="card-subtitle" style={{ marginBottom: 12 }}>
              До 3 кругов
            </div>
            <ul style={{ fontSize: 14, paddingLeft: 20, marginBottom: 16, lineHeight: 1.8 }}>
              <li>Безлимитные круги</li>
              <li>Расширенная аналитика подарков</li>
              <li>Кастомные напоминания</li>
            </ul>
            <button className="btn btn-primary" onClick={handlePremium}>
              ⭐ Premium — 500 Stars/мес
            </button>
          </>
        )}
      </div>

      <div className="section-title">О приложении</div>
      <div className="card">
        <div className="card-subtitle" style={{ lineHeight: 1.6 }}>
          <b>Подарок.бот</b> — wishlist и напоминания о подарках в Telegram.
          Планируйте подарки для друзей, близких и коллег заранее.
        </div>
      </div>

      <div className="section-title">Команды бота</div>
      <div className="card">
        <div className="card-subtitle" style={{ lineHeight: 2 }}>
          /start — начать<br />
          /напомнить — ближайшие события<br />
          /круги — мои круги<br />
          /premium — оформить Premium<br />
          /помощь — справка
        </div>
      </div>
    </>
  );
}
