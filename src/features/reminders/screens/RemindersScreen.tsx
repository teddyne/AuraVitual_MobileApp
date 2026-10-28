import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettings } from '../../../context/SettingsContext';

const NOTIF_KEY = '@auravital:notifications';
const WATER_INTERVALS = [2, 3, 4];
const CYCLE_DAYS = [1, 2, 3, 5];
const GREY_PILL = '#D9D9D9';

type NotifSettings = {
  enabled: boolean;
  water: boolean;
  waterIntervalHours: number;
  sleep: boolean;
  sleepTime: string;
  cycle: boolean;
  cycleDaysBefore: number;
  meal: boolean;
  mealBreakfast: string;
  mealLunch: string;
  mealDinner: string;
  wake: boolean;
  wakeTime: string;
};

const DEFAULT_NOTIF: NotifSettings = {
  enabled: true,
  water: true,
  waterIntervalHours: 2,
  sleep: true,
  sleepTime: '22:00',
  cycle: true,
  cycleDaysBefore: 3,
  meal: true,
  mealBreakfast: '07:00',
  mealLunch: '12:00',
  mealDinner: '18:30',
  wake: true,
  wakeTime: '07:30',
};

const normalizeTime = (text: string): string | null => {
  const m = text.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

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
      AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(next)).catch(() => {});
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

  const nextReminders: string[] = [];
  if (notif.enabled) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (notif.water) {
      const next = new Date(now.getTime() + notif.waterIntervalHours * 3600000);
      nextReminders.push(
        `💧 ${locale === 'vi' ? 'Uống nước lúc' : 'Drink water at'} ${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`,
      );
    }
    if (notif.meal) {
      nextReminders.push(
        `🍽 ${locale === 'vi' ? 'Bữa sáng' : 'Breakfast'} ${notif.mealBreakfast} • ${locale === 'vi' ? 'Bữa trưa' : 'Lunch'} ${notif.mealLunch} • ${locale === 'vi' ? 'Bữa tối' : 'Dinner'} ${notif.mealDinner}`,
      );
    }
    if (notif.wake) {
      nextReminders.push(
        `⏰ ${locale === 'vi' ? 'Nhắc thức dậy lúc' : 'Wake reminder at'} ${notif.wakeTime}`,
      );
    }
    if (notif.sleep) {
      const [h, m] = notif.sleepTime.split(':').map(Number);
      if (!Number.isNaN(h) && !Number.isNaN(m)) {
        if (h * 60 + m > nowMin)
          nextReminders.push(
            `😴 ${locale === 'vi' ? 'Đi ngủ lúc' : 'Bedtime at'} ${notif.sleepTime}`,
          );
        else
          nextReminders.push(
            `😴 ${locale === 'vi' ? 'Đi ngủ lúc' : 'Bedtime at'} ${notif.sleepTime} (${locale === 'vi' ? 'ngày mai' : 'tomorrow'})`,
          );
      }
    }
    if (notif.cycle) {
      nextReminders.push(
        `🌸 ${locale === 'vi' ? `Nhắc chu kỳ trước ${notif.cycleDaysBefore} ngày` : `Cycle reminder ${notif.cycleDaysBefore} days before`}`,
      );
    }
  }

  const pillStyle = (selected: boolean) => ({
    backgroundColor: selected ? theme.primaryDark : GREY_PILL,
  });
  const pillTextStyle = (selected: boolean) => ({
    color: selected ? '#fff' : theme.text,
  });

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <View style={s.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={[s.back, { color: theme.primaryDark }]}>‹</Text>
            </TouchableOpacity>
          </View>
          <Text style={[s.title, { color: theme.text }]}>
            {t('settings.notificationsSection')}
          </Text>

          <View style={[s.card, { backgroundColor: theme.card }]}>
            <View style={s.row}>
              <Text style={s.icon}>🔔</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, { color: theme.text }]}>
                  {t('settings.notificationsEnabled')}
                </Text>
                <Text style={[s.muted, { color: theme.muted }]}>
                  {t('settings.notificationsEnabledDesc')}
                </Text>
              </View>
              <Switch
                value={notif.enabled}
                onValueChange={(v) => updateNotif({ enabled: v })}
                trackColor={{ false: '#CCCCCC', true: theme.primaryDark }}
                thumbColor='#FFFFFF'
              />
            </View>
          </View>

          <View
            style={[
              s.card,
              { backgroundColor: theme.card },
              !notif.enabled && { opacity: 0.5 },
            ]}
          >
            <View style={s.row}>
              <Text style={s.icon}>💧</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, { color: theme.text }]}>
                  {t('settings.waterReminder')}
                </Text>
                <Text style={[s.muted, { color: theme.muted }]}>
                  {locale === 'vi'
                    ? `Mỗi ${notif.waterIntervalHours} giờ`
                    : `Every ${notif.waterIntervalHours} hours`}
                </Text>
              </View>
              <Switch
                disabled={!notif.enabled}
                value={notif.water}
                onValueChange={(v) => updateNotif({ water: v })}
                trackColor={{ false: '#CCCCCC', true: theme.primaryDark }}
                thumbColor='#FFFFFF'
              />
            </View>
            <View style={s.pillRow}>
              {WATER_INTERVALS.map((h) => (
                <TouchableOpacity
                  key={h}
                  disabled={!notif.enabled}
                  style={[s.pillBtn, pillStyle(notif.waterIntervalHours === h)]}
                  onPress={() => updateNotif({ waterIntervalHours: h })}
                >
                  <Text
                    style={[
                      s.pillText,
                      pillTextStyle(notif.waterIntervalHours === h),
                    ]}
                  >
                    {locale === 'vi' ? `${h} giờ` : `${h}h`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View
            style={[
              s.card,
              { backgroundColor: theme.card },
              !notif.enabled && { opacity: 0.5 },
            ]}
          >
            <View style={s.row}>
              <Text style={s.icon}>🍽</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, { color: theme.text }]}>
                  {locale === 'vi' ? 'Nhắc bữa ăn' : 'Meal reminders'}
                </Text>
                <Text style={[s.muted, { color: theme.muted }]}>
                  {locale === 'vi'
                    ? `Sáng ${notif.mealBreakfast} • Trưa ${notif.mealLunch} • Tối ${notif.mealDinner}`
                    : `Breakfast ${notif.mealBreakfast} • Lunch ${notif.mealLunch} • Dinner ${notif.mealDinner}`}
                </Text>
              </View>
              <Switch
                disabled={!notif.enabled}
                value={notif.meal}
                onValueChange={(v) => updateNotif({ meal: v })}
                trackColor={{ false: '#CCCCCC', true: theme.primaryDark }}
                thumbColor='#FFFFFF'
              />
            </View>
            {notif.meal && (
              <>
                <View style={s.timeRow}>
                  <Text style={[s.rowTitle, { color: theme.text }]}>
                    {locale === 'vi' ? 'Bữa sáng' : 'Breakfast'}
                  </Text>
                  <TextInput
                    value={breakfastDraft}
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
                    keyboardType='numbers-and-punctuation'
                    placeholder='07:00'
                    placeholderTextColor={theme.muted}
                    maxLength={5}
                    style={[
                      s.timeInput,
                      { backgroundColor: theme.cardAlt, color: theme.text },
                    ]}
                  />
                </View>
                <View style={s.timeRow}>
                  <Text style={[s.rowTitle, { color: theme.text }]}>
                    {locale === 'vi' ? 'Bữa trưa' : 'Lunch'}
                  </Text>
                  <TextInput
                    value={lunchDraft}
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
                    keyboardType='numbers-and-punctuation'
                    placeholder='12:00'
                    placeholderTextColor={theme.muted}
                    maxLength={5}
                    style={[
                      s.timeInput,
                      { backgroundColor: theme.cardAlt, color: theme.text },
                    ]}
                  />
                </View>
                <View style={s.timeRow}>
                  <Text style={[s.rowTitle, { color: theme.text }]}>
                    {locale === 'vi' ? 'Bữa tối' : 'Dinner'}
                  </Text>
                  <TextInput
                    value={dinnerDraft}
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
                    keyboardType='numbers-and-punctuation'
                    placeholder='18:30'
                    placeholderTextColor={theme.muted}
                    maxLength={5}
                    style={[
                      s.timeInput,
                      { backgroundColor: theme.cardAlt, color: theme.text },
                    ]}
                  />
                </View>
              </>
            )}
          </View>

          <View
            style={[
              s.card,
              { backgroundColor: theme.card },
              !notif.enabled && { opacity: 0.5 },
            ]}
          >
            <View style={s.row}>
              <Text style={s.icon}>⏰</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, { color: theme.text }]}>
                  {locale === 'vi' ? 'Nhắc thức dậy' : 'Wake reminder'}
                </Text>
                <Text style={[s.muted, { color: theme.muted }]}>
                  {locale === 'vi'
                    ? 'Chỉ là cài đặt nhắc, không phải báo thức trong màn hình giấc ngủ.'
                    : 'Reminder setting only, not the alarm in the sleep screen.'}
                </Text>
              </View>
              <Switch
                disabled={!notif.enabled}
                value={notif.wake}
                onValueChange={(v) => updateNotif({ wake: v })}
                trackColor={{ false: '#CCCCCC', true: theme.primaryDark }}
                thumbColor='#FFFFFF'
              />
            </View>
            {notif.wake && (
              <View style={s.timeRow}>
                <Text style={[s.rowTitle, { color: theme.text }]}>
                  {locale === 'vi' ? 'Giờ thức dậy' : 'Wake time'}
                </Text>
                <TextInput
                  value={wakeDraft}
                  onChangeText={setWakeDraft}
                  onBlur={() =>
                    saveDraftTime(wakeDraft, setWakeDraft, notif.wakeTime, {
                      wakeTime: normalizeTime(wakeDraft) ?? notif.wakeTime,
                    })
                  }
                  keyboardType='numbers-and-punctuation'
                  placeholder='07:30'
                  placeholderTextColor={theme.muted}
                  maxLength={5}
                  style={[
                    s.timeInput,
                    { backgroundColor: theme.cardAlt, color: theme.text },
                  ]}
                />
              </View>
            )}
          </View>

          <View
            style={[
              s.card,
              { backgroundColor: theme.card },
              !notif.enabled && { opacity: 0.5 },
            ]}
          >
            <View style={s.row}>
              <Text style={s.icon}>😴</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, { color: theme.text }]}>
                  {t('settings.sleepReminder')}
                </Text>
                <Text style={[s.muted, { color: theme.muted }]}>
                  {locale === 'vi'
                    ? `Lúc ${notif.sleepTime} mỗi ngày`
                    : `Daily at ${notif.sleepTime}`}
                </Text>
              </View>
              <Switch
                disabled={!notif.enabled}
                value={notif.sleep}
                onValueChange={(v) => updateNotif({ sleep: v })}
                trackColor={{ false: '#CCCCCC', true: theme.primaryDark }}
                thumbColor='#FFFFFF'
              />
            </View>
            {notif.sleep && (
              <View style={s.timeRow}>
                <Text style={[s.rowTitle, { color: theme.text }]}>
                  {t('settings.sleepTimeLabel')}
                </Text>
                <TextInput
                  value={sleepTimeDraft}
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
                  keyboardType='numbers-and-punctuation'
                  placeholder='22:00'
                  placeholderTextColor={theme.muted}
                  maxLength={5}
                  style={[
                    s.timeInput,
                    { backgroundColor: theme.cardAlt, color: theme.text },
                  ]}
                />
              </View>
            )}
          </View>

          <View
            style={[
              s.card,
              { backgroundColor: theme.card },
              !notif.enabled && { opacity: 0.5 },
            ]}
          >
            <View style={s.row}>
              <Text style={s.icon}>🌸</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, { color: theme.text }]}>
                  {t('settings.cycleReminder')}
                </Text>
                <Text style={[s.muted, { color: theme.muted }]}>
                  {locale === 'vi'
                    ? `Trước ${notif.cycleDaysBefore} ngày`
                    : `${notif.cycleDaysBefore} days before`}
                </Text>
              </View>
              <Switch
                disabled={!notif.enabled}
                value={notif.cycle}
                onValueChange={(v) => updateNotif({ cycle: v })}
                trackColor={{ false: '#CCCCCC', true: theme.primaryDark }}
                thumbColor='#FFFFFF'
              />
            </View>
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
          </View>

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

const s = StyleSheet.create({
  safe: { flex: 1 },
  headerRow: { marginBottom: 8 },
  back: { fontSize: 30, fontWeight: '800' },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  card: { borderRadius: 16, padding: 14, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { fontSize: 22 },
  rowTitle: { fontWeight: '800' },
  muted: { lineHeight: 18, marginTop: 2 },
  pillRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  pillBtn: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  pillText: { fontWeight: '700' },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  timeInput: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    width: 90,
    textAlign: 'center',
    fontWeight: '800',
  },
  previewCard: { borderRadius: 16, padding: 14, marginTop: 12 },
  previewTitle: { fontWeight: '800', marginBottom: 6 },
  previewLine: { lineHeight: 20, marginTop: 2 },
  note: { textAlign: 'center', fontSize: 12, marginTop: 12 },
  primaryBtn: {
    borderRadius: 999,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
