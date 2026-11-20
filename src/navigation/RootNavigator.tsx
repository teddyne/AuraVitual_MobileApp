import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnboardingScreen from '../features/auth/screens/OnboardingScreen';
import LoginScreen from '../features/auth/screens/LoginScreen';
import SignUpScreen from '../features/auth/screens/SignUpScreen';
import ForgotPasswordScreen from '../features/auth/screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../features/auth/screens/ResetPasswordScreen';
import ProfileSetupScreen from '../features/profile/screens/ProfileSetupScreen';
import MainTabNavigator from './MainTabNavigator';
import HomeScreen from '@/features/home/screens/HomeScreen';
import StepsDetailScreen from '../features/health/screens/StepsDetailScreen';
import HealthDataScreen from '../features/health/screens/HealthDataScreen';
import SleepTrackerScreen from '../features/health/screens/SleepTrackerScreen';
import CycleTrackingScreen from '../features/cycle/screens/CycleTrackingScreen';
import RecommendationScreen from '../features/profile/screens/RecommendationScreen';
import RemindersScreen from '../features/reminders/screens/RemindersScreen';
import NotificationsScreen from '../features/notifications/screens/NotificationsScreen';
import NutritionTrackerScreen from '../features/nutrition/screens/NutritionTrackerScreen';
import AddMealScreen from '../features/nutrition/screens/AddMealScreen';
import AddFoodScreen from '../features/nutrition/screens/AddFoodScreen';
import WorkoutPlayerScreen from '../features/workout/screens/WorkoutPlayerScreen';
import ArticleDetailScreen from '../features/workout/screens/ArticleDetailScreen';
import SavedPostsScreen from '../features/profile/screens/SavedPostsScreen';
import WaterDetailScreen from '../features/water/screens/WaterDetailScreen';
import WorkoutLogScreen from '../features/workout/screens/WorkoutLogScreen';
import AddWorkoutScreen from '../features/workout/screens/AddWorkoutScreen';
import FamilyDetailScreen from '../features/family/screens/FamilyDetailScreen';
import SharingSettingsScreen from '../features/family/screens/SharingSettingsScreen';
import AiChatScreen from '../features/ai/screens/AiChatScreen';
import PlansScreen from '../features/subscription/screens/PlansScreen';
import SubscriptionCheckoutScreen from '../features/subscription/screens/SubscriptionCheckoutScreen';
import type { RootStackParamList } from '../types/navigation';
import { useAuth } from '../features/auth/AuthContext';
import { navigationRef } from './navigationRef';
import { getPendingDeepLink } from './pendingDeepLink';
import { colors } from '../theme/colors';

export type { RootStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, loading } = useAuth();
  const restoredRef = useRef(false);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (loading || restoredRef.current) return;
    console.log(
      '[Nav] gate chay: user=',
      user?.email ?? null,
      'route hien tai=',
      navigationRef.getCurrentRoute()?.name,
      'ready=',
      navigationRef.isReady(),
    );

    if (!navigationRef.isReady()) {
      const t = setTimeout(() => setRetryTick((x) => x + 1), 200);
      return () => clearTimeout(t);
    }
    restoredRef.current = true;
    const pendingUrl = getPendingDeepLink();
    if (pendingUrl && pendingUrl.includes('ResetPassword')) return;
    if (user && navigationRef.getCurrentRoute()?.name === 'Onboarding') {
      navigationRef.reset({ index: 0, routes: [{ name: 'Main' }] });
    }
  }, [loading, user, retryTick]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.white,
        }}
      >
        <Text style={{ fontSize: 26, fontWeight: '700', color: colors.ink }}>
          Aura<Text style={{ color: colors.sageDark }}>Vital</Text>
        </Text>
        <ActivityIndicator
          size='large'
          color={colors.sageDark}
          style={{ marginTop: 24 }}
        />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name='Onboarding' component={OnboardingScreen} />
      <Stack.Screen name='Login' component={LoginScreen} />
      <Stack.Screen name='SignUp' component={SignUpScreen} />
      <Stack.Screen name='ForgotPassword' component={ForgotPasswordScreen} />
      <Stack.Screen name='ResetPassword' component={ResetPasswordScreen} />
      <Stack.Screen name='Home' component={HomeScreen} />
      <Stack.Screen name='ProfileSetup' component={ProfileSetupScreen} />
      <Stack.Screen name='Nutrition' component={NutritionTrackerScreen} />
      <Stack.Screen name='AddMeal' component={AddMealScreen} />
      <Stack.Screen name='AddFood' component={AddFoodScreen} />
      <Stack.Screen name='Recommendation' component={RecommendationScreen} />
      <Stack.Screen name='Reminders' component={RemindersScreen} />
      <Stack.Screen name='Notifications' component={NotificationsScreen} />
      <Stack.Screen name='Main' component={MainTabNavigator} />
      <Stack.Screen name='StepsDetail' component={StepsDetailScreen} />
      <Stack.Screen name='HealthData' component={HealthDataScreen} />
      <Stack.Screen name='SleepTracker' component={SleepTrackerScreen} />
      <Stack.Screen name='CycleTracking' component={CycleTrackingScreen} />
      <Stack.Screen name='WorkoutPlayer' component={WorkoutPlayerScreen} />
      <Stack.Screen name='ArticleDetail' component={ArticleDetailScreen} />
      <Stack.Screen name='SavedPosts' component={SavedPostsScreen} />
      <Stack.Screen name='WaterDetail' component={WaterDetailScreen} />
      <Stack.Screen name='WorkoutLog' component={WorkoutLogScreen} />
      <Stack.Screen name='AddWorkout' component={AddWorkoutScreen} />
      <Stack.Screen name='FamilyDetail' component={FamilyDetailScreen} />
      <Stack.Screen name='SharingSettings' component={SharingSettingsScreen} />
      <Stack.Screen name='AiChat' component={AiChatScreen} />
      <Stack.Screen name='Plans' component={PlansScreen} />
      <Stack.Screen
        name='SubscriptionCheckout'
        component={SubscriptionCheckoutScreen}
      />
    </Stack.Navigator>
  );
}
