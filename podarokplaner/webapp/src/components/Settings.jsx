import { useState, useEffect, useRef } from 'react';
import { api, tg, haptic } from '../api';
import { useLocale } from '../i18n/LocaleContext';
import { translateApiError } from '../i18n/translations';
import { isPremiumUser } from '../userUtils';

export default function Settings({ user, focusReport = false }) {
  const { locale, setLocale, t, dateLocale: dl } = useLocale();
  const [config, setConfig] = useState({});
  const [reportText, setReportText] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [reportError, setReportError] = useState('');
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
    premium: isPremiumUser(user),
    premiumUntil: user.premium_until,
  } : {};

  function showAlert(message) {
    if (tg?.showAlert) tg.showAlert(message);
    else alert(message);
  }

  async function handlePremium() {
    haptic('medium');
    try {
      await api.requestPremium();
      showAlert(t('settings.premiumSent'));
    } catch (err) {
      const message = err.message && err.message !== 'Request failed'
        ? translateApiError(err.message, locale)
        : t('settings.premiumError');
      showAlert(message);
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

  function showReportError(message) {
    setReportError(message);
    if (tg?.showAlert) tg.showAlert(message);
  }

  async function handleSendReport() {
    if (!reportText.trim() || reportSending) return;
    haptic('medium');
    setReportSending(true);
    setReportDone(false);
    setReportError('');
    try {
      await api.sendReport(reportText.trim());
      setReportText('');
      setReportDone(true);
      haptic('success');
    } catch (err) {
      const code = err.data?.code;
      let message = t('settings.reportError');
      if (code === 'CREATOR_UNREACHABLE') {
        message = t('settings.reportCreatorUnreachable');
      } else if (code === 'NOT_CONFIGURED') {
        message = t('settings.reportDisabled');
      } else if (err.status === 401) {
        message = t('errors.openInTelegram');
      } else if (err.message && err.message !== 'Request failed') {
        message = translateApiError(err.message, locale);
      }
      showReportError(message);
      haptic('error');
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
          {stats.premium && <span className="premium-badge-inline">⭐ Premium</span>}
        </div>
        {user?.username && (
          <div className="card-subtitle">@{user.username}</div>
        )}
      </div>

      {config.reportEnabled && (
        <>
          <div className="section-title" ref={reportSectionRef}>{t('settings.report')}</div>
          <div className="card">
            <p className="form-hint">{t('settings.reportHint')}</p>
            <form onSubmit={(e) => { e.preventDefault(); handleSendReport(); }}>
              <textarea
                className="textarea-field"
                required
                placeholder={t('settings.reportPlaceholder')}
                value={reportText}
                onChange={e => {
                  setReportText(e.target.value);
                  if (reportError) setReportError('');
                }}
              />
              {reportDone && (
                <div className="success-text">{t('settings.reportSent')}</div>
              )}
              {reportError && (
                <div className="error-text">{reportError}</div>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSendReport}
                disabled={reportSending || !reportText.trim()}
              >
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
            <p className="form-hint">{t('settings.supportHint')}</p>
            <button type="button" className="btn btn-primary" onClick={openDonate}>
              ❤️ {t('settings.supportBtn')}
            </button>
          </div>
        </>
      )}

      <div className="section-title">Premium</div>
      <div className="card">
        {stats.premium ? (
          <>
            <div className="card-title">⭐ {t('settings.premiumActive')}</div>
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
            <p className="form-hint">{t('settings.freeLimit')}</p>
            <ul className="feature-list">
              <li>{t('settings.premiumFeature1')}</li>
              <li>{t('settings.premiumFeature2')}</li>
              <li>{t('settings.premiumFeature3')}</li>
            </ul>
            <button type="button" className="btn btn-primary" onClick={handlePremium}>
              ⭐ {t('settings.premiumBtn', { stars: config.premiumStars || 500 })}
            </button>
          </>
        )}
      </div>

      <div className="section-title">{t('settings.about')}</div>
      <div className="card">
        <p className="form-hint" style={{ marginBottom: 0 }}>{t('settings.aboutText')}</p>
      </div>

      <div className="section-title">{t('settings.commands')}</div>
      <div className="card">
        <div
          className="card-subtitle commands-list"
          dangerouslySetInnerHTML={{ __html: commandsHtml }}
        />
      </div>
    </>
  );
}
