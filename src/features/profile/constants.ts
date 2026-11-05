// Hằng số dùng chung cho cụm hồ sơ (ProfileSetup / Recommendation).
// Dời nguyên văn từ screens/ProfileSetupScreen.tsx (GENDERS, GOALS,
// ACTIVITY_ICONS) và screens/RecommendationScreen.tsx (GOAL_LABEL).

// id là giá trị lưu DB (không đổi); labelKey là key dịch để hiển thị.
export const GENDERS = [
  { id: 'Nam', labelKey: 'settings.male', icon: 'male-outline' },
  { id: 'Nữ', labelKey: 'settings.female', icon: 'female-outline' },
  { id: 'Khác', labelKey: 'settings.other', icon: 'leaf-outline' },
];

// titleKey / descKey là key dịch (profile.goals.*); màn hình gọi t() để hiển thị.
export const GOALS = [
  {
    id: 'maintain',
    icon: 'fitness-outline',
    titleKey: 'profile.goals.maintain.title',
    descKey: 'profile.goals.maintain.desc',
  },
  {
    id: 'lose',
    icon: 'leaf-outline',
    titleKey: 'profile.goals.lose.title',
    descKey: 'profile.goals.lose.desc',
  },
  {
    id: 'gain',
    icon: 'barbell-outline',
    titleKey: 'profile.goals.gain.title',
    descKey: 'profile.goals.gain.desc',
  },
  {
    id: 'sleep',
    icon: 'moon-outline',
    titleKey: 'profile.goals.sleep.title',
    descKey: 'profile.goals.sleep.desc',
  },
  {
    id: 'cycle',
    icon: 'flower-outline',
    titleKey: 'profile.goals.cycle.title',
    descKey: 'profile.goals.cycle.desc',
  },
];

export const ACTIVITY_ICONS: Record<string, string> = {
  sedentary: 'tv-outline',
  light: 'walk-outline',
  moderate: 'bicycle-outline',
  high: 'barbell-outline',
  veryHigh: 'flame-outline',
};

// Giá trị là key dịch (profile.goalLabels.*); màn hình gọi t() để hiển thị,
// goal lạ (không có trong map) thì giữ nguyên chuỗi goal gốc.
export const GOAL_LABEL: Record<string, string> = {
  maintain: 'profile.goalLabels.maintain',
  lose: 'profile.goalLabels.lose',
  gain: 'profile.goalLabels.gain',
  sleep: 'profile.goalLabels.sleep',
  cycle: 'profile.goalLabels.cycle',
};
