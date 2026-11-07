import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { IconBadge } from '../../../components/ui/IconBadge';
import { s } from './ProfileSetupScreen.styles';
import { CardTitle } from '../../../components/profile/CardTitle';
import { FieldLabel } from '../../../components/profile/FieldLabel';
import { DragRuler } from '../../../components/profile/DragRuler';
import { GENDERS, GOALS, ACTIVITY_ICONS } from '../constants';
import {
  parseDate,
  isoToText,
  ageFromIso,
  fmtSleepHours,
  toDbTime,
  toTimeInput,
} from '../../../utils/profile/profileFormat';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../auth/AuthContext';
import { useSettings } from '../../../context/SettingsContext';
import { supabase } from '../../../api/supabase';
import {
  getProfile,
  saveProfile,
  saveCycleStart,
} from '../../../api/auravitalApi';
import {
  ACTIVITY_LEVELS,
  calcRecommendation,
  parseTimeMinutes,
  sleepHoursFromTimes,
} from '../../../utils/health/healthCalc';
import type { ActivityId, DurationUnit } from '../../../utils/health/healthCalc';
import { formatDateInputDigits } from '../../../utils/dates';

// Vòng tròn nhạt + icon xanh đậm, đúng kiểu ảnh bạn gửi.

export default function ProfileSetupScreen({ navigation }: any) {
  const { user } = useAuth();
  const { theme, t, locale } = useSettings();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [birthText, setBirthText] = useState('');
  const [birthIso, setBirthIso] = useState<string | null>(null);
  const [height, setHeight] = useState(168);
  const [weight, setWeight] = useState(58);
  const [goal, setGoal] = useState('');
  const [activity, setActivity] = useState<ActivityId | ''>('');
  const [targetWeight, setTargetWeight] = useState(53);
  const [durationValue, setDurationValue] = useState(12);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('week');
  const [exerciseSessions, setExerciseSessions] = useState(4);
  const [exerciseMinutes, setExerciseMinutes] = useState(30);
  const [bedtime, setBedtime] = useState('22:30');
  const [wakeTime, setWakeTime] = useState('06:30');
  // Picker giờ dạng xoay (spinner) đang mở cho ô nào; null = không mở.
  const [timePicker, setTimePicker] = useState<'bedtime' | 'wake' | null>(
    null,
  );
  const [sleepReminder, setSleepReminder] = useState(true);
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [cycleStartText, setCycleStartText] = useState('');
  const [cycleStartIso, setCycleStartIso] = useState<string | null>(null);
  const [cycleLength, setCycleLength] = useState(28);
  const [periodDays, setPeriodDays] = useState(5);
  const [calVisible, setCalVisible] = useState(false);
  const [calTarget, setCalTarget] = useState<'birth' | 'cycle'>('birth');
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [showYearList, setShowYearList] = useState(false);

  const isWeightGoal =
    goal === 'maintain' || goal === 'lose' || goal === 'gain';
  const cleanName = name.trim();
  const age = ageFromIso(birthIso);
  const durationDays =
    durationUnit === 'day'
      ? durationValue
      : durationUnit === 'month'
        ? durationValue * 30
        : durationValue * 7;
  const durationUnitLabel =
    durationUnit === 'day'
      ? t('profile.setup.dayUnit')
      : durationUnit === 'month'
        ? t('profile.setup.monthUnit')
        : t('profile.setup.weekUnit');
  const sleepHours = sleepHoursFromTimes(bedtime, wakeTime);
  const recommendedSleep =
    age === null ? 8 : age < 18 ? 9 : age >= 65 ? 7.5 : 8;
  const recommendedRange =
    age !== null && age < 18
      ? t('profile.setup.sleepRangeTeen')
      : age !== null && age >= 65
        ? t('profile.setup.sleepRangeSenior')
        : t('profile.setup.sleepRangeAdult');

  const step1Done =
    cleanName !== '' && !cleanName.includes('@') && gender !== '';
  const step2Done =
    step1Done && height >= 50 && height <= 250 && weight >= 20 && weight <= 300;
  const step3Done =
    step2Done &&
    goal !== '' &&
    ((isWeightGoal &&
      activity !== '' &&
      exerciseSessions >= 1 &&
      exerciseSessions <= 7 &&
      exerciseMinutes >= 15 &&
      exerciseMinutes <= 90 &&
      (goal === 'maintain' ||
        (goal === 'lose' ? targetWeight < weight : targetWeight > weight)) &&
      durationValue >= 1) ||
      (goal === 'sleep' &&
        parseTimeMinutes(bedtime) !== null &&
        parseTimeMinutes(wakeTime) !== null) ||
      (goal === 'cycle' &&
        cycleStartIso !== null &&
        cycleLength >= 20 &&
        cycleLength <= 45 &&
        periodDays >= 2 &&
        periodDays <= 10));

  const load = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const p: any = await getProfile(user.id);
      if (p) {
        if (p.display_name) setName(p.display_name);
        if (p.gender) setGender(p.gender);
        if (p.height_cm) setHeight(Number(p.height_cm));
        if (p.weight_kg) setWeight(Number(p.weight_kg));
        if (p.date_of_birth) {
          setBirthIso(p.date_of_birth);
          setBirthText(isoToText(p.date_of_birth));
        }
        if (p.bedtime_time) setBedtime(toTimeInput(p.bedtime_time));
        if (p.wake_time) setWakeTime(toTimeInput(p.wake_time));
        if (p.sleep_reminder_enabled != null)
          setSleepReminder(Boolean(p.sleep_reminder_enabled));
        if (p.alarm_enabled != null) setAlarmEnabled(Boolean(p.alarm_enabled));
      }
    } catch {}
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, [user?.id]);
  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleGoal = (id: string) => {
    setGoal(id);
    if (id === 'lose') setTargetWeight(weight - 5);
    if (id === 'gain') setTargetWeight(weight + 5);
    if (id === 'sleep' || id === 'cycle') setActivity('');
    if (id === 'lose' || id === 'gain') setExerciseMinutes(45);
    if (id === 'maintain') setExerciseMinutes(30);
  };
  const handleActivity = (id: ActivityId) => {
    setActivity(id);
    const lv = ACTIVITY_LEVELS.find((a) => a.id === id);
    setExerciseSessions(lv && lv.sessions === 0 ? 3 : (lv?.sessions ?? 4));
  };
  const onBirthChange = (t: string) => {
    const f = formatDateInputDigits(t);
    setBirthText(f);
    const p = parseDate(f);
    setBirthIso(p ? p.iso : null);
  };
  const onCycleChange = (t: string) => {
    const f = formatDateInputDigits(t);
    setCycleStartText(f);
    const p = parseDate(f);
    setCycleStartIso(p ? p.iso : null);
  };
  // "HH:MM" -> Date trong ngày hôm nay để đưa vào DateTimePicker.
  // Chuỗi sai định dạng thì dùng giờ mặc định của từng ô.
  const timeStringToDate = (v: string, fallback: string) => {
    const mins =
      parseTimeMinutes(v) ?? parseTimeMinutes(fallback) ?? 22 * 60 + 30;
    const d = new Date();
    d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    return d;
  };
  const dateToHHMM = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  // Giờ đã chọn vẫn lưu đúng "HH:MM" như cũ vào state (rồi toDbTime
  // khi lưu profile); sleepHoursFromTimes và các tính toán khác giữ nguyên.
  const onTimePicked = (d: Date | undefined) => {
    if (!d || !timePicker) return;
    const v = dateToHHMM(d);
    if (timePicker === 'bedtime') setBedtime(v);
    else setWakeTime(v);
    // Android: spinner là hộp thoại, chọn xong (bấm OK) tự đóng;
    // iOS: spinner hiện inline nên giữ lại để chọn tiếp, bấm "Đóng" mới ẩn.
    if (Platform.OS !== 'ios') setTimePicker(null);
  };
  const openCal = (target: 'birth' | 'cycle') => {
    const iso = target === 'birth' ? birthIso : cycleStartIso;
    const d = iso ? new Date(iso + 'T00:00:00') : new Date();
    setCalTarget(target);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
    setShowYearList(false);
    setCalVisible(true);
  };

  const onFinish = async () => {
    if (!cleanName || cleanName.includes('@')) {
      Alert.alert(
        t('profile.setup.alerts.nameTitle'),
        t('profile.setup.alerts.nameMsg'),
      );
      return;
    }
    if (!gender) {
      Alert.alert(
        t('profile.setup.alerts.genderTitle'),
        t('profile.setup.alerts.genderMsg'),
      );
      return;
    }
    if (height < 50 || height > 250 || weight < 20 || weight > 300) {
      Alert.alert(
        t('profile.setup.alerts.heightWeightTitle'),
        t('profile.setup.alerts.heightWeightMsg'),
      );
      return;
    }
    if (birthText && !birthIso) {
      Alert.alert(
        t('profile.setup.alerts.birthTitle'),
        t('profile.setup.alerts.birthMsg'),
      );
      return;
    }
    if (
      goal === 'sleep' &&
      (parseTimeMinutes(bedtime) === null ||
        parseTimeMinutes(wakeTime) === null)
    ) {
      Alert.alert(
        t('profile.setup.alerts.sleepTimeTitle'),
        t('profile.setup.alerts.sleepTimeMsg'),
      );
      return;
    }
    if (!goal) {
      Alert.alert(
        t('profile.setup.alerts.goalTitle'),
        t('profile.setup.alerts.goalMsg'),
      );
      return;
    }
    if (isWeightGoal) {
      if (!activity) {
        Alert.alert(
          t('profile.setup.alerts.activityTitle'),
          t('profile.setup.alerts.activityMsg'),
        );
        return;
      }
      if (goal === 'lose' && !(targetWeight < weight)) {
        Alert.alert(
          t('profile.setup.alerts.targetWeightTitle'),
          t('profile.setup.alerts.targetWeightLoseMsg'),
        );
        return;
      }
      if (goal === 'gain' && !(targetWeight > weight)) {
        Alert.alert(
          t('profile.setup.alerts.targetWeightTitle'),
          t('profile.setup.alerts.targetWeightGainMsg'),
        );
        return;
      }
      const maxD =
        durationUnit === 'day' ? 365 : durationUnit === 'month' ? 12 : 52;
      if (durationValue < 1 || durationValue > maxD) {
        Alert.alert(
          t('profile.setup.alerts.durationTitle'),
          t('profile.setup.alerts.durationMsg'),
        );
        return;
      }
      if (
        exerciseSessions < 1 ||
        exerciseSessions > 7 ||
        exerciseMinutes < 15 ||
        exerciseMinutes > 90
      ) {
        Alert.alert(
          t('profile.setup.alerts.exerciseTitle'),
          t('profile.setup.alerts.exerciseMsg'),
        );
        return;
      }
    }
    if (goal === 'cycle') {
      if (!cycleStartIso) {
        Alert.alert(
          t('profile.setup.alerts.cycleStartTitle'),
          t('profile.setup.alerts.cycleStartMsg'),
        );
        return;
      }
      if (cycleLength < 20 || cycleLength > 45) {
        Alert.alert(
          t('profile.setup.alerts.cycleLengthTitle'),
          t('profile.setup.alerts.cycleLengthMsg'),
        );
        return;
      }
      if (periodDays < 2 || periodDays > 10) {
        Alert.alert(
          t('profile.setup.alerts.periodTitle'),
          t('profile.setup.alerts.periodMsg'),
        );
        return;
      }
    }
    const activityId: ActivityId | null = activity || null;
    const rec = calcRecommendation({
      weightKg: weight,
      heightCm: height,
      age,
      gender,
      goal,
      activityId,
      targetWeightKg: goal === 'lose' || goal === 'gain' ? targetWeight : null,
      targetDurationDays: isWeightGoal ? durationDays : null,
      durationValue: isWeightGoal ? durationValue : null,
      durationUnit: isWeightGoal ? durationUnit : null,
      exerciseSessions: isWeightGoal ? exerciseSessions : null,
      exerciseMinutesPerSession: isWeightGoal ? exerciseMinutes : null,
      sleepBedtime: goal === 'sleep' ? bedtime : null,
      sleepWakeTime: goal === 'sleep' ? wakeTime : null,
      cycleStartDate: goal === 'cycle' ? cycleStartIso : null,
      cycleLengthDays: goal === 'cycle' ? cycleLength : null,
      periodLengthDays: goal === 'cycle' ? periodDays : null,
    });
    const payload = {
      ...rec,
      displayName: cleanName,
      birthDate: birthIso,
      updatedAt: new Date().toISOString(),
    };
    if (user) {
      await saveProfile(user.id, cleanName, height, weight, birthIso, gender);
      const sleepPatch: any = {};
      if (goal === 'sleep') {
        sleepPatch.bedtime_time = toDbTime(bedtime);
        sleepPatch.wake_time = toDbTime(wakeTime);
        sleepPatch.sleep_reminder_enabled = sleepReminder;
        sleepPatch.alarm_enabled = alarmEnabled;
        sleepPatch.sleep_goal_hours = recommendedSleep;
      }
      if (Object.keys(sleepPatch).length > 0) {
        const { error: sleepError } = await supabase
          .from('profiles')
          .update(sleepPatch)
          .eq('id', user.id);
        if (sleepError) {
          Alert.alert(
            t('profile.setup.alerts.sleepSaveTitle'),
            t('profile.setup.alerts.sleepSaveMsg'),
          );
          return;
        }
      }
      if (goal === 'cycle' && cycleStartIso) {
        try {
          await saveCycleStart(user.id, cycleStartIso, cycleLength, periodDays);
        } catch {}
      }
    }
    await AsyncStorage.setItem(
      '@auravital:recommendation',
      JSON.stringify(payload),
    );
    navigation.replace('Recommendation', { recommendation: payload });
  };

  const calDays: (number | null)[] = [];
  {
    const first = new Date(calYear, calMonth, 1).getDay();
    const dim = new Date(calYear, calMonth + 1, 0).getDate();
    for (let i = 0; i < first; i++) calDays.push(null);
    for (let d = 1; d <= dim; d++) calDays.push(d);
  }
  const pickDay = (d: number) => {
    const date = new Date(calYear, calMonth, d);
    if (date > new Date()) return;
    const iso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (calTarget === 'birth') {
      setBirthIso(iso);
      setBirthText(isoToText(iso));
    } else {
      setCycleStartIso(iso);
      setCycleStartText(isoToText(iso));
    }
    setCalVisible(false);
  };

  if (loading)
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[s.wrap, { backgroundColor: theme.background }]}>
          <Text style={{ color: theme.text }}>
            {t('settings.loadingProfile')}
          </Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  return (
    <SafeAreaProvider>
      <SafeAreaView style={[s.wrap, { backgroundColor: theme.background }]}>
        <ScrollView
          scrollEnabled={scrollEnabled}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#4E8A47']}
              tintColor={theme.primaryDark}
            />
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        >
          <Text style={[s.title, { color: theme.text }]}>
            {t('settings.setupProfile')}
          </Text>
          <View style={s.steps}>
            <Text style={step1Done ? s.stepDone : s.stepDefault}>
              {step1Done
                ? `✓ ${t('profile.setup.stepBasic')}`
                : `① ${t('profile.setup.stepBasic')}`}
            </Text>
            <Text style={s.stepLine}>━━</Text>
            <Text style={step2Done ? s.stepDone : s.stepDefault}>
              {step2Done
                ? `✓ ${t('profile.setup.stepBiometrics')}`
                : `② ${t('profile.setup.stepBiometrics')}`}
            </Text>
            <Text style={s.stepLine}>━━</Text>
            <Text style={step3Done ? s.stepDone : s.stepDefault}>
              {step3Done
                ? `✓ ${t('profile.setup.stepGoal')}`
                : `③ ${t('profile.setup.stepGoal')}`}
            </Text>
          </View>
          <Text style={[s.heading, { color: theme.primaryDark }]}>
            {t('profile.setup.eyebrow')}
          </Text>
          <Text style={[s.big, { color: theme.text }]}>
            {t('profile.setup.heading')}
          </Text>
          <Text style={[s.muted, { color: theme.muted }]}>
            {t('profile.setup.intro')}
          </Text>

          <View style={[s.card, { backgroundColor: theme.card }]}>
            <CardTitle icon="person-outline" theme={theme}>
              {t('profile.setup.cardIdentity')}
            </CardTitle>
            <Text style={[s.label, { color: theme.text }]}>
              {t('settings.displayName')}
            </Text>
            <TextInput
              style={[s.input, { color: theme.text }]}
              value={name}
              onChangeText={setName}
              placeholder={t('profile.setup.namePlaceholder')}
              placeholderTextColor={theme.muted}
              autoCapitalize='words'
            />
            <Text style={[s.label, { color: theme.text }]}>
              {t('profile.setup.bioGender')}
            </Text>
            <View style={s.row}>
              {GENDERS.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={[s.genderBtn, gender === g.id && s.goalActive]}
                  onPress={() => setGender(g.id)}
                >
                  <IconBadge name={g.icon} />
                  <Text style={{ color: theme.text }}>{t(g.labelKey)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[s.label, { color: theme.text }]}>
              {t('profile.setup.yourBirthDate')}
            </Text>
            <View style={s.row}>
              <TextInput
                style={[s.input, { flex: 1, color: theme.text }]}
                value={birthText}
                onChangeText={onBirthChange}
                placeholder='DD/MM/YYYY'
                placeholderTextColor={theme.muted}
                keyboardType='numbers-and-punctuation'
              />
              <TouchableOpacity
                style={s.calBtn}
                onPress={() => openCal('birth')}
              >
                <Ionicons name="calendar-outline" size={22} color="#2E7D32" />
              </TouchableOpacity>
            </View>
            {age !== null && (
              <Text style={{ color: theme.muted, marginTop: 6 }}>
                {t('settings.ageYears', { age })}
              </Text>
            )}
          </View>

          <View style={[s.card, { backgroundColor: theme.card }]}>
            <CardTitle icon="expand-outline" theme={theme}>
              {t('profile.setup.cardBiometrics')}
            </CardTitle>
            <Text style={[s.label, { color: theme.text }]}>
              {t('settings.height')}
            </Text>
            <View style={s.adjustRow}>
              <TouchableOpacity
                style={s.adjust}
                onPress={() => setHeight(Math.max(120, height - 1))}
              >
                <Text style={s.adjustText}>−</Text>
              </TouchableOpacity>
              <View
                style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}
              >
                <TextInput
                  style={[s.numInput, { color: theme.primaryDark }]}
                  value={String(height)}
                  keyboardType='number-pad'
                  onChangeText={(t) => {
                    const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
                    if (!isNaN(n)) setHeight(n);
                  }}
                />
                <Text style={{ color: theme.text }}>cm</Text>
              </View>
              <TouchableOpacity
                style={s.adjust}
                onPress={() => setHeight(Math.min(200, height + 1))}
              >
                <Text style={s.adjustText}>+</Text>
              </TouchableOpacity>
            </View>
            <DragRuler
              value={height}
              min={120}
              max={200}
              step={1}
              onChange={setHeight}
              onDragStart={() => setScrollEnabled(false)}
              onDragEnd={() => setScrollEnabled(true)}
            />
            <Text style={[s.label, { color: theme.text, marginTop: 14 }]}>
              {t('settings.weight')}
            </Text>
            <View style={s.adjustRow}>
              <TouchableOpacity
                style={s.adjust}
                onPress={() =>
                  setWeight(Math.max(30, +(weight - 0.5).toFixed(1)))
                }
              >
                <Text style={s.adjustText}>−</Text>
              </TouchableOpacity>
              <View
                style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}
              >
                <TextInput
                  style={[s.numInput, { color: theme.primaryDark }]}
                  value={String(weight)}
                  keyboardType='decimal-pad'
                  onChangeText={(t) => {
                    const n = parseFloat(t.replace(/[^0-9.]/g, ''));
                    if (!isNaN(n)) setWeight(n);
                  }}
                />
                <Text style={{ color: theme.text }}>kg</Text>
              </View>
              <TouchableOpacity
                style={s.adjust}
                onPress={() =>
                  setWeight(Math.min(150, +(weight + 0.5).toFixed(1)))
                }
              >
                <Text style={s.adjustText}>+</Text>
              </TouchableOpacity>
            </View>
            <DragRuler
              value={weight}
              min={30}
              max={150}
              step={0.5}
              onChange={setWeight}
              onDragStart={() => setScrollEnabled(false)}
              onDragEnd={() => setScrollEnabled(true)}
            />
          </View>

          <View style={[s.card, { backgroundColor: theme.card }]}>
            <CardTitle icon="flag-outline" theme={theme}>
              {t('profile.setup.cardGoal')}
            </CardTitle>
            <View style={{ gap: 8 }}>
              {GOALS.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={[s.goalBtn, goal === g.id && s.goalActive]}
                  onPress={() => handleGoal(g.id)}
                >
                  <IconBadge name={g.icon} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: '700' }}>
                      {t(g.titleKey)}
                    </Text>
                    <Text style={{ color: theme.muted, fontSize: 13 }}>
                      {t(g.descKey)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {goal === 'sleep' && (
          <View style={[s.card, { backgroundColor: theme.card }]}>
            <CardTitle icon="moon-outline" theme={theme}>
              {t('profile.setup.cardSleepSchedule')}
            </CardTitle>
            <Text style={{ color: theme.muted }}>
              {t('profile.setup.sleepDesc')}
            </Text>
            <FieldLabel icon="moon-outline" theme={theme}>
              {t('profile.setup.bedtimeLabel')}
            </FieldLabel>
            <TouchableOpacity
              style={[s.input, { justifyContent: 'center' }]}
              onPress={() => setTimePicker('bedtime')}
            >
              <Text style={{ color: theme.text, fontSize: 16 }}>
                {bedtime}
              </Text>
            </TouchableOpacity>
            <FieldLabel icon="sunny-outline" theme={theme}>
              {t('profile.setup.wakeLabel')}
            </FieldLabel>
            <TouchableOpacity
              style={[s.input, { justifyContent: 'center' }]}
              onPress={() => setTimePicker('wake')}
            >
              <Text style={{ color: theme.text, fontSize: 16 }}>
                {wakeTime}
              </Text>
            </TouchableOpacity>
            {timePicker ? (
              <>
                <DateTimePicker
                  value={timeStringToDate(
                    timePicker === 'bedtime' ? bedtime : wakeTime,
                    timePicker === 'bedtime' ? '22:30' : '06:30',
                  )}
                  mode='time'
                  display='spinner'
                  is24Hour
                  onValueChange={(_e, d) => onTimePicked(d)}
                  onDismiss={() => setTimePicker(null)}
                />
                {Platform.OS === 'ios' ? (
                  <TouchableOpacity
                    style={s.closeBtn}
                    onPress={() => setTimePicker(null)}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>
                      {t('common.close')}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </>
            ) : null}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 12,
              }}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>
                {t('settings.sleepReminder')}
              </Text>
              <Switch value={sleepReminder} onValueChange={setSleepReminder} />
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 12,
              }}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>
                {t('profile.setup.wakeAlarm')}
              </Text>
              <Switch value={alarmEnabled} onValueChange={setAlarmEnabled} />
            </View>
          </View>
          )}

          {isWeightGoal && (
            <View style={[s.card, { backgroundColor: theme.card }]}>
              <CardTitle icon="flash-outline" theme={theme}>
                {t('profile.setup.cardActivity')}
              </CardTitle>
              <View style={{ gap: 8 }}>
                {ACTIVITY_LEVELS.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={[s.goalBtn, activity === a.id && s.goalActive]}
                    onPress={() => handleActivity(a.id)}
                  >
                    <IconBadge name={ACTIVITY_ICONS[a.id] || 'walk-outline'} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontWeight: '700' }}>
                        {t(a.titleKey)}
                      </Text>
                      <Text style={{ color: theme.muted, fontSize: 13 }}>
                        {t(a.descKey)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {(goal === 'lose' || goal === 'gain') && (
            <View style={[s.card, { backgroundColor: theme.card }]}>
              <CardTitle icon="barbell-outline" theme={theme}>
                {t('settings.targetWeight')}
              </CardTitle>
              <View style={s.adjustRow}>
                <TouchableOpacity
                  style={s.adjust}
                  onPress={() =>
                    setTargetWeight(+(targetWeight - 0.5).toFixed(1))
                  }
                >
                  <Text style={s.adjustText}>−</Text>
                </TouchableOpacity>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    gap: 4,
                  }}
                >
                  <TextInput
                    style={[s.numInput, { color: theme.primaryDark }]}
                    value={String(targetWeight)}
                    keyboardType='decimal-pad'
                    onChangeText={(t) => {
                      const n = parseFloat(t.replace(/[^0-9.]/g, ''));
                      if (!isNaN(n)) setTargetWeight(n);
                    }}
                  />
                  <Text style={{ color: theme.text }}>kg</Text>
                </View>
                <TouchableOpacity
                  style={s.adjust}
                  onPress={() =>
                    setTargetWeight(+(targetWeight + 0.5).toFixed(1))
                  }
                >
                  <Text style={s.adjustText}>+</Text>
                </TouchableOpacity>
              </View>
              <DragRuler
                value={targetWeight}
                min={20}
                max={300}
                step={0.5}
                onChange={setTargetWeight}
                onDragStart={() => setScrollEnabled(false)}
                onDragEnd={() => setScrollEnabled(true)}
              />
            </View>
          )}

          {isWeightGoal && (
            <View style={[s.card, { backgroundColor: theme.card }]}>
              <CardTitle icon="hourglass-outline" theme={theme}>
                {t('profile.setup.cardDuration')}
              </CardTitle>
              <Text style={{ color: theme.muted }}>
                {t('profile.setup.durationNote')}
              </Text>
              <View style={s.adjustRow}>
                <TouchableOpacity
                  style={s.adjust}
                  onPress={() =>
                    setDurationValue(Math.max(1, durationValue - 1))
                  }
                >
                  <Text style={s.adjustText}>−</Text>
                </TouchableOpacity>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    gap: 4,
                  }}
                >
                  <TextInput
                    style={[s.numInput, { color: theme.primaryDark }]}
                    value={String(durationValue)}
                    keyboardType='number-pad'
                    onChangeText={(t) => {
                      const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
                      if (!isNaN(n)) setDurationValue(n);
                    }}
                  />
                  <Text style={{ color: theme.text }}>
                    {durationUnitLabel}
                  </Text>
                </View>
                <TouchableOpacity
                  style={s.adjust}
                  onPress={() =>
                    setDurationValue(
                      Math.min(
                        durationUnit === 'day'
                          ? 365
                          : durationUnit === 'month'
                            ? 12
                            : 52,
                        durationValue + 1,
                      ),
                    )
                  }
                >
                  <Text style={s.adjustText}>+</Text>
                </TouchableOpacity>
              </View>
              <View style={s.row}>
                <TouchableOpacity
                  style={[s.optBtn, durationUnit === 'day' && s.goalActive]}
                  onPress={() => {
                    setDurationUnit('day');
                    setDurationValue(90);
                  }}
                >
                  <Text style={{ color: theme.text }}>
                    {t('profile.setup.dayUnit')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.optBtn, durationUnit === 'week' && s.goalActive]}
                  onPress={() => {
                    setDurationUnit('week');
                    setDurationValue(12);
                  }}
                >
                  <Text style={{ color: theme.text }}>
                    {t('profile.setup.weekUnit')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.optBtn, durationUnit === 'month' && s.goalActive]}
                  onPress={() => {
                    setDurationUnit('month');
                    setDurationValue(3);
                  }}
                >
                  <Text style={{ color: theme.text }}>
                    {t('profile.setup.monthUnit')}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={{ color: theme.muted, marginTop: 6 }}>
                {t('profile.setup.durationSummary', {
                  value: durationValue,
                  unit: durationUnitLabel,
                  days: durationDays,
                })}
              </Text>
            </View>
          )}

          {isWeightGoal && activity !== '' && (
            <View style={[s.card, { backgroundColor: theme.card }]}>
              <CardTitle icon="walk-outline" theme={theme}>
                {t('profile.setup.cardExercise')}
              </CardTitle>
              <Text style={[s.label, { color: theme.text }]}>
                {t('profile.setup.sessionsPerWeek')}
              </Text>
              <View style={s.adjustRow}>
                <TouchableOpacity
                  style={s.adjust}
                  onPress={() =>
                    setExerciseSessions(Math.max(1, exerciseSessions - 1))
                  }
                >
                  <Text style={s.adjustText}>−</Text>
                </TouchableOpacity>
                <Text style={[s.numInput, { color: theme.primaryDark }]}>
                  {exerciseSessions}
                </Text>
                <TouchableOpacity
                  style={s.adjust}
                  onPress={() =>
                    setExerciseSessions(Math.min(7, exerciseSessions + 1))
                  }
                >
                  <Text style={s.adjustText}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={[s.label, { color: theme.text }]}>
                {t('profile.setup.minutesPerSession')}
              </Text>
              <View style={s.adjustRow}>
                <TouchableOpacity
                  style={s.adjust}
                  onPress={() =>
                    setExerciseMinutes(Math.max(15, exerciseMinutes - 5))
                  }
                >
                  <Text style={s.adjustText}>−</Text>
                </TouchableOpacity>
                <Text style={[s.numInput, { color: theme.primaryDark }]}>
                  {exerciseMinutes}
                </Text>
                <TouchableOpacity
                  style={s.adjust}
                  onPress={() =>
                    setExerciseMinutes(Math.min(90, exerciseMinutes + 5))
                  }
                >
                  <Text style={s.adjustText}>+</Text>
                </TouchableOpacity>
              </View>
              <Text
                style={{
                  color: theme.primaryDark,
                  fontWeight: '700',
                  marginTop: 8,
                }}
              >
                {t('profile.setup.exerciseTotal', {
                  minutes: exerciseSessions * exerciseMinutes,
                })}
              </Text>
            </View>
          )}

          {goal === 'sleep' && (
            <View style={[s.card, { backgroundColor: theme.card }]}>
              <CardTitle icon="moon-outline" theme={theme}>
                {t('profile.setup.cardSleep')}
              </CardTitle>
              <Text style={{ color: theme.text }}>
                {t('profile.setup.systemSuggests')}{' '}
                <Text style={{ fontWeight: '800', color: theme.primaryDark }}>
                  {t('profile.setup.hoursPerDay', {
                    value: recommendedSleep,
                  })}
                </Text>{' '}
                {t('profile.setup.sleepRangeForAge', {
                  range: recommendedRange,
                })}
              </Text>
              <Text style={{ color: theme.muted, marginTop: 8 }}>
                {t('profile.setup.sleepSourceNote')}
              </Text>
              {sleepHours !== null && (
                <Text style={{ color: theme.muted, marginTop: 8 }}>
                  {t('profile.setup.sleepHabit', {
                    hours: fmtSleepHours(sleepHours, locale),
                  })}
                  {sleepHours < recommendedSleep
                    ? t('profile.setup.sleepDeficit', {
                        diff: (recommendedSleep - sleepHours).toFixed(1),
                      })
                    : t('profile.setup.sleepMet')}
                </Text>
              )}
            </View>
          )}

          {goal === 'cycle' && (
            <View style={[s.card, { backgroundColor: theme.card }]}>
              <CardTitle icon="flower-outline" theme={theme}>
                {t('profile.setup.cardCycle')}
              </CardTitle>
              <FieldLabel icon="calendar-outline" theme={theme}>
                {t('profile.setup.cycleStartLabel')}
              </FieldLabel>
              <View style={s.row}>
                <TextInput
                  style={[s.input, { flex: 1, color: theme.text }]}
                  value={cycleStartText}
                  onChangeText={onCycleChange}
                  placeholder='DD/MM/YYYY'
                  placeholderTextColor={theme.muted}
                  keyboardType='numbers-and-punctuation'
                />
                <TouchableOpacity
                  style={s.calBtn}
                  onPress={() => openCal('cycle')}
                >
                  <Ionicons name="calendar-outline" size={22} color="#2E7D32" />
                </TouchableOpacity>
              </View>
              <FieldLabel icon="repeat-outline" theme={theme}>
                {t('profile.setup.cycleLengthLabel')}
              </FieldLabel>
              <View style={s.adjustRow}>
                <TouchableOpacity
                  style={s.adjust}
                  onPress={() => setCycleLength(Math.max(20, cycleLength - 1))}
                >
                  <Text style={s.adjustText}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={[s.numInput, { color: theme.primaryDark }]}
                  value={String(cycleLength)}
                  keyboardType='number-pad'
                  onChangeText={(t) => {
                    const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
                    if (!isNaN(n)) setCycleLength(n);
                  }}
                />
                <TouchableOpacity
                  style={s.adjust}
                  onPress={() => setCycleLength(Math.min(45, cycleLength + 1))}
                >
                  <Text style={s.adjustText}>+</Text>
                </TouchableOpacity>
              </View>
              <FieldLabel icon="water-outline" theme={theme}>
                {t('profile.setup.periodLabel')}
              </FieldLabel>
              <View style={s.adjustRow}>
                <TouchableOpacity
                  style={s.adjust}
                  onPress={() => setPeriodDays(Math.max(2, periodDays - 1))}
                >
                  <Text style={s.adjustText}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={[s.numInput, { color: theme.primaryDark }]}
                  value={String(periodDays)}
                  keyboardType='number-pad'
                  onChangeText={(t) => {
                    const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
                    if (!isNaN(n)) setPeriodDays(n);
                  }}
                />
                <TouchableOpacity
                  style={s.adjust}
                  onPress={() => setPeriodDays(Math.min(10, periodDays + 1))}
                >
                  <Text style={s.adjustText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: theme.primaryDark }]}
            onPress={onFinish}
          >
            <Text style={s.primaryBtnText}>
              {t('profile.setup.finish')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
        <Modal visible={calVisible} animationType='slide' transparent>
          <View style={s.modalBg}>
            <View style={[s.modalBox, { backgroundColor: theme.card }]}>
              <Text
                style={{
                  color: theme.text,
                  fontSize: 18,
                  fontWeight: '800',
                  textAlign: 'center',
                  marginBottom: 12,
                }}
              >
                {calTarget === 'birth'
                  ? t('profile.setup.pickBirth')
                  : t('profile.setup.pickCycleStart')}
              </Text>
              <View style={s.row}>
                <TouchableOpacity
                  hitSlop={10}
                  onPress={() => {
                    const m = calMonth - 1;
                    if (m < 0) {
                      setCalMonth(11);
                      setCalYear(calYear - 1);
                    } else setCalMonth(m);
                  }}
                >
                  <Text style={{ color: theme.text, fontSize: 20 }}>‹</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  hitSlop={8}
                  onPress={() => setShowYearList(!showYearList)}
                >
                  <Text style={{ color: theme.text, fontWeight: '700' }}>
                    {t('profile.setup.monthYear', {
                      month: calMonth + 1,
                      year: calYear,
                    })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  hitSlop={10}
                  onPress={() => {
                    const m = calMonth + 1;
                    if (m > 11) {
                      setCalMonth(0);
                      setCalYear(calYear + 1);
                    } else setCalMonth(m);
                  }}
                >
                  <Text style={{ color: theme.text, fontSize: 20 }}>›</Text>
                </TouchableOpacity>
              </View>
              {showYearList ? (
                <ScrollView style={{ maxHeight: 300 }}>
                  {Array.from(
                    { length: new Date().getFullYear() - 1900 + 1 },
                    (_, i) => new Date().getFullYear() - i,
                  ).map((y) => (
                    <TouchableOpacity
                      key={y}
                      style={s.yearRow}
                      onPress={() => {
                        setCalYear(y);
                        setShowYearList(false);
                      }}
                    >
                      <Text style={{ color: theme.text }}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <View style={s.calGrid}>
                  {calDays.map((d, i) =>
                    d === null ? (
                      <View key={i} style={s.calCell} />
                    ) : (
                      <TouchableOpacity
                        key={i}
                        style={s.calCell}
                        hitSlop={4}
                        onPress={() => pickDay(d)}
                      >
                        <Text
                          style={{ color: theme.text, textAlign: 'center' }}
                        >
                          {d}
                        </Text>
                      </TouchableOpacity>
                    ),
                  )}
                </View>
              )}
              <TouchableOpacity
                style={s.closeBtn}
                onPress={() => setCalVisible(false)}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  {t('common.close')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
