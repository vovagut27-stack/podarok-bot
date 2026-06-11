export function isPremiumUser(user) {
  if (!user) return false;
  const active = Number(user.is_premium) === 1 || user.is_premium === true;
  if (!active) return false;
  if (!user.premium_until) return true;
  return new Date(user.premium_until) > new Date();
}
