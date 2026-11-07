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
  HealthData: undefined;
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
  FamilyDetail: { memberId: string };
  SharingSettings: undefined;
  AiChat: undefined;
  Plans: undefined;
  SubscriptionCheckout: { planId: string };
};
