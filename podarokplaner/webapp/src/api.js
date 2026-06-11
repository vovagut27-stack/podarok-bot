const tg = window.Telegram?.WebApp;

function getInitData() {
  return tg?.initData || '';
}

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': getInitData(),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      text.startsWith('The page') || text.startsWith('<!DOCTYPE')
        ? 'Сервер недоступен. Попробуйте позже.'
        : text.slice(0, 100) || 'Request failed'
    );
  }

  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  getMe: () => request('/me'),
  getCircles: () => request('/circles'),
  createCircle: (name, members) => request('/circles', { method: 'POST', body: { name, members } }),
  getCircle: (id) => request(`/circles/${id}`),
  getCirclePreview: (id) => request(`/circles/${id}/preview`),
  joinCircle: (id) => request(`/circles/${id}/join`, { method: 'POST' }),
  addMember: (circleId, displayName) =>
    request(`/circles/${circleId}/members`, { method: 'POST', body: { displayName } }),
  createEvent: (circleId, data) =>
    request(`/circles/${circleId}/events`, { method: 'POST', body: data }),
  deleteEvent: (id) => request(`/events/${id}`, { method: 'DELETE' }),
  getUpcomingEvents: () => request('/events/upcoming'),
  getWishlist: (circleId) => request(`/circles/${circleId}/wishlist`),
  addWishlistItem: (wishlistId, item) =>
    request(`/wishlists/${wishlistId}/items`, { method: 'POST', body: item }),
  updateWishlistItem: (id, item) =>
    request(`/wishlist-items/${id}`, { method: 'PUT', body: item }),
  deleteWishlistItem: (id) => request(`/wishlist-items/${id}`, { method: 'DELETE' }),
  requestPremium: () => request('/premium/invoice', { method: 'POST' }),
  getConfig: async () => {
    const res = await fetch('/api/config');
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  },
};

export function buildCircleInviteLink(botUsername, circleId) {
  const user = botUsername?.replace(/^@/, '');
  if (!user || !circleId) return '';
  return `https://t.me/${user}?start=circle_${circleId}`;
}

export function shareInviteLink(link, circleName) {
  const text = `Присоединяйся к кругу «${circleName}» в Подарок.бот 🎁`;
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(shareUrl);
    return;
  }
  if (navigator.share) {
    navigator.share({ title: 'Подарок.бот', text, url: link }).catch(() => {});
    return;
  }
  navigator.clipboard?.writeText(`${text}\n${link}`);
}

export function getStartParam() {
  const params = new URLSearchParams(window.location.search);
  return params.get('startapp') || tg?.initDataUnsafe?.start_param || '';
}

export function haptic(type = 'light') {
  const h = tg?.HapticFeedback;
  if (!h) return;

  if (type === 'success' || type === 'error' || type === 'warning') {
    h.notificationOccurred(type);
    return;
  }

  const impactStyles = ['light', 'medium', 'heavy', 'rigid', 'soft'];
  h.impactOccurred(impactStyles.includes(type) ? type : 'light');
}

export { tg };
