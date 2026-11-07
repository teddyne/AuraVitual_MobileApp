import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { AuthProvider } from './src/features/auth/AuthContext';
import { SettingsProvider, useSettings } from './src/context/SettingsContext';
import { ToastProvider, ToastBanner } from './src/components/NotificationToast';
import RootNavigator from './src/navigation/RootNavigator';
import AlarmWatcher from './src/components/AlarmWatcher';
import FamilyWatcher from './src/components/FamilyWatcher';
import { navigationRef } from './src/lib/navigationRef';
import { setPendingDeepLink } from './src/lib/pendingDeepLink';
import { SubscriptionProvider } from './src/context/SubscriptionContext';

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
        <FamilyWatcher />
      </NavigationContainer>
      {/* Toast hiện trên mọi màn hình nên đặt ngoài NavigationContainer */}
      <ToastBanner />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SettingsProvider>
          <SubscriptionProvider>
            <ToastProvider>
              <AppContent />
            </ToastProvider>
          </SubscriptionProvider>
        </SettingsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
