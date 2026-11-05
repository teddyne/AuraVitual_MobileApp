// Hằng số dùng chung cho cụm hồ sơ (ProfileSetup / Recommendation).
// Dời nguyên văn từ screens/ProfileSetupScreen.tsx (GENDERS, GOALS,
// ACTIVITY_ICONS) và screens/RecommendationScreen.tsx (GOAL_LABEL).

export const GENDERS = [
  { id: 'Nam', icon: 'male-outline' },
  { id: 'Nữ', icon: 'female-outline' },
  { id: 'Khác', icon: 'leaf-outline' },
];

export const GOALS = [
  {
    id: 'maintain',
    icon: 'fitness-outline',
    title: 'Duy trì vóc dáng & Vận động',
    desc: 'Tăng cường sức bền, duy trì chỉ số vàng',
  },
  {
    id: 'lose',
    icon: 'leaf-outline',
    title: 'Giảm cân & Dinh dưỡng sạch',
    desc: 'Thâm hụt calo lành mạnh, ăn nguyên bản',
  },
  {
    id: 'gain',
    icon: 'barbell-outline',
    title: 'Tăng cân lành mạnh',
    desc: 'Thặng dư calo lành mạnh, tăng cơ, không tăng mỡ',
  },
  {
    id: 'sleep',
    icon: 'moon-outline',
    title: 'Cải thiện giấc ngủ sâu',
    desc: 'Phục hồi thần kinh, giải tỏa căng thẳng',
  },
  {
    id: 'cycle',
    icon: 'flower-outline',
    title: 'Chu kỳ & Nội tiết tố',
    desc: 'Theo dõi nhịp sinh lý nữ & tuần hoàn năng lượng',
  },
];

export const ACTIVITY_ICONS: Record<string, string> = {
  sedentary: 'tv-outline',
  light: 'walk-outline',
  moderate: 'bicycle-outline',
  high: 'barbell-outline',
  veryHigh: 'flame-outline',
};

export const GOAL_LABEL: Record<string, string> = {
  maintain: 'Duy trì vóc dáng',
  lose: 'Giảm cân',
  gain: 'Tăng cân',
  sleep: 'Cải thiện giấc ngủ sâu',
  cycle: 'Chu kỳ & Nội tiết tố',
};
