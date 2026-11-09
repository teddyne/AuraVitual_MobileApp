import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSettings, type ThemePalette } from '../../context/SettingsContext';
import { AppIcon, type AppIconName } from '../ui/AppIcon';
import { formatSleep } from '../../api/auravitalApi';
import {
  stepsToKcal,
  stepsToKm,
  type FamilyMember,
  type SharingSettings,
} from '../../api/familyApi';

// Cum chi so suc khoe trong FamilyDetailScreen (doi ten tu "Chi so
// sinh hieu" theo yeu cau Nov 2026). Hien 1 card cho MOI muc noi
// dung duoc chia se co tich chon o trang Cai dat & Phan quyen chia
// se (buoc, ngu, nhip tim, SpO2, nuoc, can nang, kcal, chu ky).
// Icon la Ionicons qua AppIcon — dong bo toan app, khong dung emoji.
export function FamilyVitalGrid({
  member,
  metric,
  settings,
  theme,
}: {
  member: FamilyMember;
  metric: FamilyMember['today'];
  settings: SharingSettings;
  theme: ThemePalette;
}) {
  const { t, locale } = useSettings();
  const sharingOff = !settings.share_enabled;
  const showHr = !sharingOff && settings.share_heart_rate && metric?.heart_rate != null;
  const showSteps = !sharingOff && settings.share_steps && metric?.steps != null;
  const showSleep = !sharingOff && settings.share_sleep && metric?.sleep_hours != null;
  const showSpo2 = !sharingOff && settings.share_spo2 && metric?.spo2 != null;
  const showWater = !sharingOff && settings.share_water && metric?.water_ml != null;
  const showWeight = !sharingOff && settings.share_weight && metric?.weight_kg != null;
  const showKcal = !sharingOff && settings.share_kcal && member.kcalToday != null;
  const showCycle = !sharingOff && settings.share_cycle && member.daysToNextPeriod != null;
  const hrStatus =
    metric?.heart_rate == null
      ? ''
      : metric.heart_rate < 60
        ? t('family.hrLow')
        : metric.heart_rate <= 100
          ? t('family.hrNormal')
          : t('family.hrHigh');

  if (sharingOff) {
    return (
      <Text style={[styles.notice, { color: theme.muted }]}>
        {t('family.sharingOff')}
      </Text>
    );
  }
  // Chi hien "chua co du lieu" khi KHONG co card nao co du lieu hom
  // nay. Truoc day chi can hom nay chua co dong health_metrics la ca
  // luoi an mat — ke ca Kcal/Chu ky da co du lieu (2 muc nay doc tu
  // bang meals/cycles, khong phu thuoc dong metrics).
  const anyCard =
    showHr ||
    showSteps ||
    showSleep ||
    showSpo2 ||
    showWater ||
    showWeight ||
    showKcal ||
    showCycle;
  if (!anyCard) {
    return (
      <Text style={[styles.notice, { color: theme.muted }]}>
        {t('family.noMetrics')}
      </Text>
    );
  }
  return (
    <View style={styles.grid}>
      {showHr && (
        <VitalCard theme={theme} icon='heart-outline'>
          <Text style={[styles.vitalLabel, { color: theme.muted }]}>{t('family.hrRest')}</Text>
          <Text style={[styles.vitalValue, { color: theme.text }]}>{metric.heart_rate} <Text style={styles.vitalUnit}>BPM</Text></Text>
          <Text style={[styles.vitalNote, { color: theme.primaryDark }]}>✓ {hrStatus}</Text>
        </VitalCard>
      )}
      {showSteps && (
        <VitalCard theme={theme} icon='footsteps-outline'>
          <Text style={[styles.vitalValue, { color: theme.text }]}>
            {metric.steps!.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}
            <Text style={styles.vitalUnit}> / {member.stepGoal.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}</Text>
          </Text>
          <Text style={[styles.vitalNote, { color: theme.primaryDark }]}>
            {Math.round((metric.steps! / member.stepGoal) * 100)}% • {stepsToKm(metric.steps!).toFixed(1)} km • {stepsToKcal(metric.steps!)} kcal
          </Text>
        </VitalCard>
      )}
      {showSleep && (
        <VitalCard theme={theme} icon='moon-outline'>
          <Text style={[styles.vitalValue, { color: theme.text }]}>{formatSleep(metric.sleep_hours)}</Text>
          <Text style={[styles.vitalNote, { color: theme.primaryDark }]}>
            {t('family.sleepGoalPct', {
              pct: Math.round((Number(metric.sleep_hours) / member.sleepGoalHours) * 100),
            })}
          </Text>
        </VitalCard>
      )}
      {showSpo2 && (
        <VitalCard theme={theme} icon='pulse-outline'>
          <Text style={[styles.vitalValue, { color: theme.text }]}>SpO2: {metric.spo2}%</Text>
          <Text style={[styles.vitalNote, { color: theme.primaryDark }]}>
            {metric.spo2! >= 95 ? t('family.spo2Ideal') : t('family.spo2Low')}
          </Text>
        </VitalCard>
      )}
      {showWater && (
        <VitalCard theme={theme} icon='water-outline'>
          <Text style={[styles.vitalLabel, { color: theme.muted }]}>{t('family.content.water.title')}</Text>
          <Text style={[styles.vitalValue, { color: theme.text }]}>{metric.water_ml!.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} <Text style={styles.vitalUnit}>ml</Text></Text>
          <Text style={[styles.vitalNote, { color: theme.primaryDark }]}>
            {t('family.waterGoalNote', { goal: member.waterGoalMl.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US') })}
          </Text>
        </VitalCard>
      )}
      {showWeight && (
        <VitalCard theme={theme} icon='barbell-outline'>
          <Text style={[styles.vitalValue, { color: theme.text }]}>{metric.weight_kg} <Text style={styles.vitalUnit}>kg</Text></Text>
          <Text style={[styles.vitalNote, { color: theme.muted }]}>{t('family.weightToday')}</Text>
        </VitalCard>
      )}
      {showKcal && (
        <VitalCard theme={theme} icon='flame-outline'>
          <Text style={[styles.vitalLabel, { color: theme.muted }]}>{t('family.content.kcal.title')}</Text>
          <Text style={[styles.vitalValue, { color: theme.text }]}>{member.kcalToday!.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} <Text style={styles.vitalUnit}>kcal</Text></Text>
          <Text style={[styles.vitalNote, { color: theme.primaryDark }]}>{t('family.kcalTodayNote')}</Text>
        </VitalCard>
      )}
      {showCycle && (
        <VitalCard theme={theme} icon='calendar-outline'>
          <Text style={[styles.vitalLabel, { color: theme.muted }]}>{t('family.content.cycle.title')}</Text>
          <Text style={[styles.vitalValue, { color: theme.text }]}>
            {member.daysToNextPeriod === 0
              ? t('family.cycleToday')
              : t('family.cycleInDays', { days: member.daysToNextPeriod! })}
          </Text>
          <Text style={[styles.vitalNote, { color: theme.primaryDark }]}>{t('family.cycleNextNote')}</Text>
        </VitalCard>
      )}
    </View>
  );
}

function VitalCard({
  theme,
  icon,
  children,
}: {
  theme: ThemePalette;
  icon: AppIconName;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.vitalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <AppIcon name={icon} size='md' tone='primaryDark' />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { fontSize: 14, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  vitalCard: { width: '48%', borderWidth: 1, borderRadius: 14, padding: 12 },
  vitalLabel: { fontSize: 11, fontWeight: '800', marginTop: 6 },
  vitalValue: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  vitalUnit: { fontSize: 13, fontWeight: '600' },
  vitalNote: { fontSize: 12, marginTop: 4, lineHeight: 16 },
});
