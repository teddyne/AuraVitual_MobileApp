import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettings } from '../../../context/SettingsContext';
import {
  WATER_WINDOWS,
  syncReminderNotifications,
} from '../../../lib/reminders';
import {
  CYCLE_DAYS,
  DEFAULT_NOTIF,
  GREY_PILL,
  NOTIF_KEY,
  normalizeTime,
  type NotifSettings,
} from '../utils/reminderSettings';
import { buildNextReminders } from '../utils/nextReminders';
import { ReminderToggleCard } from '../components/ReminderToggleCard';
import { ReminderTimeRow } from '../components/ReminderTimeRow';
import { s } from './RemindersScreen.styles';

export default function RemindersScreen({ navigation }: any) {
  const { theme, locale, t } = useSettings();
  const [notif, setNotif] = useState<NotifSettings>(DEFAULT_NOTIF);
  const [sleepTimeDraft, setSleepTimeDraft] = useState('22:00');
  const [breakfastDraft, setBreakfastDraft] = useState('07:00');
  const [lunchDraft, setLunchDraft] = useState('12:00');
  const [dinnerDraft, setDinnerDraft] = useState('18:30');
  const [wakeDraft, setWakeDraft] = useState('07:30');

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

  const nextReminders = buildNextReminders(notif, locale);

  const pillStyle = (selected: boolean) => ({
    backgroundColor: selected ? theme.primaryDark : GREY_PILL,
  });
  const pillTextStyle = (selected: boolean) => ({
    color: selected ? '#fff' : theme.text,
  });

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <View style={s.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={[s.back, { color: theme.primaryDark }]}>‹</Text>
            </TouchableOpacity>
          </View>
          <Text style={[s.title, { color: theme.text }]}>
            {t('settings.notificationsSection')}
          </Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>

          <ReminderToggleCard
            icon='🔔'
            title={t('settings.notificationsEnabled')}
            desc={t('settings.notificationsEnabledDesc')}
            value={notif.enabled}
            theme={theme}
            onValueChange={(v) => updateNotif({ enabled: v })}
          />

          <ReminderToggleCard
            icon='💧'
            title={t('settings.waterReminder')}
            desc={
              locale === 'vi'
                ? '8 khung giờ cố định, nhắc 1 lần vào đầu mỗi khung'
                : '8 fixed windows, reminded once at each window start'
            }
            value={notif.water}
            disabled={!notif.enabled}
            dimmed={!notif.enabled}
            theme={theme}
            onValueChange={(v) => updateNotif({ water: v })}
          >
            {notif.water && (
              <View style={{ marginTop: 4 }}>
                {WATER_WINDOWS.map((w) => (
                  <Text key={w.time} style={[s.windowLine, { color: theme.muted }]}>
                    • {w.time} ({w.range}): {w.title}
                  </Text>
                ))}
                <Text style={[s.windowNote, { color: theme.muted }]}>
                  {locale === 'vi'
                    ? 'Đã uống đủ mục tiêu trong ngày thì không nhắc nữa.'
                    : 'No more reminders once the daily goal is met.'}
                </Text>
              </View>
            )}
          </ReminderToggleCard>

          <ReminderToggleCard
            icon='🍽'
            title={locale === 'vi' ? 'Nhắc bữa ăn' : 'Meal reminders'}
            desc={
              locale === 'vi'
                ? `Sáng ${notif.mealBreakfast} • Trưa ${notif.mealLunch} • Tối ${notif.mealDinner}`
                : `Breakfast ${notif.mealBreakfast} • Lunch ${notif.mealLunch} • Dinner ${notif.mealDinner}`
            }
            value={notif.meal}
            disabled={!notif.enabled}
            dimmed={!notif.enabled}
            theme={theme}
            onValueChange={(v) => updateNotif({ meal: v })}
          >
            {notif.meal && (
              <>
                <ReminderTimeRow
                  label={locale === 'vi' ? 'Bữa sáng' : 'Breakfast'}
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
                  label={locale === 'vi' ? 'Bữa trưa' : 'Lunch'}
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
                  label={locale === 'vi' ? 'Bữa tối' : 'Dinner'}
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
            icon='⏰'
            title={locale === 'vi' ? 'Nhắc thức dậy' : 'Wake reminder'}
            desc={
              locale === 'vi'
                ? 'Chỉ là cài đặt nhắc, không phải báo thức trong màn hình giấc ngủ.'
                : 'Reminder setting only, not the alarm in the sleep screen.'
            }
            value={notif.wake}
            disabled={!notif.enabled}
            dimmed={!notif.enabled}
            theme={theme}
            onValueChange={(v) => updateNotif({ wake: v })}
          >
            {notif.wake && (
              <ReminderTimeRow
                label={locale === 'vi' ? 'Giờ thức dậy' : 'Wake time'}
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
            icon='😴'
            title={t('settings.sleepReminder')}
            desc={
              locale === 'vi'
                ? `Lúc ${notif.sleepTime} mỗi ngày`
                : `Daily at ${notif.sleepTime}`
            }
            value={notif.sleep}
            disabled={!notif.enabled}
            dimmed={!notif.enabled}
            theme={theme}
            onValueChange={(v) => updateNotif({ sleep: v })}
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
            icon='🌸'
            title={t('settings.cycleReminder')}
            desc={
              locale === 'vi'
                ? `Trước ${notif.cycleDaysBefore} ngày`
                : `${notif.cycleDaysBefore} days before`
            }
            value={notif.cycle}
            disabled={!notif.enabled}
            dimmed={!notif.enabled}
            theme={theme}
            onValueChange={(v) => updateNotif({ cycle: v })}
          >
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
                    {locale === 'vi' ? `${d} ngày` : `${d} days`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ReminderToggleCard>

          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: theme.primaryDark }]}
            onPress={goNotifications}
          >
            <Text style={s.primaryBtnText}>
              {locale === 'vi'
                ? 'Đi đến trang thông báo →'
                : 'Go to notifications →'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
