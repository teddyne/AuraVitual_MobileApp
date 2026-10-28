import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { AuthProvider } from './src/features/auth/AuthContext';
import { SettingsProvider, useSettings } from './src/context/SettingsContext';
import RootNavigator from './src/navigation/RootNavigator';
import AlarmWatcher from './src/components/AlarmWatcher';
import { navigationRef } from './src/lib/navigationRef';
import { setPendingDeepLink } from './src/lib/pendingDeepLink';

const linking = {
  prefixes: [Linking.createURL('/'), 'auravital://'],
  config: {
    screens: {
      ResetPassword: 'ResetPassword',
      ForgotPassword: 'ForgotPassword',
    },
  },
};

function AppContent() {
  const { theme, isDark } = useSettings();

  // Lưu lại deep link mới nhất (kể cả khi app đang chạy nền) để màn
  // ResetPassword đọc được code khôi phục. Chỉ lưu, KHÔNG tự đổi code
  // ở đây — việc đổi code vẫn do ResetPasswordScreen làm một lần duy nhất,
  // tránh trường hợp đổi trùng code rồi màn Reset báo link không hợp lệ.
  useEffect(() => {
    Linking.getInitialURL()
      .then((url) => {
        if (url) setPendingDeepLink(url);
      })
      .catch(() => {});
    const subscription = Linking.addEventListener('url', ({ url }) => {
      setPendingDeepLink(url);
    });
    return () => subscription.remove();
  }, []);

  const navTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: theme.background,
          card: theme.card,
          text: theme.text,
          border: theme.border,
          primary: theme.primary,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: theme.background,
          card: theme.card,
          text: theme.text,
          border: theme.border,
          primary: theme.primary,
        },
      };
  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <NavigationContainer
        theme={navTheme}
        ref={navigationRef}
        linking={linking}
      >
        <RootNavigator />
        <AlarmWatcher />
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <AppContent />
      </SettingsProvider>
    </AuthProvider>
  );
}
