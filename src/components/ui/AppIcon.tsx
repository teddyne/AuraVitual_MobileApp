import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../context/SettingsContext';

// Icon dùng chung cho toàn app. Thư viện đã thống nhất là Ionicons,
// component này chỉ khóa thêm 2 thứ hay lệch nhau giữa các màn hình:
// cỡ icon và màu icon (lấy từ theme sáng/tối, không ghi cứng mã màu).
export type AppIconName = React.ComponentProps<typeof Ionicons>['name'];

export type AppIconTone =
  | 'text'
  | 'muted'
  | 'primary'
  | 'primaryDark'
  | 'danger'
  | 'gold';

const SIZES = { sm: 18, md: 22, lg: 28 } as const;

type AppIconProps = {
  name: AppIconName;
  // sm = icon nhỏ trong dòng (18), md = icon tab và nút thường (22),
  // lg = icon lớn, tiêu điểm (28). Truyền số để dùng cỡ khác khi cần.
  size?: keyof typeof SIZES | number;
  // tone lấy màu từ theme. Truyền color để ghi đè khi thật sự cần.
  tone?: AppIconTone;
  color?: string;
};

export function AppIcon({ name, size = 'md', tone = 'text', color }: AppIconProps) {
  const { theme } = useSettings();
  const tones: Record<AppIconTone, string> = {
    text: theme.text,
    muted: theme.muted,
    primary: theme.primary,
    primaryDark: theme.primaryDark,
    danger: theme.danger,
    gold: theme.gold,
  };
  return (
    <Ionicons
      name={name}
      size={typeof size === 'number' ? size : SIZES[size]}
      color={color ?? tones[tone]}
    />
  );
}
