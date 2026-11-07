import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSettings, type ThemePalette } from '../../context/SettingsContext';
import { healthScore } from '../../api/auravitalApi';
import {
  displayNameOf,
  healthBadge,
  timeAgo,
  type FamilyMember,
} from '../../api/familyApi';
import { badgeBg } from '../../utils/family/sharingFormat';

// The thanh vien ket noi trong SharingScreen (doi nguyen van).
export function SharingMemberCard({
  member: m,
  theme,
  onPress,
}: {
  member: FamilyMember;
  theme: ThemePalette;
  onPress: () => void;
}) {
  const { t } = useSettings();
  const score = healthScore(m.latest, {
    step_goal: m.stepGoal,
    water_goal_ml: m.waterGoalMl,
    sleep_goal_hours: m.sleepGoalHours,
  } as any);
  const badge = healthBadge(score);
  const showHr =
    (m.settings ?? { share_enabled: true, share_heart_rate: true } as any)
      .share_enabled !== false &&
    (m.settings?.share_heart_rate ?? true) &&
    m.latest?.heart_rate != null;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.memberCard, { backgroundColor: theme.card, borderColor: theme.border }]}
    >
      <View style={[styles.initialCircle, { backgroundColor: theme.cardAlt }]}>
        <Text style={[styles.initial, { color: theme.primaryDark }]}>
          {displayNameOf(m).charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}>
          <Text style={[styles.memberName, { color: theme.text }]} numberOfLines={1}>
            {displayNameOf(m)}
          </Text>
          <View style={[styles.miniBadge, { backgroundColor: badgeBg(badge) }]}>
            <Text style={[styles.miniBadgeText, { color: theme.text }]}>{badge}</Text>
          </View>
        </View>
        <Text style={[styles.memberSub, { color: theme.muted }]}>
          {m.latest ? t('family.syncedAgo', { time: timeAgo(m.latest.updated_at) }) : t('family.noData')}
        </Text>
      </View>
      {showHr ? (
        <Text style={[styles.bpm, { color: theme.text }]}>♡ {m.latest!.heart_rate} BPM</Text>
      ) : null}
      <Text style={[styles.chev, { color: theme.muted }]}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  memberCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
  initialCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  initial: { fontSize: 20, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberName: { fontSize: 15, fontWeight: '800' },
  miniBadge: { borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 },
  miniBadgeText: { fontSize: 11, fontWeight: '700' },
  memberSub: { fontSize: 13, marginTop: 2 },
  bpm: { fontSize: 14, fontWeight: '700', marginLeft: 8 },
  chev: { fontSize: 22, marginLeft: 6 },
});
