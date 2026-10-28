import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  PanResponder,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../auth/AuthContext';
import { useSettings } from '../../../context/SettingsContext';
import { supabase } from '../../../lib/supabase';
import {
  getProfile,
  saveProfile,
  saveCycleStart,
} from '../../../lib/auravitalApi';
import {
  ACTIVITY_LEVELS,
  calcRecommendation,
  parseTimeMinutes,
  sleepHoursFromTimes,
} from '../../../lib/healthCalc';
import type { ActivityId, DurationUnit } from '../../../lib/healthCalc';

function parseDate(text: string) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const d = parseInt(m[1], 10),
    mo = parseInt(m[2], 10),
    y = parseInt(m[3], 10);
  const date = new Date(y, mo - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d
  )
    return null;
  if (y < 1900 || date > new Date()) return null;
  return {
    iso: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    date,
  };
}
function isoToText(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function ageFromIso(iso: string | null) {
  if (!iso) return null;
  const b = new Date(iso + 'T00:00:00'),
    t = new Date();
  let age = t.getFullYear() - b.getFullYear();
  if (
    t.getMonth() < b.getMonth() ||
    (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())
  )
    age -= 1;
  return age;
}
function fmtSleepHours(h: number) {
  const hh = Math.floor(h),
    mm = Math.round((h - hh) * 60);
  return mm === 60 ? `${hh + 1} giờ` : `${hh} giờ ${mm} phút`;
}
const toDbTime = (v: string) => {
  const t = v.trim();
  return t.length === 5 ? `${t}:00` : t;
};
const toTimeInput = (t: string | null) => (t ? t.slice(0, 5) : '');

// Vòng tròn nhạt + icon xanh đậm, đúng kiểu ảnh bạn gửi.
function IconBadge({ name, solid }: { name: any; solid?: boolean }) {
  return (
    <View style={[s.iconBadge, solid && { backgroundColor: '#2E7D32' }]}>
      <Ionicons name={name} size={22} color={solid ? '#fff' : '#2E7D32'} />
    </View>
  );
}

// Tiêu đề thẻ có icon, thay cho tiêu đề gắn emoji ở đầu.
function CardTitle({ icon, children, theme }: any) {
  return (
    <View style={s.cardTitleRow}>
      <IconBadge name={icon} />
      <Text style={[s.cardTitle, { color: theme.text, marginBottom: 0 }]}>
        {children}
      </Text>
    </View>
  );
}

// Nhãn trường có icon nhỏ, thay cho nhãn gắn emoji.
function FieldLabel({ icon, children, theme }: any) {
  return (
    <View style={s.labelRow}>
      <Ionicons name={icon} size={18} color="#2E7D32" />
      <Text style={[s.label, { color: theme.text, marginTop: 0, marginBottom: 0 }]}>
        {children}
      </Text>
    </View>
  );
}

function DragRuler({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const [w, setW] = useState(0);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: (e) => {
        if (!w) return;
        const r = Math.max(0, Math.min(1, e.nativeEvent.locationX / w));
        onChange(
          Math.max(
            min,
            Math.min(max, Math.round((min + r * (max - min)) / step) * step),
          ),
        );
      },
      onPanResponderMove: (e) => {
        if (!w) return;
        const r = Math.max(0, Math.min(1, e.nativeEvent.locationX / w));
        onChange(
          Math.max(
            min,
            Math.min(max, Math.round((min + r * (max - min)) / step) * step),
          ),
        );
      },
    }),
  ).current;
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      {...pan.panHandlers}
      style={s.rulerTrack}
    >
      <View style={[s.rulerFill, { width: `${pct}%` }]} />
      <View style={[s.rulerThumb, { left: `${pct}%` }]} />
    </View>
  );
}

const GENDERS = [
  { id: 'Nam', icon: 'male-outline' },
  { id: 'Nữ', icon: 'female-outline' },
  { id: 'Khác', icon: 'leaf-outline' },
];
const GOALS = [
  {
    id: 'maintain',
    icon: 'fitness-outline',
    title: 'Duy trì vóc dáng & Vận động',
    desc: 'Tăng cường sức bền, duy trì chỉ số vàng',
  },
  {
    id: 'lose',
    icon: 'leaf-outline',
    title: 'Giảm cân & Dinh dưỡng sạch',
    desc: 'Thâm hụt calo lành mạnh, ăn nguyên bản',
  },
  {
    id: 'gain',
    icon: 'barbell-outline',
    title: 'Tăng cân lành mạnh',
    desc: 'Thặng dư calo lành mạnh, tăng cơ, không tăng mỡ',
  },
  {
    id: 'sleep',
    icon: 'moon-outline',
    title: 'Cải thiện giấc ngủ sâu',
    desc: 'Phục hồi thần kinh, giải tỏa căng thẳng',
  },
  {
    id: 'cycle',
    icon: 'flower-outline',
    title: 'Chu kỳ & Nội tiết tố',
    desc: 'Theo dõi nhịp sinh lý nữ & tuần hoàn năng lượng',
  },
];
const ACTIVITY_ICONS: Record<string, string> = {
  sedentary: 'tv-outline',
  light: 'walk-outline',
  moderate: 'bicycle-outline',
  high: 'barbell-outline',
  veryHigh: 'flame-outline',
};

export default function ProfileSetupScreen({ navigation }: any) {
  const { user } = useAuth();
  const { theme } = useSettings();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
  const sleepHours = sleepHoursFromTimes(bedtime, wakeTime);
  const recommendedSleep =
    age === null ? 8 : age < 18 ? 9 : age >= 65 ? 7.5 : 8;
  const recommendedRange =
    age !== null && age < 18
      ? '8–10 giờ'
      : age !== null && age >= 65
        ? '7–8 giờ'
        : '7–9 giờ';

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
    setBirthText(t);
    const p = parseDate(t);
    setBirthIso(p ? p.iso : null);
  };
  const onCycleChange = (t: string) => {
    setCycleStartText(t);
    const p = parseDate(t);
    setCycleStartIso(p ? p.iso : null);
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
        'Tên hiển thị chưa đúng',
        'Nhập họ tên đầy đủ, không dùng email.',
      );
      return;
    }
    if (!gender) {
      Alert.alert('Chưa chọn giới tính', 'Chọn giới tính.');
      return;
    }
    if (height < 50 || height > 250 || weight < 20 || weight > 300) {
      Alert.alert(
        'Chiều cao / cân nặng chưa đúng',
        'Chiều cao 50–250 cm, cân nặng 20–300 kg.',
      );
      return;
    }
    if (birthText && !birthIso) {
      Alert.alert(
        'Ngày sinh chưa đúng',
        'Nhập đúng ngày thật, dạng DD/MM/YYYY, không phải ngày tương lai.',
      );
      return;
    }
    if (
      goal === 'sleep' &&
      (parseTimeMinutes(bedtime) === null ||
        parseTimeMinutes(wakeTime) === null)
    ) {
      Alert.alert(
        'Giờ ngủ chưa đúng',
        'Nhập giờ dạng HH:MM, ví dụ 22:30 và 06:30.',
      );
      return;
    }
    if (!goal) {
      Alert.alert('Chưa chọn mục tiêu', 'Chọn 1 mục tiêu.');
      return;
    }
    if (isWeightGoal) {
      if (!activity) {
        Alert.alert(
          'Chưa chọn cường độ',
          'Mục tiêu cân nặng cần cường độ để tính TDEE.',
        );
        return;
      }
      if (goal === 'lose' && !(targetWeight < weight)) {
        Alert.alert(
          'Cân mục tiêu chưa đúng',
          'Giảm cân thì cân mục tiêu phải nhỏ hơn cân hiện tại.',
        );
        return;
      }
      if (goal === 'gain' && !(targetWeight > weight)) {
        Alert.alert(
          'Cân mục tiêu chưa đúng',
          'Tăng cân thì cân mục tiêu phải lớn hơn cân hiện tại.',
        );
        return;
      }
      const maxD =
        durationUnit === 'day' ? 365 : durationUnit === 'month' ? 12 : 52;
      if (durationValue < 1 || durationValue > maxD) {
        Alert.alert(
          'Thời gian mục tiêu chưa đúng',
          'Ngày 1–365, tuần 1–52, tháng 1–12.',
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
          'Luyện tập chưa đúng',
          'Số buổi 1–7 buổi/tuần, mỗi buổi 15–90 phút.',
        );
        return;
      }
    }
    if (goal === 'cycle') {
      if (!cycleStartIso) {
        Alert.alert(
          'Ngày bắt đầu chưa đúng',
          'Nhập ngày bắt đầu kỳ dạng DD/MM/YYYY hoặc chọn từ lịch.',
        );
        return;
      }
      if (cycleLength < 20 || cycleLength > 45) {
        Alert.alert(
          'Độ dài chu kỳ chưa đúng',
          'Độ dài chu kỳ từ 20 đến 45 ngày.',
        );
        return;
      }
      if (periodDays < 2 || periodDays > 10) {
        Alert.alert(
          'Số ngày hành kinh chưa đúng',
          'Số ngày hành kinh từ 2 đến 10 ngày.',
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
            'Chưa lưu được lịch ngủ',
            'Chạy migration thêm bedtime_time, wake_time, sleep_reminder_enabled, alarm_enabled vào profiles rồi thử lại.',
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
          <Text style={{ color: theme.text }}>Đang tải hồ sơ...</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  return (
    <SafeAreaProvider>
      <SafeAreaView style={[s.wrap, { backgroundColor: theme.background }]}>
        <ScrollView
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
          <Text style={[s.title, { color: theme.text }]}>Thiết lập hồ sơ</Text>
          <View style={s.steps}>
            <Text style={step1Done ? s.stepDone : s.stepDefault}>
              {step1Done ? '✓ Cơ bản' : '① Cơ bản'}
            </Text>
            <Text style={s.stepLine}>━━</Text>
            <Text style={step2Done ? s.stepDone : s.stepDefault}>
              {step2Done ? '✓ Chỉ số sinh học' : '② Chỉ số sinh học'}
            </Text>
            <Text style={s.stepLine}>━━</Text>
            <Text style={step3Done ? s.stepDone : s.stepDefault}>
              {step3Done ? '✓ Mục tiêu' : '③ Mục tiêu'}
            </Text>
          </View>
          <Text style={[s.heading, { color: theme.primaryDark }]}>
            CÁ NHÂN HÓA NHỊP SINH HỌC
          </Text>
          <Text style={[s.big, { color: theme.text }]}>
            Khởi tạo hồ sơ năng lượng
          </Text>
          <Text style={[s.muted, { color: theme.muted }]}>
            AuraVital phân tích các chỉ số nền tảng để tính chỉnh lộ trình vận
            động, nhịp ngủ và đường chất vì mô hài hòa.
          </Text>

          <View style={[s.card, { backgroundColor: theme.card }]}>
            <CardTitle icon="person-outline" theme={theme}>
              1. Danh tính & Ngày sinh
            </CardTitle>
            <Text style={[s.label, { color: theme.text }]}>Tên hiển thị</Text>
            <TextInput
              style={[s.input, { color: theme.text }]}
              value={name}
              onChangeText={setName}
              placeholder='Nhập họ tên đầy đủ, ví dụ Bùi Ngọc Hiền'
              placeholderTextColor={theme.muted}
              autoCapitalize='words'
            />
            <Text style={[s.label, { color: theme.text }]}>
              Giới tính sinh học
            </Text>
            <View style={s.row}>
              {GENDERS.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={[s.genderBtn, gender === g.id && s.goalActive]}
                  onPress={() => setGender(g.id)}
                >
                  <IconBadge name={g.icon} />
                  <Text style={{ color: theme.text }}>{g.id}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[s.label, { color: theme.text }]}>
              Ngày sinh của bạn
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
                {age} tuổi
              </Text>
            )}
          </View>

          <View style={[s.card, { backgroundColor: theme.card }]}>
            <CardTitle icon="expand-outline" theme={theme}>
              2. Chỉ số sinh học
            </CardTitle>
            <Text style={[s.label, { color: theme.text }]}>Chiều cao</Text>
            <View style={s.adjustRow}>
              <TouchableOpacity
                style={s.adjust}
                onPress={() => setHeight(Math.max(50, height - 1))}
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
                onPress={() => setHeight(Math.min(250, height + 1))}
              >
                <Text style={s.adjustText}>+</Text>
              </TouchableOpacity>
            </View>
            <DragRuler
              value={height}
              min={50}
              max={250}
              step={1}
              onChange={setHeight}
            />
            <Text style={[s.label, { color: theme.text, marginTop: 14 }]}>
              Cân nặng
            </Text>
            <View style={s.adjustRow}>
              <TouchableOpacity
                style={s.adjust}
                onPress={() =>
                  setWeight(Math.max(20, +(weight - 0.5).toFixed(1)))
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
                  setWeight(Math.min(300, +(weight + 0.5).toFixed(1)))
                }
              >
                <Text style={s.adjustText}>+</Text>
              </TouchableOpacity>
            </View>
            <DragRuler
              value={weight}
              min={20}
              max={300}
              step={0.5}
              onChange={setWeight}
            />
          </View>

          <View style={[s.card, { backgroundColor: theme.card }]}>
            <CardTitle icon="flag-outline" theme={theme}>
              3. Mục tiêu của bạn
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
                      {g.title}
                    </Text>
                    <Text style={{ color: theme.muted, fontSize: 13 }}>
                      {g.desc}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {goal === 'sleep' && (
          <View style={[s.card, { backgroundColor: theme.card }]}>
            <CardTitle icon="moon-outline" theme={theme}>
              Lịch ngủ quen thuộc
            </CardTitle>
            <Text style={{ color: theme.muted }}>
              Giờ này dùng cho nhắc đi ngủ và báo thức ở màn hình giấc ngủ,
              và để so với số giờ ngủ đề xuất ở thẻ bên dưới.
            </Text>
            <FieldLabel icon="moon-outline" theme={theme}>
              Giờ bắt đầu ngủ (thói quen)
            </FieldLabel>
            <TextInput
              style={[s.input, { color: theme.text }]}
              value={bedtime}
              onChangeText={setBedtime}
              placeholder='22:30'
              placeholderTextColor={theme.muted}
              keyboardType='numbers-and-punctuation'
            />
            <FieldLabel icon="sunny-outline" theme={theme}>
              Giờ dậy (thói quen)
            </FieldLabel>
            <TextInput
              style={[s.input, { color: theme.text }]}
              value={wakeTime}
              onChangeText={setWakeTime}
              placeholder='06:30'
              placeholderTextColor={theme.muted}
              keyboardType='numbers-and-punctuation'
            />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 12,
              }}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>
                Nhắc đi ngủ
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
                Báo thức giờ dậy
              </Text>
              <Switch value={alarmEnabled} onValueChange={setAlarmEnabled} />
            </View>
          </View>
          )}

          {isWeightGoal && (
            <View style={[s.card, { backgroundColor: theme.card }]}>
              <CardTitle icon="flash-outline" theme={theme}>
                Cường độ luyện tập hiện tại
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
                        {a.title}
                      </Text>
                      <Text style={{ color: theme.muted, fontSize: 13 }}>
                        {a.desc}
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
                Cân nặng mục tiêu
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
              />
            </View>
          )}

          {isWeightGoal && (
            <View style={[s.card, { backgroundColor: theme.card }]}>
              <CardTitle icon="hourglass-outline" theme={theme}>
                Muốn đạt trong bao lâu?
              </CardTitle>
              <Text style={{ color: theme.muted }}>
                1 tuần = 7 ngày, 1 tháng = 30 ngày.
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
                    {durationUnit === 'day'
                      ? 'ngày'
                      : durationUnit === 'month'
                        ? 'tháng'
                        : 'tuần'}
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
                  <Text style={{ color: theme.text }}>Ngày</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.optBtn, durationUnit === 'week' && s.goalActive]}
                  onPress={() => {
                    setDurationUnit('week');
                    setDurationValue(12);
                  }}
                >
                  <Text style={{ color: theme.text }}>Tuần</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.optBtn, durationUnit === 'month' && s.goalActive]}
                  onPress={() => {
                    setDurationUnit('month');
                    setDurationValue(3);
                  }}
                >
                  <Text style={{ color: theme.text }}>Tháng</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ color: theme.muted, marginTop: 6 }}>
                Bạn đã set: {durationValue}{' '}
                {durationUnit === 'day'
                  ? 'ngày'
                  : durationUnit === 'month'
                    ? 'tháng'
                    : 'tuần'}{' '}
                (tương đương {durationDays} ngày để tính).
              </Text>
            </View>
          )}

          {isWeightGoal && activity !== '' && (
            <View style={[s.card, { backgroundColor: theme.card }]}>
              <CardTitle icon="walk-outline" theme={theme}>
                Thời gian luyện tập bạn muốn
              </CardTitle>
              <Text style={[s.label, { color: theme.text }]}>
                Số buổi / tuần
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
                Số phút / buổi
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
                Tổng: {exerciseSessions * exerciseMinutes} phút/tuần
              </Text>
            </View>
          )}

          {goal === 'sleep' && (
            <View style={[s.card, { backgroundColor: theme.card }]}>
              <CardTitle icon="moon-outline" theme={theme}>
                Giấc ngủ của bạn
              </CardTitle>
              <Text style={{ color: theme.text }}>
                Hệ thống đề xuất:{' '}
                <Text style={{ fontWeight: '800', color: theme.primaryDark }}>
                  {recommendedSleep} giờ/ngày
                </Text>{' '}
                ({recommendedRange} cho lứa tuổi của bạn).
              </Text>
              <Text style={{ color: theme.muted, marginTop: 8 }}>
                Giờ ngủ và giờ dậy lấy từ thẻ Lịch ngủ quen thuộc ở trên.
              </Text>
              {sleepHours !== null && (
                <Text style={{ color: theme.muted, marginTop: 8 }}>
                  Thói quen của bạn: ngủ {fmtSleepHours(sleepHours)} mỗi đêm
                  {sleepHours < recommendedSleep
                    ? `, thiếu ${(recommendedSleep - sleepHours).toFixed(1)} giờ so với đề xuất.`
                    : ' — đã đạt đề xuất.'}
                </Text>
              )}
            </View>
          )}

          {goal === 'cycle' && (
            <View style={[s.card, { backgroundColor: theme.card }]}>
              <CardTitle icon="flower-outline" theme={theme}>
                Chu kỳ của bạn
              </CardTitle>
              <FieldLabel icon="calendar-outline" theme={theme}>
                Ngày bắt đầu kỳ gần nhất
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
                Độ dài chu kỳ (ngày)
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
                Số ngày hành kinh (ngày)
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
            <Text style={s.primaryBtnText}>Hoàn tất thiết lập →</Text>
          </TouchableOpacity>
        </ScrollView>
        <Modal visible={calVisible} animationType='slide' transparent>
          <View style={s.modalBg}>
            <View style={[s.modalBox, { backgroundColor: theme.card }]}>
              <Text
                style={{
                  color: theme.muted,
                  textAlign: 'center',
                  marginBottom: 8,
                }}
              >
                {calTarget === 'birth'
                  ? 'Chọn ngày sinh'
                  : 'Chọn ngày bắt đầu kỳ'}
              </Text>
              <View style={s.row}>
                <TouchableOpacity
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
                  onPress={() => setShowYearList(!showYearList)}
                >
                  <Text style={{ color: theme.text, fontWeight: '700' }}>
                    Tháng {calMonth + 1} / {calYear}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
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
                <Text style={{ color: theme.text }}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
const s = StyleSheet.create({
  wrap: { flex: 1 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 10 },
  steps: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  stepDone: { color: '#4E8A47', fontWeight: '800' },
  stepDefault: { color: '#9CA3AF', fontWeight: '700' },
  stepLine: { color: '#D1D5DB', marginHorizontal: 6 },
  heading: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  big: { fontSize: 26, fontWeight: '800', marginBottom: 6 },
  muted: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  card: {
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', marginBottom: 10 },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EAF0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontWeight: '700', marginTop: 10, marginBottom: 6 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  optBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  genderBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  goalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  goalActive: { backgroundColor: '#C8E6C9', borderColor: '#4E8A47' },
  calBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EAF0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
    marginVertical: 8,
  },
  adjust: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustText: { fontSize: 22, fontWeight: '700' },
  numInput: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    minWidth: 70,
  },
  rulerTrack: {
    height: 28,
    backgroundColor: '#E5E7EB',
    borderRadius: 14,
    marginVertical: 8,
    justifyContent: 'center',
  },
  rulerFill: { height: 28, backgroundColor: '#C8E6C9', borderRadius: 14 },
  rulerThumb: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4E8A47',
    marginLeft: -14,
  },
  primaryBtn: {
    borderRadius: 999,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    maxHeight: '70%',
  },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  calCell: { width: '14.28%', paddingVertical: 10 },
  yearRow: { paddingVertical: 10, alignItems: 'center' },
  closeBtn: { alignItems: 'center', padding: 12, marginTop: 8 },
});
