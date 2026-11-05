import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { IconBadge } from '../../../components/ui/IconBadge';
import { AppHeader } from '../../../components/ui/AppHeader';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../../../lib/supabase';
import {
  addDaysKey,
  displayToKey,
  keyToDisplay,
  pad,
  toKey,
} from '../../../utils/dates';
import {
  CELL_GAP,
  CELL_W,
  FLOW_OPTIONS,
  MONTH_NAMES,
  PRIMARY,
  SYMPTOMS,
} from '../constants';
import type { Article, Cycle, CycleLog, Flow } from '../types';
import {
  computeActualLengths,
  computeCycleStatus,
  computeDeviations,
  countPeriodDaysInMonth,
  predictedPeriod,
} from '../utils/cycleCalc';
import { CycleDayStrip } from '../components/CycleDayStrip';
import { CycleHeroRing } from '../components/CycleHeroRing';
import { CycleMonthPicker } from '../components/CycleMonthPicker';
import { styles } from './CycleTrackingScreen.styles';

// Vòng tròn nhạt + icon xanh đậm, cùng kiểu với ProfileSettings/ProfileSetup.

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
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Ngày cho DateTimePicker: từ editDate (DD/MM/YYYY), sai thì lấy hôm nay.
  const editDateObj = (() => {
    const k = displayToKey(editDate);
    if (!k) return today;
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d);
  })();
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
  const isPeriodDay = (key: string) => {
    const row = logsMap.get(key);
    if (row) return row.has_period;
    return predictedPeriod(cycle, key);
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
      setFormHasPeriod(predictedPeriod(cycle, selectedKey));
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
  const { dayInCycle, daysUntilNext, phase, fertility, progress } =
    computeCycleStatus(cycle, todayKey);

  // Sai lệch chu kỳ: thực tế của một kỳ = ngày bắt đầu kỳ sau trừ ngày bắt đầu kỳ đó.
  const actualLengths = computeActualLengths(cycles);
  const deviations = computeDeviations(cycle, actualLengths, todayKey);

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
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <AppHeader title='Theo dõi chu kỳ & Nội tiết' withTopInset={false} />
        </View>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >

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
                <CycleDayStrip
                  stripDays={stripDays}
                  stripCenterKey={stripCenterKey}
                  stripInitialOffset={stripInitialOffset}
                  todayKey={todayKey}
                  selectedKey={selectedKey}
                  isPeriodDay={isPeriodDay}
                  hasSymptoms={hasSymptoms}
                  isFutureKey={isFutureKey}
                  onSelect={setSelectedKey}
                />
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
                        {countPeriodDaysInMonth(viewYear, m, isPeriodDay)} ngày kinh
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
                <CycleHeroRing
                  progress={progress}
                  daysUntilNext={daysUntilNext}
                  phase={phase}
                />
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
                <Text style={styles.label}>Ngày bắt đầu kỳ</Text>
                <TouchableOpacity
                  style={[styles.input, { justifyContent: 'center' }]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={{ color: editDate ? '#111111' : '#999999' }}>
                    {editDate || 'Chọn ngày bắt đầu kỳ'}
                  </Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={editDateObj}
                    mode='date'
                    display='calendar'
                    maximumDate={today}
                    onChange={(_e, d) => {
                      setShowDatePicker(false);
                      if (d) {
                        setEditDate(
                          keyToDisplay(
                            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
                          ),
                        );
                      }
                    }}
                  />
                )}
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

        <CycleMonthPicker
          visible={pickerVisible}
          pickerYear={pickerYear}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          todayYear={today.getFullYear()}
          onYearChange={setPickerYear}
          onPickMonth={pickMonth}
          onClose={() => setPickerVisible(false)}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

