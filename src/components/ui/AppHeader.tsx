import React, { type ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../../context/SettingsContext';
import { AppIcon } from './AppIcon';

// Header dùng chung cho các màn hình stack. Trước đây mỗi màn hình tự vẽ
// header (nút back, cỡ chữ, màu chữ mỗi chỗ một kiểu) nên nhìn không đồng
// bộ. Từ nay màn hình nào cần header thì gọi component này, không tự vẽ nữa.
//
// Cách dùng:
//   <AppHeader title="Theo dõi giấc ngủ" />
//   <AppHeader title="..." right={<Nút chuông / nút làm mới />} />
//   <AppHeader title="..." onBack={() => navigation.navigate('Main')} />
//
// Lưu ý withTopInset: mặc định true, header tự chừa khoảng tai thỏ /
// thanh trạng thái. Màn hình nào đã bọc SafeAreaView ở ngoài rồi thì
// truyền withTopInset={false} để khỏi bị chừa 2 lần.
type AppHeaderProps = {
  title: string;
  onBack?: () => void;
  showBack?: boolean;
  right?: ReactNode;
  withTopInset?: boolean;
};

export function AppHeader({
  title,
  onBack,
  showBack = true,
  right,
  withTopInset = true,
}: AppHeaderProps) {
  const { theme } = useSettings();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <View style={{ paddingTop: withTopInset ? insets.top : 0 }}>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
      >
        {showBack && (
          <TouchableOpacity
            onPress={handleBack}
            hitSlop={8}
            style={{ marginRight: 12 }}
          >
            <AppIcon name="chevron-back" size={24} tone="text" />
          </TouchableOpacity>
        )}
        <Text
          style={{
            flex: 1,
            fontSize: 18,
            fontWeight: '700',
            color: theme.text,
          }}
        >
          {title}
        </Text>
        {right}
      </View>
    </View>
  );
}
