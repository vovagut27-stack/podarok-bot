import { useState, useEffect } from 'react';
import { api, tg, haptic } from '../api';
import { useLocale } from '../i18n/LocaleContext';

export default function Settings({ user }) {
  const { locale, setLocale, t, dateLocale: dl } = useLocale();
  const [config, setConfig] = useState({});

  useEffect(() => {
    api.getConfig().then(setConfig);
  }, []);

  const stats = user ? {
    premium: user.is_premium,
    premiumUntil: user.premium_until,
  } : {};

  async function handlePremium() {
    haptic('medium');
    try {
      await api.requestPremium();
      alert(t('settings.premiumSent'));
    } catch {
      alert(t('settings.premiumError'));
    }
  }

  function openDonate() {
    haptic('medium');
    const url = config.donateUrl;
    if (url) tg?.openLink(url);
  }

  function switchLocale(next) {
    if (next === locale) return;
    haptic('light');
    setLocale(next);
    api.setLocale(next).catch(() => {});
  }

  const commandsHtml = t('settings.commandsList').replace(/\n/g, '<br />');

  return (
    <>
      <div className="section-title">{t('settings.language')}</div>
      <div className="card">
        <div className="lang-switch">
          <button
            type="button"
            className={`lang-switch-btn ${locale === 'ru' ? 'active' : ''}`}
            onClick={() => switchLocale('ru')}
          >
            🇷🇺 {t('settings.languageRu')}
          </button>
          <button
            type="button"
            className={`lang-switch-btn ${locale === 'en' ? 'active' : ''}`}
            onClick={() => switchLocale('en')}
          >
            🇬🇧 {t('settings.languageEn')}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          {user?.first_name || t('app.user')}
          {stats.premium && <span className="premium-badge" style={{ marginLeft: 8 }}>⭐ Premium</span>}
        </div>
        {user?.username && (
          <div className="card-subtitle">@{user.username}</div>
        )}
      </div>

      {config.donateUrl && (
        <>
          <div className="section-title">{t('settings.support')}</div>
          <div className="card">
            <div className="card-subtitle" style={{ marginBottom: 12, lineHeight: 1.5 }}>
              {t('settings.supportHint')}
            </div>
            <button className="btn btn-primary" onClick={openDonate}>
              {t('settings.supportBtn')}
            </button>
          </div>
        </>
      )}

      <div className="section-title">Premium</div>
      <div className="card">
        {stats.premium ? (
          <>
            <div className="card-title">{t('settings.premiumActive')}</div>
            <div className="card-subtitle">
              {stats.premiumUntil
                ? t('settings.premiumUntil', {
                    date: new Date(stats.premiumUntil).toLocaleDateString(dl),
                  })
                : t('settings.premiumUnlimited')}
            </div>
          </>
        ) : (
          <>
            <div className="card-title">{t('settings.freePlan')}</div>
            <div className="card-subtitle" style={{ marginBottom: 12 }}>
              {t('settings.freeLimit')}
            </div>
            <ul style={{ fontSize: 14, paddingLeft: 20, marginBottom: 16, lineHeight: 1.8 }}>
              <li>{t('settings.premiumFeature1')}</li>
              <li>{t('settings.premiumFeature2')}</li>
              <li>{t('settings.premiumFeature3')}</li>
            </ul>
            <button className="btn btn-primary" onClick={handlePremium}>
              {t('settings.premiumBtn', { stars: config.premiumStars || 500 })}
            </button>
          </>
        )}
      </div>

      <div className="section-title">{t('settings.about')}</div>
      <div className="card">
        <div className="card-subtitle" style={{ lineHeight: 1.6 }}>
          {t('settings.aboutText')}
        </div>
      </div>

      <div className="section-title">{t('settings.commands')}</div>
      <div className="card">
        <div
          className="card-subtitle"
          style={{ lineHeight: 2 }}
          dangerouslySetInnerHTML={{ __html: commandsHtml }}
        />
      </div>
    </>
  );
}
