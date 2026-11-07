import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import ProfileSettingsScreen from '../features/profile/screens/ProfileSettingsScreen';
import { useSettings } from '../context/SettingsContext';
import ExploreScreen from '../features/explore/screens/ExploreScreen';
import HomeScreen from '../features/home/screens/HomeScreen';
import SharingScreen from '../features/family/screens/SharingScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  const { theme, t } = useSettings();
  const insets = useSafeAreaInsets();
  const bottomPad = insets.bottom || 48;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primaryDark,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          paddingTop: 4,
          paddingBottom: bottomPad + 5,
          height: 37 + bottomPad,
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
          component={SharingScreen}
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
  );
}
