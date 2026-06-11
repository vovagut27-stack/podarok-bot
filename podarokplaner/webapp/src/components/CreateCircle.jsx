import { useState } from 'react';
import { api, haptic } from '../api';
import { useLocale } from '../i18n/LocaleContext';
import { translateApiError } from '../i18n/translations';

export default function CreateCircle({ onCreated, onCancel }) {
  const { t, locale } = useLocale();
  const [name, setName] = useState('');
  const [members, setMembers] = useState([{ name: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function addMemberField() {
    setMembers([...members, { name: '' }]);
  }

  function updateMember(index, value) {
    const updated = [...members];
    updated[index] = { name: value };
    setMembers(updated);
  }

  function removeMember(index) {
    setMembers(members.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError(null);
    haptic('medium');

    try {
      const filteredMembers = members.filter(m => m.name.trim());
      const circle = await api.createCircle(name.trim(), filteredMembers);
      haptic('success');
      onCreated(circle);
    } catch (err) {
      if (err.data?.premiumRequired) {
        setError(t('create.premiumLimit'));
      } else {
        setError(translateApiError(err.message, locale));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error-banner">{error}</div>}

      <div className="form-group">
        <label>{t('create.circleName')}</label>
        <input
          required
          placeholder={t('create.circleNamePlaceholder')}
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
      </div>

      <div className="section-title">{t('create.membersSection')}</div>
      <p style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)', marginBottom: 12 }}>
        {t('create.membersHint')}
      </p>

      {members.map((m, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            placeholder={t('create.memberN', { n: i + 1 })}
            value={m.name}
            onChange={e => updateMember(i, e.target.value)}
            style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb' }}
          />
          {members.length > 1 && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeMember(i)}>
              ✕
            </button>
          )}
        </div>
      ))}

      <button type="button" className="btn btn-ghost" onClick={addMemberField}>
        {t('create.addMember')}
      </button>

      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          {t('create.cancel')}
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? t('create.submitting') : t('create.submit')}
        </button>
      </div>
    </form>
  );
}
