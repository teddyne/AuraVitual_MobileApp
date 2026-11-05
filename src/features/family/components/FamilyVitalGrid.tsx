import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ThemePalette } from '../../../context/SettingsContext';
import { formatSleep } from '../../../lib/auravitalApi';
import {
  stepsToKcal,
  stepsToKm,
  type FamilyMember,
  type SharingSettings,
} from '../../../lib/familyApi';

// Cum chi so sinh hieu trong FamilyDetailScreen (doi nguyen van).
// Tinh toan showHr/showSteps/... va hrStatus doi tu man hinh sang day vi
// chi luoi chi so dung toi chung.
export function FamilyVitalGrid({
  member,
  metric,
  settings,
  theme,
}: {
  member: FamilyMember;
  metric: FamilyMember['latest'];
  settings: SharingSettings;
  theme: ThemePalette;
}) {
  const sharingOff = !settings.share_enabled;
  const showHr = !sharingOff && settings.share_heart_rate && metric?.heart_rate != null;
  const showSteps = !sharingOff && settings.share_steps && metric?.steps != null;
  const showSleep = !sharingOff && settings.share_sleep && metric?.sleep_hours != null;
  const showSpo2 = !sharingOff && settings.share_spo2 && metric?.spo2 != null;
  const showWeight = !sharingOff && settings.share_weight && metric?.weight_kg != null;
  const hrStatus =
    metric?.heart_rate == null
      ? ''
      : metric.heart_rate < 60
        ? 'Thấp (dưới 60)'
        : metric.heart_rate <= 100
          ? 'Bình thường (60-90)'
          : 'Cao (trên 100)';

  if (sharingOff) {
    return (
      <Text style={[styles.notice, { color: theme.muted }]}>
        Thành viên này đã tắt chia sẻ sức khỏe với gia đình.
      </Text>
    );
  }
  if (!metric) {
    return (
      <Text style={[styles.notice, { color: theme.muted }]}>
        Thành viên chưa ghi nhận chỉ số nào.
      </Text>
    );
  }
  return (
    <View style={styles.grid}>
      {showHr && (
        <View style={[styles.vitalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={styles.vitalIcon}>❤️</Text>
          <Text style={[styles.vitalLabel, { color: theme.muted }]}>LÚC NGHỈ</Text>
          <Text style={[styles.vitalValue, { color: theme.text }]}>{metric.heart_rate} <Text style={styles.vitalUnit}>BPM</Text></Text>
          <Text style={[styles.vitalNote, { color: theme.primaryDark }]}>✓ {hrStatus}</Text>
        </View>
      )}
      {showSteps && (
        <View style={[styles.vitalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={styles.vitalIcon}>🏃</Text>
          <Text style={[styles.vitalValue, { color: theme.text }]}>
            {metric.steps!.toLocaleString('vi-VN')}
            <Text style={styles.vitalUnit}> / {member.stepGoal.toLocaleString('vi-VN')}</Text>
          </Text>
          <Text style={[styles.vitalNote, { color: theme.primaryDark }]}>
            {Math.round((metric.steps! / member.stepGoal) * 100)}% • {stepsToKm(metric.steps!).toFixed(1)} km • {stepsToKcal(metric.steps!)} kcal
          </Text>
        </View>
      )}
      {showSleep && (
        <View style={[styles.vitalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={styles.vitalIcon}>🌙</Text>
          <Text style={[styles.vitalValue, { color: theme.text }]}>{formatSleep(metric.sleep_hours)}</Text>
          <Text style={[styles.vitalNote, { color: theme.primaryDark }]}>
            {Math.round((Number(metric.sleep_hours) / member.sleepGoalHours) * 100)}% mục tiêu giấc ngủ
          </Text>
        </View>
      )}
      {showSpo2 && (
        <View style={[styles.vitalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={styles.vitalIcon}>🩸</Text>
          <Text style={[styles.vitalValue, { color: theme.text }]}>SpO2: {metric.spo2}%</Text>
          <Text style={[styles.vitalNote, { color: theme.primaryDark }]}>
            {metric.spo2! >= 95 ? 'Oxy máu lý tưởng' : 'Oxy máu thấp, cần chú ý'}
          </Text>
        </View>
      )}
      {showWeight && (
        <View style={[styles.vitalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={styles.vitalIcon}>⚖️</Text>
          <Text style={[styles.vitalValue, { color: theme.text }]}>{metric.weight_kg} <Text style={styles.vitalUnit}>kg</Text></Text>
          <Text style={[styles.vitalNote, { color: theme.muted }]}>Cân nặng hôm nay</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { fontSize: 14, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  vitalCard: { width: '48%', borderWidth: 1, borderRadius: 14, padding: 12 },
  vitalIcon: { fontSize: 20 },
  vitalLabel: { fontSize: 11, fontWeight: '800', marginTop: 6 },
  vitalValue: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  vitalUnit: { fontSize: 13, fontWeight: '600' },
  vitalNote: { fontSize: 12, marginTop: 4, lineHeight: 16 },
});
