import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { styles } from '../screens/StepsDetailScreen.styles';

// O nhap tay so buoc hom nay. Doi nguyen van tu StepsDetailScreen.
export function StepsManualForm({
  manualInput,
  onChangeText,
  savingManual,
  onSave,
}: {
  manualInput: string;
  onChangeText: (v: string) => void;
  savingManual: boolean;
  onSave: () => void;
}) {
  return (
    <View style={styles.manualCard}>
      <Text style={styles.cardTitle}>Nhập tay số bước hôm nay</Text>
      <Text style={styles.cardText}>
        Dùng khi điện thoại không có cảm biến, chưa cấp quyền, hoặc bạn muốn
        sửa số hôm nay. Số nhập tay sẽ không bị đồng bộ tự động ghi đè trong
        ngày hôm nay.
      </Text>
      <View style={styles.manualRow}>
        <TextInput
          style={styles.manualInput}
          value={manualInput}
          onChangeText={onChangeText}
          keyboardType='number-pad'
          placeholder='Ví dụ: 6500'
          placeholderTextColor='#999'
        />
        <TouchableOpacity
          style={styles.manualBtn}
          onPress={onSave}
          disabled={savingManual}
        >
          <Text style={styles.manualBtnText}>
            {savingManual ? 'Đang lưu…' : 'Lưu'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
