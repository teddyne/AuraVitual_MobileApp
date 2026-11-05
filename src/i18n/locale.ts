// Module giu locale hien tai cho code NGOAI React (lib, watcher, notification).
// SettingsProvider cap nhat no moi khi setLocale / load locale da luu.
// Dung translate() o lib thay vi hook useSettings().
import { translations, type Locale } from './translations';

let currentLocale: Locale = 'vi';

export function setCurrentLocale(l: Locale) {
  currentLocale = l;
}

export function getCurrentLocale(): Locale {
  return currentLocale;
}

function lookup(obj: any, key: string): string | undefined {
  return key
    .split('.')
    .reduce((acc, part) => (acc ? acc[part] : undefined), obj);
}

export function translate(
  key: string,
  vars?: Record<string, string | number>,
): string {
  let s =
    lookup(translations[currentLocale], key) ??
    lookup(translations.vi, key) ??
    key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

/** Chuoi locale cho toLocaleString/toLocaleDateString theo ngon ngu hien tai. */
export function displayLocale(): string {
  return currentLocale === 'vi' ? 'vi-VN' : 'en-US';
}
