import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettings } from '../../../context/SettingsContext';
import { supabase } from '../../../api/supabase';
import {
  WATER_WINDOWS,
  cleanupDuplicateNotifications,
  syncReminderNotifications,
} from '../../../utils/reminders/reminders';
import {
  scheduleSleepNotifications,
  type SleepProfile,
} from '../../../utils/health/sleepSession';
import {
  CYCLE_DAYS,
  DEFAULT_NOTIF,
  GREY_PILL,
  NOTIF_KEY,
  normalizeTime,
  type NotifSettings,
} from '../../../utils/reminders/reminderSettings';
import { buildNextReminders } from '../../../utils/reminders/nextReminders';
import { ReminderToggleCard } from '../../../components/reminders/ReminderToggleCard';
import { ReminderTimeRow } from '../../../components/reminders/ReminderTimeRow';
import { AppHeader } from '../../../components/ui/AppHeader';
import { s } from './RemindersScreen.styles';

export default function RemindersScreen({ navigation }: any) {
  const { theme, t } = useSettings();
  const [notif, setNotif] = useState<NotifSettings>(DEFAULT_NOTIF);
  const [sleepTimeDraft, setSleepTimeDraft] = useState('22:00');
  const [breakfastDraft, setBreakfastDraft] = useState('07:00');
  const [lunchDraft, setLunchDraft] = useState('12:00');
  const [dinnerDraft, setDinnerDraft] = useState('18:30');
  const [wakeDraft, setWakeDraft] = useState('07:30');
  // Nhóm C (v3): đang dọn lịch trùng thì khóa nút dọn để không bấm 2 lần.
  const [cleaning, setCleaning] = useState(false);

  // The nao dang mo rong (so xuong) de xem/sua chi tiet; mac dinh gap
  // het cho gon, chi hien dong tom tat.
  const [open, setOpen] = useState({
    water: false,
    meal: false,
    wake: false,
    sleep: false,
    cycle: false,
  });
  const toggleOpen = (key: keyof typeof open) =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(NOTIF_KEY);
        if (raw) {
          const merged = { ...DEFAULT_NOTIF, ...JSON.parse(raw) };
          setNotif(merged);
          setSleepTimeDraft(merged.sleepTime);
          setBreakfastDraft(merged.mealBreakfast);
          setLunchDraft(merged.mealLunch);
          setDinnerDraft(merged.mealDinner);
          setWakeDraft(merged.wakeTime);
        }
      } catch {}
    })();
  }, []);

  const updateNotif = (patch: Partial<NotifSettings>) => {
    setNotif((prev) => {
      const next = { ...prev, ...patch };
      // Ghi xong mới đồng bộ lịch push để tránh đọc phải cài đặt cũ.
      AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(next))
        .then(() => syncReminderNotifications())
        .catch(() => {});
      return next;
    });
  };

  const saveDraftTime = (
    draft: string,
    setDraft: (v: string) => void,
    fallback: string,
    patch: Partial<NotifSettings>,
  ) => {
    const normalized = normalizeTime(draft);
    if (!normalized) {
      setDraft(fallback);
      return;
    }
    setDraft(normalized);
    updateNotif(patch);
  };

  const goNotifications = () =>
    (navigation.getParent() ?? navigation).navigate('Notifications');

  // Nhóm C (v3): nút "Dọn lịch thông báo trùng" — chữa cho máy user
  // hiện tại: chỉ sửa code không tự xóa được các lịch mồ côi đã đặt
  // (tới 21 lịch đổ chuông cùng lúc). Bấm 1 lần: hủy toàn bộ lịch
  // nhắc/báo thức đã đặt rồi đồng bộ lại 1 bộ mới duy nhất (water+meal
  // ở reminders, bedtime/wake/custom alarm ở màn Ngủ).
  const handleCleanupDuplicates = () => {
    Alert.alert(
      t('reminders.cleanupConfirmTitle'),
      t('reminders.cleanupConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: async () => {
            if (cleaning) return;
            setCleaning(true);
            try {
              await cleanupDuplicateNotifications();
              // Đồng bộ lại bedtime/wake/custom alarm theo profile Ngủ
              // (cleanupDuplicateNotifications chỉ đồng bộ lại water+meal).
              try {
                const { data: auth } = await supabase.auth.getUser();
                if (auth.user) {
                  const prof = await supabase
                    .from('profiles')
                    .select(
                      'sleep_goal_hours, bedtime_time, wake_time, sleep_reminder_enabled, alarm_enabled',
                    )
                    .eq('id', auth.user.id)
                    .maybeSingle();
                  const p: SleepProfile = {
                    sleep_goal_hours: prof.data?.sleep_goal_hours
                      ? Number(prof.data.sleep_goal_hours)
                      : null,
                    bedtime_time: prof.data?.bedtime_time
                      ? String(prof.data.bedtime_time)
                      : null,
                    wake_time: prof.data?.wake_time
                      ? String(prof.data.wake_time)
                      : null,
                    sleep_reminder_enabled:
                      prof.data?.sleep_reminder_enabled !== false,
                    alarm_enabled: prof.data?.alarm_enabled !== false,
                  };
                  await scheduleSleepNotifications(p);
                }
              } catch {}
              Alert.alert(
                t('reminders.cleanupDoneTitle'),
                t('reminders.cleanupDoneBody'),
              );
            } catch (e: any) {
              Alert.alert(
                t('reminders.cleanupFailedTitle'),
                e?.message || t('reminders.cleanupFailedBody'),
              );
            } finally {
              setCleaning(false);
            }
          },
        },
      ],
    );
  };

  const nextReminders = buildNextReminders(notif);

  const pillStyle = (selected: boolean) => ({
    backgroundColor: selected ? theme.primaryDark : GREY_PILL,
  });
  const pillTextStyle = (selected: boolean) => ({
    color: selected ? '#fff' : theme.text,
  });

  // Gio ket thuc cua khung nuoc cuoi ("21:00 – 22:00" -> "22:00").
  const waterRangeEnd = (range: string) => {
    const end = (range.split('–')[1] ?? range).trim();
    const [h, m] = end.split(':');
    return `${h.padStart(2, '0')}:${m}`;
  };
  const waterSummary = t('reminders.waterSummary', {
    from: WATER_WINDOWS[0].time,
    to: waterRangeEnd(WATER_WINDOWS[WATER_WINDOWS.length - 1].range),
    count: WATER_WINDOWS.length,
  });

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <AppHeader
            title={t('settings.notificationsSection')}
            withTopInset={false}
          />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 4,
            paddingBottom: 32,
          }}
        >

          <ReminderToggleCard
            title={t('settings.notificationsEnabled')}
            desc={t('settings.notificationsEnabledDesc')}
            value={notif.enabled}
            theme={theme}
            onValueChange={(v) => updateNotif({ enabled: v })}
          />

          <ReminderToggleCard
            title={t('settings.waterReminder')}
            desc={t('reminders.waterDesc')}
            value={notif.water}
            disabled={!notif.enabled}
            dimmed={!notif.enabled}
            theme={theme}
            onValueChange={(v) => updateNotif({ water: v })}
            expandable
            expanded={open.water}
            onToggleExpand={() => toggleOpen('water')}
            summary={
              <View style={s.summaryRow}>
                <View
                  style={[s.summaryChip, { backgroundColor: theme.cardAlt }]}
                >
                  <Text style={[s.summaryChipText, { color: theme.text }]}>
                    {waterSummary}
                  </Text>
                </View>
              </View>
            }
          >
            {notif.water && (
              <View style={{ marginTop: 4 }}>
                {WATER_WINDOWS.map((w) => (
                  <Text key={w.time} style={[s.windowLine, { color: theme.muted }]}>
                    • {w.time} ({w.range}): {t(w.titleKey)}
                  </Text>
                ))}
              </View>
            )}
          </ReminderToggleCard>

          <ReminderToggleCard
            title={t('reminders.mealTitle')}
            desc={t('reminders.mealShort')}
            value={notif.meal}
            disabled={!notif.enabled}
            dimmed={!notif.enabled}
            theme={theme}
            onValueChange={(v) => updateNotif({ meal: v })}
            expandable
            expanded={open.meal}
            onToggleExpand={() => toggleOpen('meal')}
            summary={
              <View style={s.summaryRow}>
                {[
                  { time: notif.mealBreakfast, label: t('nutrition.breakfast') },
                  { time: notif.mealLunch, label: t('nutrition.lunch') },
                  { time: notif.mealDinner, label: t('nutrition.dinner') },
                ].map((m) => (
                  <View
                    key={m.label}
                    style={[s.summaryPill, { backgroundColor: theme.cardAlt }]}
                  >
                    <Text style={[s.summaryTime, { color: theme.text }]}>
                      {m.time}
                    </Text>
                    <Text style={[s.summaryLabel, { color: theme.muted }]}>
                      {m.label}
                    </Text>
                  </View>
                ))}
              </View>
            }
          >
            {notif.meal && (
              <>
                <ReminderTimeRow
                  label={t('nutrition.breakfast')}
                  value={breakfastDraft}
                  placeholder='07:00'
                  theme={theme}
                  onChangeText={setBreakfastDraft}
                  onBlur={() =>
                    saveDraftTime(
                      breakfastDraft,
                      setBreakfastDraft,
                      notif.mealBreakfast,
                      {
                        mealBreakfast:
                          normalizeTime(breakfastDraft) ??
                          notif.mealBreakfast,
                      },
                    )
                  }
                />
                <ReminderTimeRow
                  label={t('nutrition.lunch')}
                  value={lunchDraft}
                  placeholder='12:00'
                  theme={theme}
                  onChangeText={setLunchDraft}
                  onBlur={() =>
                    saveDraftTime(
                      lunchDraft,
                      setLunchDraft,
                      notif.mealLunch,
                      {
                        mealLunch:
                          normalizeTime(lunchDraft) ?? notif.mealLunch,
                      },
                    )
                  }
                />
                <ReminderTimeRow
                  label={t('nutrition.dinner')}
                  value={dinnerDraft}
                  placeholder='18:30'
                  theme={theme}
                  onChangeText={setDinnerDraft}
                  onBlur={() =>
                    saveDraftTime(
                      dinnerDraft,
                      setDinnerDraft,
                      notif.mealDinner,
                      {
                        mealDinner:
                          normalizeTime(dinnerDraft) ?? notif.mealDinner,
                      },
                    )
                  }
                />
              </>
            )}
          </ReminderToggleCard>

          <ReminderToggleCard
            title={t('reminders.wakeTitle')}
            desc={t('reminders.wakeDesc')}
            value={notif.wake}
            disabled={!notif.enabled}
            dimmed={!notif.enabled}
            theme={theme}
            onValueChange={(v) => updateNotif({ wake: v })}
            expandable
            expanded={open.wake}
            onToggleExpand={() => toggleOpen('wake')}
            summary={
              <View style={s.summaryRow}>
                <View
                  style={[s.summaryChip, { backgroundColor: theme.cardAlt }]}
                >
                  <Text style={[s.summaryChipText, { color: theme.text }]}>
                    {notif.wakeTime}
                  </Text>
                </View>
              </View>
            }
          >
            {notif.wake && (
              <ReminderTimeRow
                label={t('reminders.wakeTimeLabel')}
                value={wakeDraft}
                placeholder='07:30'
                theme={theme}
                onChangeText={setWakeDraft}
                onBlur={() =>
                  saveDraftTime(wakeDraft, setWakeDraft, notif.wakeTime, {
                    wakeTime: normalizeTime(wakeDraft) ?? notif.wakeTime,
                  })
                }
              />
            )}
          </ReminderToggleCard>

          <ReminderToggleCard
            title={t('settings.sleepReminder')}
            desc={t('reminders.sleepShort')}
            value={notif.sleep}
            disabled={!notif.enabled}
            dimmed={!notif.enabled}
            theme={theme}
            onValueChange={(v) => updateNotif({ sleep: v })}
            expandable
            expanded={open.sleep}
            onToggleExpand={() => toggleOpen('sleep')}
            summary={
              <View style={s.summaryRow}>
                <View
                  style={[s.summaryChip, { backgroundColor: theme.cardAlt }]}
                >
                  <Text style={[s.summaryChipText, { color: theme.text }]}>
                    {notif.sleepTime}
                  </Text>
                </View>
              </View>
            }
          >
            {notif.sleep && (
              <ReminderTimeRow
                label={t('settings.sleepTimeLabel')}
                value={sleepTimeDraft}
                placeholder='22:00'
                theme={theme}
                onChangeText={setSleepTimeDraft}
                onBlur={() =>
                  saveDraftTime(
                    sleepTimeDraft,
                    setSleepTimeDraft,
                    notif.sleepTime,
                    {
                      sleepTime:
                        normalizeTime(sleepTimeDraft) ?? notif.sleepTime,
                    },
                  )
                }
              />
            )}
          </ReminderToggleCard>

          <ReminderToggleCard
            title={t('settings.cycleReminder')}
            desc={t('reminders.cycleDesc', { days: notif.cycleDaysBefore })}
            value={notif.cycle}
            disabled={!notif.enabled}
            dimmed={!notif.enabled}
            theme={theme}
            onValueChange={(v) => updateNotif({ cycle: v })}
            expandable
            expanded={open.cycle}
            onToggleExpand={() => toggleOpen('cycle')}
            summary={
              <View style={s.summaryRow}>
                <View
                  style={[s.summaryChip, { backgroundColor: theme.cardAlt }]}
                >
                  <Text style={[s.summaryChipText, { color: theme.text }]}>
                    {t('reminders.cycleDays', { days: notif.cycleDaysBefore })}
                  </Text>
                </View>
              </View>
            }
          >
            {notif.cycle && (
              <View style={s.pillRow}>
              {CYCLE_DAYS.map((d) => (
                <TouchableOpacity
                  key={d}
                  disabled={!notif.enabled}
                  style={[s.pillBtn, pillStyle(notif.cycleDaysBefore === d)]}
                  onPress={() => updateNotif({ cycleDaysBefore: d })}
                >
                  <Text
                    style={[
                      s.pillText,
                      pillTextStyle(notif.cycleDaysBefore === d),
                    ]}
                  >
                    {t('reminders.cycleDays', { days: d })}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            )}
          </ReminderToggleCard>

          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: theme.primaryDark }]}
            onPress={goNotifications}
          >
            <Text style={s.primaryBtnText}>
              {t('settings.goToNotifications')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              s.primaryBtn,
              { backgroundColor: theme.cardAlt, marginTop: 12 },
            ]}
            onPress={handleCleanupDuplicates}
            disabled={cleaning}
          >
            <Text style={[s.primaryBtnText, { color: theme.text }]}>
              {t('reminders.cleanupDuplicates')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
