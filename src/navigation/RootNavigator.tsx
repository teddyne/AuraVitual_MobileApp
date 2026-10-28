import React from 'react';
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
import WorkoutLogScreen from '../features/workout/screens/WorkoutLogScreen';
import AddWorkoutScreen from '../features/workout/screens/AddWorkoutScreen';

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
  Home: undefined;
  ProfileSetup: undefined;
  Recommendation: { recommendation?: any } | undefined;
  Main: undefined;
  StepsDetail: undefined;
  SleepTracker:
    | {
        alarm?: boolean;
        alarmId?: string | null;
        autoSleep?: boolean;
        triggerToken?: number;
      }
    | undefined;
  CycleTracking: undefined;
  Reminders: undefined;
  Notifications: undefined;
  Nutrition: undefined;
  AddMeal:
    | { mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack'; date?: string }
    | undefined;
  AddFood: undefined;
  WorkoutPlayer: { postId: string };
  ArticleDetail: { postId: string };
  WorkoutLog: { postId?: string; minutes?: number } | undefined;
  AddWorkout: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
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
      <Stack.Screen name='SleepTracker' component={SleepTrackerScreen} />
      <Stack.Screen name='CycleTracking' component={CycleTrackingScreen} />
      <Stack.Screen name='WorkoutPlayer' component={WorkoutPlayerScreen} />
      <Stack.Screen name='ArticleDetail' component={ArticleDetailScreen} />
      <Stack.Screen name='WorkoutLog' component={WorkoutLogScreen} />
      <Stack.Screen name='AddWorkout' component={AddWorkoutScreen} />
    </Stack.Navigator>
  );
}
