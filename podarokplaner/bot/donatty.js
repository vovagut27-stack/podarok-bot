import { t } from './i18n.js';

const DONATTY_SIGNUP_URL = 'https://donatty.com/creator_bots';

export function getDonattyPageUrl() {
  const url = process.env.DONATTY_PAGE_URL?.trim();
  return url || null;
}

export function getDonattySignupUrl() {
  return DONATTY_SIGNUP_URL;
}

export function donattyDonateKeyboard(locale = 'ru') {
  const url = getDonattyPageUrl();
  if (!url) return null;
  return {
    inline_keyboard: [[{
      text: t(locale, 'btn.donate'),
      url,
    }]],
  };
}

export function appendDonateRow(keyboard, locale = 'ru') {
  const donate = donattyDonateKeyboard(locale);
  if (!donate) return keyboard;
  return {
    inline_keyboard: [
      ...(keyboard.inline_keyboard || []),
      donate.inline_keyboard[0],
    ],
  };
}
