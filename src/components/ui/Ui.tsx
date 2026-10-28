import React, { type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '../../theme/colors';

// Nút pill màu Xanh Sage, dùng chung cho cả 3 màn hình.
export function PillButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.pill, disabled && styles.pillDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <Text style={styles.pillText}>{title}</Text>
    </TouchableOpacity>
  );
}

export function Field({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  right,
  keyboardType,
  autoCapitalize = 'none',
}: {
  label: string;
  icon?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  right?: ReactNode;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'words';
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
        />
        {right}
      </View>
    </View>
  );
}

// Thanh đo độ mạnh mật khẩu 4 vạch như màn Sign Up trong ảnh.
export function StrengthMeter({ score }: { score: number }) {
  const label =
    score <= 1
      ? 'Yếu'
      : score === 2
        ? 'Trung bình'
        : score === 3
          ? 'Khá'
          : 'Mạnh';
  return (
    <View style={styles.strengthWrap}>
      <View style={styles.bars}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.bar, i < score && styles.barFilled]} />
        ))}
      </View>
      <Text style={styles.strengthText}>{score === 0 ? '' : label}</Text>
    </View>
  );
}

export function CheckBox({
  checked,
  onPress,
  children,
}: {
  checked: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <TouchableOpacity
      style={styles.checkRow}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.checkBox, checked && styles.checkBoxOn]}>
        {checked ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.sage,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  pillDisabled: { opacity: 0.5 },
  pillText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  fieldWrap: { marginBottom: 16 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  icon: { fontSize: 18, marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: colors.ink, paddingVertical: 14 },
  strengthWrap: { marginTop: -8, marginBottom: 16 },
  bars: { flexDirection: 'row', gap: 6 },
  bar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.border },
  barFilled: { backgroundColor: colors.sage },
  strengthText: {
    fontSize: 12,
    color: colors.sageDark,
    marginTop: 6,
    fontWeight: '600',
  },
  checkRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: { backgroundColor: colors.sage },
  checkMark: { color: colors.white, fontWeight: '800' },
});
