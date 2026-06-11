import { useState, useEffect, useRef } from 'react';
import { api, tg, haptic } from '../api';
import { useLocale } from '../i18n/LocaleContext';

export default function Settings({ user, focusReport = false }) {
  const { locale, setLocale, t, dateLocale: dl } = useLocale();
  const [config, setConfig] = useState({});
  const [reportText, setReportText] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const reportSectionRef = useRef(null);

  useEffect(() => {
    api.getConfig().then(setConfig);
  }, []);

  useEffect(() => {
    if (focusReport && reportSectionRef.current) {
      reportSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [focusReport, config.reportEnabled]);

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

  async function handleSendReport(e) {
    e.preventDefault();
    if (!reportText.trim() || reportSending) return;
    haptic('medium');
    setReportSending(true);
    setReportDone(false);
    try {
      await api.sendReport(reportText.trim());
      setReportText('');
      setReportDone(true);
      haptic('success');
    } catch {
      alert(t('settings.reportError'));
    } finally {
      setReportSending(false);
    }
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

      {config.reportEnabled && (
        <>
          <div className="section-title" ref={reportSectionRef}>{t('settings.report')}</div>
          <div className="card">
            <div className="card-subtitle" style={{ marginBottom: 12, lineHeight: 1.5 }}>
              {t('settings.reportHint')}
            </div>
            <form onSubmit={handleSendReport}>
                <textarea
                  required
                  placeholder={t('settings.reportPlaceholder')}
                  value={reportText}
                  onChange={e => setReportText(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: 100,
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '1px solid #e5e7eb',
                    fontSize: 15,
                    marginBottom: 12,
                    resize: 'vertical',
                  }}
                />
                {reportDone && (
                  <div className="card-subtitle" style={{ marginBottom: 12, color: '#047857' }}>
                    {t('settings.reportSent')}
                  </div>
                )}
                <button type="submit" className="btn btn-primary" disabled={reportSending || !reportText.trim()}>
                  {reportSending ? t('settings.reportSending') : t('settings.reportSend')}
                </button>
              </form>
          </div>
        </>
      )}

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
