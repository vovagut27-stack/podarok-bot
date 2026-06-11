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
};

export function getStartParam() {
  const params = new URLSearchParams(window.location.search);
  return params.get('startapp') || tg?.initDataUnsafe?.start_param || '';
}

export function haptic(type = 'light') {
  tg?.HapticFeedback?.impactOccurred(type);
}

export { tg };
