const PALETTE = [
  ['#ff6b6b', '#ff8e53'],
  ['#a855f7', '#ec4899'],
  ['#06b6d4', '#3b82f6'],
  ['#10b981', '#34d399'],
  ['#f59e0b', '#fbbf24'],
  ['#6366f1', '#8b5cf6'],
];

export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function circleGradient(name = '') {
  const [a, b] = PALETTE[hashString(name) % PALETTE.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

export function circleInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name.trim().slice(0, 2) || '?').toUpperCase();
}

export function eventAccent(type) {
  return {
    birthday: '#ff6b6b',
    anniversary: '#ec4899',
    holiday: '#10b981',
    other: '#6366f1',
  }[type] || '#6366f1';
}

export function eventEmoji(type) {
  return {
    birthday: '🎂',
    anniversary: '💍',
    holiday: '🎄',
    other: '📅',
  }[type] || '📅';
}
