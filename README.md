## Cấu trúc

```
src/
  api/                  # client + API dữ liệu dùng chung
    supabase.ts         # (từ lib/supabase.ts)
    aiClient.ts         # Gemini, từ lib/aiClient.ts
    auravitalApi.ts, nutritionApi.ts, workoutApi.ts, familyApi.ts
  components/           # DUY NHẤT 1 folder components
    ui/                 # kit dùng chung: AppHeader, AppIcon, Field,
                        # PillButton, CheckBox, StrengthMeter, IconBadge, Ui
    ai/ auth/ cycle/ explore/ family/ health/ home/
    notifications/ nutrition/ profile/ reminders/
    subscription/ workout/
    AlarmWatcher.tsx, FamilyWatcher.tsx, NotificationToast.tsx
  context/              # SettingsContext, SubscriptionContext
  features/             # mỗi phân hệ chỉ còn: screens, api (nếu riêng),
                        # constants, types, service riêng (aiChatService…)
    ai/ auth/ cycle/ explore/ family/ health/ home/
    notifications/ nutrition/ profile/ reminders/
    subscription/ workout/
  i18n/                 # vi / en (không đổi)
  lib/                  # CHỈ CÒN 12 file shim re-export (mục 3)
  navigation/           # RootNavigator, MainTabNavigator,
                        # navigationRef, pendingDeepLink (từ lib/)
  theme/                # colors (không đổi)
  types/
    navigation.ts       # RootStackParamList tách khỏi RootNavigator
  utils/                # DUY NHẤT 1 folder utils
    dates.ts
    auth/ cycle/ family/ health/ home/ notifications/
    nutrition/ profile/ reminders/ workout/
```
