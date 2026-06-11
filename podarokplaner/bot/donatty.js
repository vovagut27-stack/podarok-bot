const DONATTY_SIGNUP_URL = 'https://donatty.com/creator_bots';

export function getDonattyPageUrl() {
  const url = process.env.DONATTY_PAGE_URL?.trim();
  return url || null;
}

export function getDonattySignupUrl() {
  return DONATTY_SIGNUP_URL;
}

export function donattyDonateKeyboard() {
  const url = getDonattyPageUrl();
  if (!url) return null;
  return {
    inline_keyboard: [[{
      text: '❤️ Поддержать проект',
      url,
    }]],
  };
}

export function appendDonateRow(keyboard) {
  const donate = donattyDonateKeyboard();
  if (!donate) return keyboard;
  return {
    inline_keyboard: [
      ...(keyboard.inline_keyboard || []),
      donate.inline_keyboard[0],
    ],
  };
}
