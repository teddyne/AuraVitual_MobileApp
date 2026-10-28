import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { supabase } from '../../../lib/supabase';

const PRIMARY = '#4E8A47';
const TODAY_BG = '#2E7D32';
const PINK_BG = '#FCE4EC';
const PINK_TEXT = '#880E4F';
const YELLOW_DOT = '#F2C94C';
const CELL_W = 68;
const CELL_GAP = 8;
const pad = (n: number) => String(n).padStart(2, '0');
const toKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const keyToDisplay = (k: string) => {
  const [y, m, d] = k.split('-');
  return `${d}/${m}/${y}`;
};
const displayToKey = (t: string) => {
  const p = t.trim().split('/');
  if (p.length !== 3) return null;
  const d = Number(p[0]);
  const m = Number(p[1]);
  const y = Number(p[2]);
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  )
    return null;
  return toKey(date);
};
const addDaysKey = (k: string, days: number) => {
  const d = fromKey(k);
  d.setDate(d.getDate() + days);
  return toKey(d);
};
const diffDays = (aKey: string, bKey: string) =>
  Math.round((fromKey(bKey).getTime() - fromKey(aKey).getTime()) / 86400000);

type Cycle = {
  start_date: string;
  cycle_length_days: number;
  period_length_days: number;
};
type Article = {
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
};
type Flow = 'light' | 'medium' | 'heavy' | null;
type CycleLog = {
  log_date: string;
  has_period: boolean;
  flow: Flow;
  symptoms: string[];
  spotting: boolean;
};

const FLOW_OPTIONS: { value: Exclude<Flow, null>; label: string }[] = [
  { value: 'light', label: 'Ít' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'heavy', label: 'Nhiều' },
];
const SYMPTOMS = [
  { key: 'happy', label: 'Vui vẻ' },
  { key: 'tired', label: 'Mệt mỏi' },
  { key: 'bloated', label: 'Đầy hơi' },
  { key: 'pain', label: 'Đau nhẹ' },
  { key: 'cramps', label: 'Đau bụng' },
  { key: 'headache', label: 'Đau đầu' },
  { key: 'nausea', label: 'Buồn nôn' },
  { key: 'hot_flash', label: 'Bốc hỏa' },
];
const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MONTH_NAMES = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];

// Vòng tròn nhạt + icon xanh đậm, cùng kiểu với ProfileSettings/ProfileSetup.
function IconBadge({ name }: { name: any }) {
  return (
    <View style={styles.iconBadge}>
      <Ionicons name={name} size={22} color='#2E7D32' />
    </View>
  );
}

export default function CycleTrackingScreen({ navigation }: any) {
  const today = new Date();
  const todayKey = toKey(today);
  // YYYY-MM-DD đã pad 0 nên so sánh chuỗi = so sánh ngày.
  const isFutureKey = (key: string) => key > todayKey;
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [logs, setLogs] = useState<CycleLog[]>([]);

  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [stripCenterKey, setStripCenterKey] = useState(todayKey);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerYear, setPickerYear] = useState(today.getFullYear());

  const [formHasPeriod, setFormHasPeriod] = useState(false);
  const [formFlow, setFormFlow] = useState<Flow>(null);
  const [formSymptoms, setFormSymptoms] = useState<string[]>([]);
  const [formOtherSelected, setFormOtherSelected] = useState(false);
  const [formOtherText, setFormOtherText] = useState('');
  const [formSpotting, setFormSpotting] = useState<boolean | null>(null);

  const [showEdit, setShowEdit] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editLength, setEditLength] = useState('28');
  const [editPeriod, setEditPeriod] = useState('5');

  const loadStatic = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setLoading(false);
      return;
    }
    setUserId(auth.user.id);
    const cyc = await supabase
      .from('cycles')
      .select('start_date, cycle_length_days, period_length_days')
      .eq('user_id', auth.user.id)
      .order('start_date', { ascending: true });
    if (cyc.data && cyc.data.length > 0) {
      setCycles(cyc.data as Cycle[]);
      setCycle(cyc.data[cyc.data.length - 1] as Cycle);
    }
    // Kiến thức chu kỳ: lấy DANH SÁCH bài viết thật từ posts,
    // không chỉ 1 bài mới nhất, để người dùng chọn từng bài xem chi tiết.
    const post = await supabase
      .from('posts')
      .select('id, title, summary, body')
      .eq('kind', 'article')
      .order('published_at', { ascending: false })
      .limit(2);
    if (post.data) setArticles(post.data as Article[]);
    setLoading(false);
  }, []);

  const loadLogs = useCallback(async (uid: string) => {
    const res = await supabase
      .from('cycle_logs')
      .select('log_date, has_period, flow, symptoms, spotting')
      .eq('user_id', uid)
      .order('log_date', { ascending: true });
    setLogs((res.data || []) as CycleLog[]);
  }, []);

  useEffect(() => {
    loadStatic();
  }, [loadStatic]);
  useEffect(() => {
    if (userId) loadLogs(userId);
  }, [userId, loadLogs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStatic();
    if (userId) await loadLogs(userId);
    setRefreshing(false);
  };

  const logsMap = new Map(logs.map((l) => [l.log_date, l]));
  const predictedPeriod = (key: string) => {
    if (!cycle) return false;
    const diff = diffDays(cycle.start_date, key);
    if (diff < 0) return false;
    return (diff % cycle.cycle_length_days) + 1 <= cycle.period_length_days;
  };
  const isPeriodDay = (key: string) => {
    const row = logsMap.get(key);
    if (row) return row.has_period;
    return predictedPeriod(key);
  };
  const hasSymptoms = (key: string) =>
    (logsMap.get(key)?.symptoms?.length ?? 0) > 0;
  const selectedLog = logsMap.get(selectedKey);

  useEffect(() => {
    const row = logsMap.get(selectedKey);
    if (row) {
      const all = row.symptoms || [];
      const otherEntry = all.find(
        (s) => s === 'other' || s.startsWith('other:'),
      );
      setFormHasPeriod(row.has_period);
      setFormFlow(row.flow);
      setFormSymptoms(
        all.filter((s) => s !== 'other' && !s.startsWith('other:')),
      );
      setFormOtherSelected(!!otherEntry);
      setFormOtherText(
        otherEntry && otherEntry.startsWith('other:')
          ? otherEntry.slice(6)
          : '',
      );
      setFormSpotting(row.spotting);
    } else {
      setFormHasPeriod(predictedPeriod(selectedKey));
      setFormFlow(null);
      setFormSymptoms([]);
      setFormOtherSelected(false);
      setFormOtherText('');
      setFormSpotting(null);
    }
  }, [selectedKey, logs, cycle]);

  const stripDays: string[] = [];
  for (let i = -30; i <= 30; i++) stripDays.push(addDaysKey(stripCenterKey, i));
  const stripPageW = Dimensions.get('window').width - 32;
  const stripInitialOffset = Math.max(
    0,
    30 * (CELL_W + CELL_GAP) - (stripPageW / 2 - CELL_W / 2),
  );

  // Vòng tròn: tính theo chu kỳ lặp lại.
  let dayInCycle: number | null = null;
  let daysUntilNext: number | null = null;
  let phase = '';
  let fertility = '';
  let progress = 0;
  if (cycle) {
    const diff = diffDays(cycle.start_date, todayKey);
    if (diff < 0) {
      daysUntilNext = -diff;
      phase = 'Chưa tới kỳ';
      fertility = 'Chưa xác định';
    } else {
      const idx = Math.floor(diff / cycle.cycle_length_days);
      dayInCycle = (diff % cycle.cycle_length_days) + 1;
      daysUntilNext = diffDays(
        todayKey,
        addDaysKey(cycle.start_date, (idx + 1) * cycle.cycle_length_days),
      );
      progress = dayInCycle / cycle.cycle_length_days;
      const ovulation = Math.max(
        cycle.period_length_days + 1,
        cycle.cycle_length_days - 14,
      );
      if (dayInCycle <= cycle.period_length_days) {
        phase = 'Kỳ kinh';
        fertility = 'Thấp';
      } else if (dayInCycle < ovulation - 5) {
        phase = 'Pha nang noãn';
        fertility = 'Thấp';
      } else if (dayInCycle <= ovulation + 1) {
        phase = 'Rụng trứng';
        fertility = 'Cao';
      } else {
        phase = 'Pha hoàng thể';
        fertility = 'Thấp';
      }
    }
  }
  const R = 102;
  const CIRC = 2 * Math.PI * R;

  // Sai lệch chu kỳ: thực tế của một kỳ = ngày bắt đầu kỳ sau trừ ngày bắt đầu kỳ đó.
  const actualLengths: { start: string; expected: number; actual: number }[] =
    [];
  for (let i = 0; i < cycles.length - 1; i++) {
    actualLengths.push({
      start: cycles[i].start_date,
      expected: cycles[i].cycle_length_days,
      actual: diffDays(cycles[i].start_date, cycles[i + 1]!.start_date),
    });
  }
  const deviations: string[] = [];
  if (cycle) {
    const predictedNext = addDaysKey(cycle.start_date, cycle.cycle_length_days);
    const lateDays = diffDays(predictedNext, todayKey);
    if (lateDays > 0) {
      deviations.push(
        `Trễ ${lateDays} ngày so với ngày dự kiến ${keyToDisplay(predictedNext)} mà chưa có kỳ mới được ghi.`,
      );
    }
  }
  if (actualLengths.length >= 2) {
    const latest = actualLengths[actualLengths.length - 1]!;
    const prevAvg =
      actualLengths.slice(0, -1).reduce((s, x) => s + x.actual, 0) /
      (actualLengths.length - 1);
    const dev = latest.actual - prevAvg;
    if (Math.abs(dev) >= 7) {
      deviations.push(
        `Chu kỳ vừa rồi ${latest.actual} ngày, ${dev > 0 ? 'dài' : 'ngắn'} hơn trung bình các kỳ trước (${prevAvg.toFixed(1)} ngày) ${Math.abs(dev).toFixed(0)} ngày.`,
      );
    }
  }
  if (actualLengths.length >= 3) {
    const vals = actualLengths.map((x) => x.actual);
    const range = Math.max(...vals) - Math.min(...vals);
    if (range >= 10) {
      deviations.push(
        `Các chu kỳ gần đây dao động ${range} ngày (từ ${Math.min(...vals)} đến ${Math.max(...vals)} ngày), được xem là không đều.`,
      );
    }
  }

  const countPeriodDaysInMonth = (year: number, month: number) => {
    const n = new Date(year, month + 1, 0).getDate();
    let count = 0;
    for (let d = 1; d <= n; d++) {
      if (isPeriodDay(`${year}-${pad(month + 1)}-${pad(d)}`)) count++;
    }
    return count;
  };

  const pickMonth = (year: number, month: number) => {
    const first = `${year}-${pad(month + 1)}-01`;
    // Tháng tương lai: không cho chọn để ghi, giữ nguyên ngày đang chọn.
    if (isFutureKey(first)) {
      Alert.alert(
        'Tháng ở tương lai',
        'Chỉ ghi được cho hôm nay và các ngày trước đó.',
      );
      return;
    }
    setViewYear(year);
    setStripCenterKey(first);
    setSelectedKey(first);
    setViewMode('month');
    setPickerVisible(false);
  };

  const saveLog = async () => {
    // Chặn ở code, dù UI có lọt ngày tương lai thì cũng không ghi xuống DB.
    if (isFutureKey(selectedKey)) {
      Alert.alert(
        'Ngày ở tương lai',
        'Không ghi được cho ngày sau hôm nay. Chỉ ghi cho hôm nay và các ngày trước đó.',
      );
      return;
    }
    if (!userId) return;
    const finalSymptoms = [
      ...formSymptoms,
      ...(formOtherSelected
        ? [formOtherText.trim() ? `other:${formOtherText.trim()}` : 'other']
        : []),
    ];
    setSaving(true);
    const { error } = await supabase.from('cycle_logs').upsert(
      {
        user_id: userId,
        log_date: selectedKey,
        has_period: formHasPeriod,
        flow: formHasPeriod ? formFlow : null,
        symptoms: finalSymptoms,
        spotting: formSpotting ?? false,
      },
      { onConflict: 'user_id,log_date' },
    );
    setSaving(false);
    if (error) Alert.alert('Lưu thất bại', error.message);
    else {
      Alert.alert(
        'Đã lưu',
        `Đã lưu ghi nhận ngày ${keyToDisplay(selectedKey)}.`,
      );
      await loadLogs(userId);
    }
  };

  const deleteLog = () => {
    if (!userId || !selectedLog) return;
    Alert.alert(
      'Xóa ghi nhận?',
      `Xóa ghi nhận ngày ${keyToDisplay(selectedKey)}? Lịch sẽ trở về dự đoán từ chu kỳ.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            await supabase
              .from('cycle_logs')
              .delete()
              .eq('user_id', userId)
              .eq('log_date', selectedKey);
            await loadLogs(userId);
          },
        },
      ],
    );
  };

  const toggleSymptom = (key: string) => {
    setFormSymptoms((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );
  };

  const saveNewCycle = async () => {
    const startKey = displayToKey(editDate);
    const len = Number(editLength);
    const per = Number(editPeriod);
    if (!startKey) {
      Alert.alert('Ngày chưa đúng', 'Nhập ngày bắt đầu dạng DD/MM/YYYY.');
      return;
    }
    // Kỳ mới cũng không được bắt đầu ở tương lai.
    if (isFutureKey(startKey)) {
      Alert.alert('Ngày chưa đúng', 'Ngày bắt đầu kỳ không được sau hôm nay.');
      return;
    }
    if (!(len >= 20 && len <= 45)) {
      Alert.alert('Chu kỳ chưa đúng', 'DB chỉ cho phép từ 20 đến 45 ngày.');
      return;
    }
    if (!(per >= 1 && per <= 15)) {
      Alert.alert(
        'Số ngày kinh chưa đúng',
        'DB chỉ cho phép từ 1 đến 15 ngày.',
      );
      return;
    }
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase.from('cycles').insert({
      user_id: userId,
      start_date: startKey,
      cycle_length_days: len,
      period_length_days: per,
    });
    setSaving(false);
    if (error) {
      Alert.alert('Lưu thất bại', error.message);
      return;
    }
    setShowEdit(false);
    Alert.alert('Đã lưu', 'Đã ghi nhận kỳ mới, các tính toán sẽ dùng kỳ này.');
    loadStatic();
  };

  // Bấm vào bài viết: mở màn chi tiết bài viết (ArticleDetail đã có
  // trong RootNavigator từ gói Home/Explore/Workout). Nếu màn đó chưa
  // được copy vào project thì bấm sẽ không chuyển màn, lúc đó chỉ cần
  // thêm route ArticleDetail vào RootNavigator là xong, không sửa file này.
  const openArticle = (a: Article) => {
    if (navigation?.navigate) {
      navigation.navigate('ArticleDetail', { postId: a.id });
    } else {
      Alert.alert(a.title, a.summary || '');
    }
  };

  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe}>
          <ActivityIndicator
            size='large'
            color={PRIMARY}
            style={{ marginTop: 80 }}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const selectedYear = Number(selectedKey.split('-')[0]);
  const selectedMonth = Number(selectedKey.split('-')[1]) - 1;
  const isSelectedFuture = isFutureKey(selectedKey);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation?.goBack()}>
              <Ionicons name='chevron-back' size={30} color='#111111' />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Theo dõi chu kỳ & Nội tiết</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.calendarTop}>
              <IconBadge name='calendar-outline' />
              <View style={styles.modeSwitch}>
                <TouchableOpacity
                  style={[
                    styles.modeBtn,
                    viewMode === 'month' && styles.modeActive,
                  ]}
                  onPress={() => setViewMode('month')}
                >
                  <Text
                    style={[
                      styles.modeText,
                      viewMode === 'month' && styles.modeTextActive,
                    ]}
                  >
                    Lịch tháng
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modeBtn,
                    viewMode === 'year' && styles.modeActive,
                  ]}
                  onPress={() => setViewMode('year')}
                >
                  <Text
                    style={[
                      styles.modeText,
                      viewMode === 'year' && styles.modeTextActive,
                    ]}
                  >
                    Lịch năm
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {viewMode === 'month' ? (
              <>
                {/* ĐÃ BỎ 2 nút ‹ › ở đây: dải ngày bên dưới đã lướt ngang
                    được, không cần mũi tên chuyển tuần nữa. Chỉ còn nút
                    tháng/năm ở giữa để mở lịch chọn tháng. */}
                <View style={[styles.monthNav, styles.monthNavCenter]}>
                  <TouchableOpacity
                    style={styles.monthLabelBtn}
                    onPress={() => {
                      setPickerYear(selectedYear);
                      setPickerVisible(true);
                    }}
                  >
                    <Text style={styles.monthLabel}>
                      {MONTH_NAMES[selectedMonth]}, {selectedYear}
                    </Text>
                    {/* Icon V dùng Ionicons và căn giữa theo hàng, không
                        còn là ký tự V gắn cuối chữ nên không bị tuột. */}
                    <Ionicons name='chevron-down' size={18} color='#111111' />
                  </TouchableOpacity>
                </View>
                <View style={styles.stripRow}>
                  <ScrollView
                    key={stripCenterKey}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentOffset={{ x: stripInitialOffset, y: 0 }}
                    contentContainerStyle={{
                      gap: CELL_GAP,
                      paddingHorizontal: 2,
                    }}
                  >
                    {stripDays.map((key) => {
                      const d = fromKey(key);
                      const isToday = key === todayKey;
                      const isSelected = key === selectedKey;
                      const isPeriod = isPeriodDay(key);
                      const isSymptom = hasSymptoms(key);
                      const isFuture = isFutureKey(key);
                      return (
                        <TouchableOpacity
                          key={key}
                          disabled={isFuture}
                          style={[
                            styles.stripCell,
                            {
                              backgroundColor: isPeriod
                                ? PINK_BG
                                : isToday
                                  ? TODAY_BG
                                  : isSelected
                                    ? '#E8F5E9'
                                    : '#FFFFFF',
                            },
                            {
                              borderColor: isToday
                                ? TODAY_BG
                                : isSelected
                                  ? '#111111'
                                  : isPeriod
                                    ? '#F48FB1'
                                    : '#EEEEEE',
                            },
                            isFuture && { opacity: 0.45 },
                          ]}
                          onPress={() => {
                            if (isFuture) return;
                            setSelectedKey(key);
                          }}
                        >
                          <Text
                            style={[
                              styles.stripWeekday,
                              {
                                color: isFuture
                                  ? '#AAAAAA'
                                  : isToday
                                    ? '#FFFFFF'
                                    : isPeriod
                                      ? PINK_TEXT
                                      : '#888888',
                              },
                            ]}
                          >
                            {WD[d.getDay()]}
                          </Text>
                          <Text
                            style={[
                              styles.stripNum,
                              {
                                color: isFuture
                                  ? '#AAAAAA'
                                  : isToday
                                    ? '#FFFFFF'
                                    : isPeriod
                                      ? PINK_TEXT
                                      : '#111111',
                              },
                            ]}
                          >
                            {pad(d.getDate())}
                          </Text>
                          <View style={styles.dotRow}>
                            {isFuture ? (
                              <View style={styles.dotPlaceholder} />
                            ) : isToday ? (
                              <View style={styles.whiteDot} />
                            ) : isSymptom ? (
                              <View style={styles.yellowDot} />
                            ) : (
                              <View style={styles.dotPlaceholder} />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </>
            ) : (
              <>
                <View style={styles.monthNav}>
                  <TouchableOpacity onPress={() => setViewYear(viewYear - 1)}>
                    <Ionicons name='chevron-back' size={26} color='#111111' />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.monthLabelBtn}
                    onPress={() => {
                      setPickerYear(viewYear);
                      setPickerVisible(true);
                    }}
                  >
                    <Text style={styles.monthLabel}>Năm {viewYear}</Text>
                    <Ionicons name='chevron-down' size={18} color='#111111' />
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={viewYear >= today.getFullYear()}
                    onPress={() => {
                      if (viewYear < today.getFullYear())
                        setViewYear(viewYear + 1);
                    }}
                  >
                    <Ionicons
                      name='chevron-forward'
                      size={26}
                      color='#111111'
                      style={
                        viewYear >= today.getFullYear() && { opacity: 0.3 }
                      }
                    />
                  </TouchableOpacity>
                </View>
                <View style={styles.yearGrid}>
                  {MONTH_NAMES.map((name, m) => (
                    <TouchableOpacity
                      key={name}
                      style={styles.yearCell}
                      onPress={() => pickMonth(viewYear, m)}
                    >
                      <Text style={styles.yearMonth}>{name}</Text>
                      <Text style={styles.yearCount}>
                        {countPeriodDaysInMonth(viewYear, m)} ngày kinh
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>

          <View style={styles.hero}>
            {cycle ? (
              <View style={{ alignItems: 'center' }}>
                <View style={styles.heroRingWrap}>
                  <Svg width={280} height={280} viewBox='0 0 240 240'>
                    <Circle
                      cx={120}
                      cy={120}
                      r={R}
                      stroke='#F3D9D9'
                      strokeWidth={16}
                      fill='none'
                    />
                    <Circle
                      cx={120}
                      cy={120}
                      r={R}
                      stroke={PRIMARY}
                      strokeWidth={16}
                      fill='none'
                      strokeDasharray={`${progress * CIRC} ${CIRC - progress * CIRC}`}
                      transform='rotate(-90 120 120)'
                      strokeLinecap='round'
                    />
                  </Svg>
                  <View style={styles.heroCenter}>
                    <Text style={styles.heroLabel}>CHU KỲ HIỆN TẠI</Text>
                    {daysUntilNext !== null && daysUntilNext >= 0 ? (
                      <>
                        <Text style={styles.heroMain}>Kỳ sau</Text>
                        <Text style={styles.heroDays}>
                          {daysUntilNext === 0
                            ? 'Hôm nay'
                            : `${daysUntilNext} ngày`}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.heroMain}>Đã quá</Text>
                        <Text style={styles.heroDays}>
                          {daysUntilNext !== null
                            ? `${-daysUntilNext} ngày`
                            : ''}
                        </Text>
                      </>
                    )}
                    <Text style={styles.heroPhase}>● {phase}</Text>
                  </View>
                </View>
                <Text style={styles.heroSub}>
                  Khả năng thụ thai {fertility}
                  {dayInCycle !== null
                    ? ` • Ngày thứ ${dayInCycle} của chu kỳ ${cycle.cycle_length_days} ngày`
                    : ''}
                </Text>
              </View>
            ) : (
              <Text style={styles.cardText}>
                Chưa có chu kỳ nào trong bảng cycles. Bấm nút dưới để ghi kỳ đầu
                tiên.
              </Text>
            )}
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setShowEdit(!showEdit)}
            >
              <Ionicons name='calendar-outline' size={18} color='#111111' />
              <Text style={styles.editButtonText}>Chỉnh sửa ngày kỳ kinh</Text>
            </TouchableOpacity>
            {showEdit ? (
              <View style={{ width: '100%' }}>
                <Text style={styles.label}>Ngày bắt đầu kỳ (DD/MM/YYYY)</Text>
                <TextInput
                  style={styles.input}
                  value={editDate}
                  onChangeText={setEditDate}
                  placeholder='01/10/2026'
                  keyboardType='numbers-and-punctuation'
                />
                <Text style={styles.label}>Độ dài chu kỳ (ngày, 20-45)</Text>
                <TextInput
                  style={styles.input}
                  value={editLength}
                  onChangeText={setEditLength}
                  keyboardType='numeric'
                />
                <Text style={styles.label}>Số ngày kinh (1-15)</Text>
                <TextInput
                  style={styles.input}
                  value={editPeriod}
                  onChangeText={setEditPeriod}
                  keyboardType='numeric'
                />
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={saveNewCycle}
                  disabled={saving}
                >
                  <Text style={styles.saveButtonText}>
                    {saving ? 'Đang lưu...' : 'Lưu kỳ mới'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sai lệch chu kỳ</Text>
            {cycles.length < 2 ? (
              <Text style={styles.cardText}>
                Chưa đủ dữ liệu để đánh giá sai lệch. Cần ít nhất 2 kỳ đã ghi
                trong bảng cycles.
              </Text>
            ) : deviations.length === 0 ? (
              <Text style={styles.cardText}>
                Chu kỳ gần đây ổn định, sai lệch trong giới hạn (dưới 7 ngày so
                với trung bình).
              </Text>
            ) : (
              deviations.map((d, i) => (
                <View key={i} style={styles.warnRow}>
                  <Ionicons
                    name='alert-circle-outline'
                    size={18}
                    color='#B7791F'
                  />
                  <Text style={[styles.cardText, { flex: 1, marginBottom: 0 }]}>
                    {d}
                  </Text>
                </View>
              ))
            )}
            {actualLengths.slice(-4).map((x) => (
              <Text key={x.start} style={styles.cardText}>
                • Kỳ {keyToDisplay(x.start)}: thực tế {x.actual} ngày (dự kiến{' '}
                {x.expected} ngày)
              </Text>
            ))}
            <Text style={styles.cardText}>
              Đây chỉ là so sánh số liệu, không phải chẩn đoán y tế.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Ghi nhận ngày {keyToDisplay(selectedKey)}
            </Text>
            <Text style={styles.cardText}>
              {selectedLog
                ? 'Ngày này đã được lưu.'
                : isPeriodDay(selectedKey)
                  ? 'Dự đoán: Có kinh (chưa lưu).'
                  : 'Dự đoán: Không có kinh (chưa lưu).'}
            </Text>

            <Text style={styles.label}>Kỳ kinh nguyệt</Text>
            <View style={styles.twoCols}>
              <TouchableOpacity
                style={[styles.choiceBtn, formHasPeriod && styles.choicePink]}
                onPress={() => setFormHasPeriod(true)}
              >
                <Text style={styles.choiceText}>Có kinh nguyệt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.choiceBtn, !formHasPeriod && styles.choiceGreen]}
                onPress={() => {
                  setFormHasPeriod(false);
                  setFormFlow(null);
                }}
              >
                <Text style={styles.choiceText}>Không có kinh</Text>
              </TouchableOpacity>
            </View>

            {formHasPeriod ? (
              <>
                <Text style={styles.label}>Lượng kinh nguyệt</Text>
                <View style={styles.chipRow}>
                  {FLOW_OPTIONS.map((f) => (
                    <TouchableOpacity
                      key={f.value}
                      style={[
                        styles.chip,
                        formFlow === f.value && styles.chipActive,
                      ]}
                      onPress={() => setFormFlow(f.value)}
                    >
                      <Text style={styles.chipText}>{f.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}

            <Text style={styles.label}>Xuất huyết lốm đốm</Text>
            <View style={styles.twoCols}>
              <TouchableOpacity
                style={[
                  styles.choiceBtn,
                  // ĐÃ ĐỔI: chọn ở đây cũng xanh như lượng kinh nguyệt,
                  // không còn màu cam như trước.
                  formSpotting === true && styles.choiceGreen,
                ]}
                onPress={() => setFormSpotting(true)}
              >
                <Text style={styles.choiceText}>Có</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.choiceBtn,
                  formSpotting === false && styles.choiceGreen,
                ]}
                onPress={() => setFormSpotting(false)}
              >
                <Text style={styles.choiceText}>Không</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Triệu chứng (chọn nhiều)</Text>
            <View style={styles.chipRow}>
              {SYMPTOMS.map((s) => {
                const active = formSymptoms.includes(s.key);
                return (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => toggleSymptom(s.key)}
                  >
                    <Text style={styles.chipText}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.chip, formOtherSelected && styles.chipActive]}
                onPress={() => setFormOtherSelected(!formOtherSelected)}
              >
                <Text style={styles.chipText}>Khác</Text>
              </TouchableOpacity>
            </View>
            {formOtherSelected ? (
              <TextInput
                style={styles.input}
                value={formOtherText}
                onChangeText={setFormOtherText}
                placeholder='Nhập triệu chứng khác, ví dụ: Đau lưng dưới'
              />
            ) : null}

            {isSelectedFuture ? (
              <Text style={styles.futureWarning}>
                Ngày này ở tương lai, chưa ghi được. Chọn hôm nay hoặc ngày
                trước đó.
              </Text>
            ) : null}
            <TouchableOpacity
              style={[styles.saveButton, isSelectedFuture && { opacity: 0.5 }]}
              onPress={saveLog}
              disabled={saving || isSelectedFuture}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Đang lưu...' : 'Lưu ghi nhận ngày này'}
              </Text>
            </TouchableOpacity>
            {selectedLog ? (
              <TouchableOpacity style={styles.deleteButton} onPress={deleteLog}>
                <Text style={styles.deleteButtonText}>
                  Xóa ghi nhận ngày này
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <IconBadge name='leaf-outline' />
              <Text style={[styles.cardTitle, { marginBottom: 0 }]}>
                Kiến thức chu kỳ & Thể trạng
              </Text>
            </View>
            {articles.length === 0 ? (
              <Text style={styles.cardText}>
                Chưa có bài viết kind = article trong bảng posts.
              </Text>
            ) : (
              articles.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={styles.articleRow}
                  onPress={() => openArticle(a)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.articleTitle}>{a.title}</Text>
                    {a.summary ? (
                      <Text style={styles.cardText} numberOfLines={2}>
                        {a.summary}
                      </Text>
                    ) : null}
                    <Text style={styles.link}>Xem chi tiết</Text>
                  </View>
                  <Ionicons name='chevron-forward' size={20} color='#888888' />
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>

        <Modal visible={pickerVisible} transparent animationType='slide'>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.monthNav}>
                <TouchableOpacity onPress={() => setPickerYear(pickerYear - 1)}>
                  <Ionicons name='chevron-back' size={26} color='#111111' />
                </TouchableOpacity>
                <Text style={styles.monthLabel}>Năm {pickerYear}</Text>
                <TouchableOpacity
                  disabled={pickerYear >= today.getFullYear()}
                  onPress={() => {
                    if (pickerYear < today.getFullYear())
                      setPickerYear(pickerYear + 1);
                  }}
                >
                  <Ionicons
                    name='chevron-forward'
                    size={26}
                    color='#111111'
                    style={
                      pickerYear >= today.getFullYear() && { opacity: 0.3 }
                    }
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.yearGrid}>
                {MONTH_NAMES.map((name, m) => (
                  <TouchableOpacity
                    key={name}
                    style={[
                      styles.yearCell,
                      pickerYear === selectedYear &&
                        m === selectedMonth &&
                        styles.yearCellActive,
                    ]}
                    onPress={() => pickMonth(pickerYear, m)}
                  >
                    <Text
                      style={[
                        styles.yearMonth,
                        pickerYear === selectedYear &&
                          m === selectedMonth &&
                          styles.yearMonthActive,
                      ]}
                    >
                      {name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => setPickerVisible(false)}
              >
                <Text style={styles.saveButtonText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { padding: 16, paddingBottom: 32, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111111' },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EAF0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
  },
  cardText: { fontSize: 14, color: '#444444', lineHeight: 20, marginBottom: 6 },
  calendarTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#EEF1FF',
    borderRadius: 999,
    padding: 4,
    flex: 1,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
  },
  modeActive: { backgroundColor: PRIMARY },
  modeText: { color: '#333333', fontWeight: '600' },
  modeTextActive: { color: '#FFFFFF' },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  monthNavCenter: { justifyContent: 'center' },
  monthLabelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  monthLabel: { fontSize: 17, fontWeight: '700', color: '#111111' },
  stripRow: { flexDirection: 'row', alignItems: 'center' },
  stripCell: {
    width: CELL_W,
    height: 78,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  stripWeekday: { fontSize: 12, fontWeight: '700' },
  stripNum: { fontSize: 20, fontWeight: '800', marginVertical: 4 },
  dotRow: {
    flexDirection: 'row',
    gap: 4,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yellowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: YELLOW_DOT,
  },
  whiteDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  dotPlaceholder: { width: 6, height: 6 },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  yearCell: {
    width: '30%',
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  yearCellActive: { backgroundColor: PRIMARY },
  yearMonth: { fontSize: 14, fontWeight: '700', color: '#111111' },
  yearMonthActive: { color: '#FFFFFF' },
  yearCount: { fontSize: 12, color: '#666666', marginTop: 4 },
  hero: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  heroRingWrap: {
    width: 280,
    height: 280,
    position: 'relative',
    alignSelf: 'center',
  },
  heroCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  heroLabel: {
    fontSize: 12,
    color: '#B85C5C',
    fontWeight: '800',
    marginBottom: 14,
    textAlign: 'center',
  },
  heroMain: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111111',
    marginTop: 12,
    textAlign: 'center',
  },
  heroDays: {
    fontSize: 26,
    fontWeight: '800',
    color: '#8B1E1E',
    marginTop: 10,
    marginBottom: 16,
    textAlign: 'center',
  },
  heroPhase: {
    color: PRIMARY,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
  },
  heroSub: {
    textAlign: 'center',
    color: '#444444',
    marginTop: 18,
    lineHeight: 22,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF1FF',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  editButtonText: { color: '#111111', fontWeight: '700' },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333333',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#EEF1FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111111',
    marginBottom: 8,
  },
  saveButton: {
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  futureWarning: {
    color: '#B71C1C',
    fontWeight: '700',
    marginTop: 12,
    lineHeight: 20,
  },
  deleteButton: {
    backgroundColor: '#FDECEA',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  deleteButtonText: { color: '#B71C1C', fontSize: 15, fontWeight: '700' },
  twoCols: { flexDirection: 'row', gap: 10 },
  choiceBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  choicePink: {
    backgroundColor: PINK_BG,
    borderColor: '#EC407A',
    borderWidth: 2,
  },
  choiceGreen: {
    backgroundColor: '#E8F5E9',
    borderColor: PRIMARY,
    borderWidth: 2,
  },
  choiceText: { color: '#111111', fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  chipActive: {
    backgroundColor: '#E8F5E9',
    borderColor: PRIMARY,
    borderWidth: 2,
  },
  chipText: { color: '#111111', fontWeight: '600' },
  warnRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  articleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  articleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    lineHeight: 22,
    marginBottom: 6,
  },
  link: { color: PRIMARY, fontWeight: '700', marginTop: 4 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
});
