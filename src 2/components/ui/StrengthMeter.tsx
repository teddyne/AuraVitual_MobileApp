import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { useSettings } from '../../context/SettingsContext';

// Thanh đo độ mạnh mật khẩu 4 vạch như màn Sign Up trong ảnh.
export function StrengthMeter({ score }: { score: number }) {
  const { t } = useSettings();
  const label =
    score <= 1
      ? t('shared.passwordStrength.weak')
      : score === 2
        ? t('shared.passwordStrength.fair')
        : score === 3
          ? t('shared.passwordStrength.good')
          : t('shared.passwordStrength.strong');
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

const styles = StyleSheet.create({
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
});
