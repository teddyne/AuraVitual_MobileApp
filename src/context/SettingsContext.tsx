import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, type Locale } from '../i18n/translations';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemePalette = {
  background: string;
  card: string;
  cardAlt: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  primaryDark: string;
  danger: string;
  gold: string;
};

const LIGHT: ThemePalette = {
  background: '#F9F9FF',
  card: '#FFFFFF',
  cardAlt: '#F1F8E9',
  text: '#222222',
  muted: '#666666',
  border: '#E0E0E0',
  primary: '#4CAF50',
  primaryDark: '#2E7D32',
  danger: '#C62828',
  gold: '#B8860B',
};
const DARK: ThemePalette = {
  background: '#121417',
  card: '#1E2126',
  cardAlt: '#232A22',
  text: '#F5F5F5',
  muted: '#AAAAAA',
  border: '#333333',
  primary: '#66BB6A',
  primaryDark: '#81C784',
  danger: '#EF9A9A',
  gold: '#FFD54F',
};

type SettingsValue = {
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
  locale: Locale;
  setLocale: (l: Locale) => void;
  theme: ThemePalette;
  isDark: boolean;
  t: (key: string) => string;
};

const Ctx = createContext<SettingsValue>(null as any);
export const useSettings = () => useContext(Ctx);

function lookup(obj: any, key: string): string | undefined {
  return key
    .split('.')
    .reduce((acc, part) => (acc ? acc[part] : undefined), obj);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [locale, setLocaleState] = useState<Locale>('vi');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [savedTheme, savedLocale] = await Promise.all([
        AsyncStorage.getItem('auravital:themeMode'),
        AsyncStorage.getItem('auravital:locale'),
      ]);
      if (
        savedTheme === 'light' ||
        savedTheme === 'dark' ||
        savedTheme === 'system'
      )
        setThemeModeState(savedTheme);
      if (savedLocale === 'vi' || savedLocale === 'en')
        setLocaleState(savedLocale);
      setLoaded(true);
    })();
  }, []);

  const setThemeMode = (m: ThemeMode) => {
    setThemeModeState(m);
    if (loaded) AsyncStorage.setItem('auravital:themeMode', m);
    else AsyncStorage.setItem('auravital:themeMode', m);
  };
  const setLocale = (l: Locale) => {
    setLocaleState(l);
    AsyncStorage.setItem('auravital:locale', l);
  };

  const isDark =
    themeMode === 'dark' || (themeMode === 'system' && scheme === 'dark');
  const theme = isDark ? DARK : LIGHT;

  const t = useMemo(
    () => (key: string) => {
      return (
        lookup(translations[locale], key) ?? lookup(translations.vi, key) ?? key
      );
    },
    [locale],
  );

  const value = useMemo(
    () => ({ themeMode, setThemeMode, locale, setLocale, theme, isDark, t }),
    [themeMode, locale, theme, isDark, t],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
