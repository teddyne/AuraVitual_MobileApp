import React from 'react';
import { Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import ProfileSettingsScreen from '../features/profile/screens/ProfileSettingsScreen';
import { useSettings } from '../context/SettingsContext';
import ExploreScreen from '../features/explore/screens/ExploreScreen';
import HomeScreen from '../features/home/screens/HomeScreen';

const Tab = createBottomTabNavigator();

function Placeholder({ label }: { label: string }) {
  const { theme } = useSettings();
  return (
    <SafeAreaView
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.background,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>
        {label}
      </Text>
    </SafeAreaView>
  );
}

export default function MainTabNavigator() {
  const { theme, t } = useSettings();
  return (
    <SafeAreaProvider>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#2E7D32',
          tabBarInactiveTintColor: theme.muted,
          tabBarStyle: {
            backgroundColor: theme.card,
            borderTopColor: theme.border,
            borderTopWidth: 1,
            paddingTop: 4,
            paddingBottom: 2,
          },
          tabBarItemStyle: {
            paddingVertical: 2,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '700',
          },
        }}
      >
        <Tab.Screen
          name='HomeTab'
          component={HomeScreen}
          options={{
            title: t('tabs.home'),
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? 'pulse' : 'pulse-outline'}
                size={22}
                color={color}
              />
            ),
          }}
        />
        <Tab.Screen
          name='ExploreTab'
          component={ExploreScreen}
          options={{
            title: t('tabs.explore'),
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? 'compass' : 'compass-outline'}
                size={22}
                color={color}
              />
            ),
          }}
        />
        <Tab.Screen
          name='ShareTab'
          component={() => <Placeholder label={t('tabs.share')} />}
          options={{
            title: t('tabs.share'),
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? 'people' : 'people-outline'}
                size={22}
                color={color}
              />
            ),
          }}
        />
        <Tab.Screen
          name='AccountTab'
          component={ProfileSettingsScreen}
          options={{
            title: t('tabs.account'),
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={22}
                color={color}
              />
            ),
          }}
        />
      </Tab.Navigator>
    </SafeAreaProvider>
  );
}
