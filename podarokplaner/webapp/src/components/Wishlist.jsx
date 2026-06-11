import { useState, useEffect } from 'react';
import { api, haptic } from '../api';
import { useLocale } from '../i18n/LocaleContext';

export default function Wishlist({ circleId }) {
  const { t } = useLocale();
  const [wishlist, setWishlist] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWishlist();
  }, [circleId]);

  async function loadWishlist() {
    try {
      const data = await api.getWishlist(circleId);
      setWishlist(data.wishlist);
      setItems(data.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    haptic('medium');
    try {
      await api.addWishlistItem(wishlist.id, {
        title: form.title,
        description: form.description,
        priceRange: form.priceRange,
        url: form.url,
        priority: parseInt(form.priority, 10),
      });
      setForm(emptyForm());
      setShowForm(false);
      await loadWishlist();
      haptic('success');
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm(t('wishlist.deleteConfirm'))) return;
    await api.deleteWishlistItem(id);
    await loadWishlist();
  }

  if (loading) return <div className="loading">{t('app.loading')}</div>;

  return (
    <>
      <p style={{ fontSize: 14, color: 'var(--tg-theme-hint-color)', marginBottom: 16 }}>
        {t('wishlist.hint')}
      </p>

      {items.length === 0 && !showForm ? (
        <div className="empty-state">
          <div className="emoji">🎁</div>
          <p>{t('wishlist.empty')}</p>
        </div>
      ) : (
        items.map(item => (
          <div
            key={item.id}
            className={`card priority-${priorityClass(item.priority)}`}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div className="card-title">{item.title}</div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleDelete(item.id)}
                style={{ color: '#dc2626' }}
              >
                ✕
              </button>
            </div>
            {item.description && (
              <p style={{ fontSize: 13, marginTop: 4, color: 'var(--tg-theme-hint-color)' }}>
                {item.description}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
              {item.price_range && <span className="badge">{item.price_range}</span>}
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 13, color: 'var(--accent)' }}
                >
                  {t('wishlist.link')}
                </a>
              )}
            </div>
          </div>
        ))
      )}

      {showForm ? (
        <form className="card" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t('wishlist.itemTitle')}</label>
            <input
              required
              placeholder={t('wishlist.itemTitlePlaceholder')}
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>{t('wishlist.description')}</label>
            <textarea
              placeholder={t('wishlist.descriptionPlaceholder')}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>{t('wishlist.priceRange')}</label>
            <input
              placeholder={t('wishlist.pricePlaceholder')}
              value={form.priceRange}
              onChange={e => setForm({ ...form, priceRange: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>{t('wishlist.productUrl')}</label>
            <input
              type="url"
              placeholder="https://..."
              value={form.url}
              onChange={e => setForm({ ...form, url: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>{t('wishlist.priority')}</label>
            <select
              value={form.priority}
              onChange={e => setForm({ ...form, priority: e.target.value })}
            >
              <option value="3">{t('wishlist.priorityHigh')}</option>
              <option value="2">{t('wishlist.priorityMedium')}</option>
              <option value="1">{t('wishlist.priorityLow')}</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
              {t('create.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '...' : t('circle.add')}
            </button>
          </div>
        </form>
      ) : (
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          {t('wishlist.add')}
        </button>
      )}
    </>
  );
}

function emptyForm() {
  return { title: '', description: '', priceRange: '', url: '', priority: '2' };
}

function priorityClass(priority) {
  if (priority >= 3) return 'high';
  if (priority >= 2) return 'medium';
  return 'low';
}
