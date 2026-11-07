import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
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
import { supabase } from '../../../api/supabase';
import { getPostsByTopic } from '../../../api/auravitalApi';
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
  MONTH_NAMES_EN,
  PRIMARY,
  SYMPTOMS,
} from '../constants';
import { useSettings } from '../../../context/SettingsContext';
import type { Article, Cycle, CycleLog, Flow } from '../types';
import {
  computeActualLengths,
  computeCycleStatus,
  computeDeviations,
  countPeriodDaysInMonth,
  predictedPeriod,
} from '../../../utils/cycle/cycleCalc';
import { CycleDayStrip } from '../../../components/cycle/CycleDayStrip';
import { ArticleCard } from '../../../components/explore/ArticleCard';
import { CycleHeroRing } from '../../../components/cycle/CycleHeroRing';
import { CycleMonthPicker } from '../../../components/cycle/CycleMonthPicker';
import { styles } from './CycleTrackingScreen.styles';

// Vòng tròn nhạt + icon xanh đậm, cùng kiểu với ProfileSettings/ProfileSetup.

export default function CycleTrackingScreen({ navigation }: any) {
  const { t, locale } = useSettings();
  // Dự phòng khi key i18n mới (keys-groupC-v2.json) chưa được gộp vào
  // translations: hiện thẳng chữ vi/en thay vì hiện tên key.
  const tr = (key: string, vi: string, en: string) => {
    try {
      const v = t(key);
      if (v && v !== key) return v;
    } catch {}
    return locale === 'en' ? en : vi;
  };
  const monthNames = locale === 'en' ? MONTH_NAMES_EN : MONTH_NAMES;
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
    // Nhóm C (item 11b) — Kiến thức chu kỳ: chỉ bài viết topic='cycle',
    // tối đa 2 bài như trước. Nếu DB chưa có bài nào đúng topic thì
    // danh sách rỗng và màn hình hiện "Chưa có bài viết", KHÔNG
    // fallback sang article chung. Lỗi (vd chưa chạy migration topic)
    // cũng cho danh sách rỗng thay vì kẹt màn hình loading.
    try {
      const list = await getPostsByTopic('cycle', 2);
      setArticles(list as Article[]);
    } catch {
      setArticles([]);
    }
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
      Alert.alert(t('cycle.futureMonthTitle'), t('cycle.futureMonthDesc'));
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
      Alert.alert(t('cycle.futureDayTitle'), t('cycle.futureDayDesc'));
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
    if (error) Alert.alert(t('cycle.saveFailed'), error.message);
    else {
      Alert.alert(
        t('cycle.saved'),
        t('cycle.savedLogDesc', { date: keyToDisplay(selectedKey) }),
      );
      await loadLogs(userId);
    }
  };

  const deleteLog = () => {
    if (!userId || !selectedLog) return;
    Alert.alert(
      t('cycle.deleteConfirmTitle'),
      t('cycle.deleteConfirmDesc', { date: keyToDisplay(selectedKey) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
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
      Alert.alert(t('cycle.invalidDateTitle'), t('cycle.invalidDateDesc'));
      return;
    }
    // Kỳ mới cũng không được bắt đầu ở tương lai.
    if (isFutureKey(startKey)) {
      Alert.alert(t('cycle.invalidDateTitle'), t('cycle.startDateFutureDesc'));
      return;
    }
    if (!(len >= 20 && len <= 45)) {
      Alert.alert(t('cycle.invalidLengthTitle'), t('cycle.invalidLengthDesc'));
      return;
    }
    if (!(per >= 1 && per <= 15)) {
      Alert.alert(t('cycle.invalidPeriodTitle'), t('cycle.invalidPeriodDesc'));
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
      Alert.alert(t('cycle.saveFailed'), error.message);
      return;
    }
    setShowEdit(false);
    Alert.alert(t('cycle.saved'), t('cycle.savedNewCycleDesc'));
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
          <AppHeader title={t('cycle.title')} withTopInset={false} />
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
                    {t('cycle.monthView')}
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
                    {t('cycle.yearView')}
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
                      {monthNames[selectedMonth]}, {selectedYear}
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
                    <Text style={styles.monthLabel}>
                      {t('cycle.yearLabel', { year: viewYear })}
                    </Text>
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
                  {monthNames.map((name, m) => (
                    <TouchableOpacity
                      key={name}
                      style={styles.yearCell}
                      onPress={() => pickMonth(viewYear, m)}
                    >
                      <Text style={styles.yearMonth}>{name}</Text>
                      <Text style={styles.yearCount}>
                        {t('cycle.periodDaysInMonth', {
                          count: countPeriodDaysInMonth(
                            viewYear,
                            m,
                            isPeriodDay,
                          ),
                        })}
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
                  {t('cycle.fertilityLabel', { fertility })}
                  {dayInCycle !== null
                    ? t('cycle.dayOfCycle', {
                        day: dayInCycle,
                        len: cycle.cycle_length_days,
                      })
                    : ''}
                </Text>
              </View>
            ) : (
              <Text style={styles.cardText}>{t('cycle.noCycle')}</Text>
            )}
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setShowEdit(!showEdit)}
            >
              <Ionicons name='calendar-outline' size={18} color='#111111' />
              <Text style={styles.editButtonText}>
                {t('cycle.editPeriodStart')}
              </Text>
            </TouchableOpacity>
            {showEdit ? (
              <View style={{ width: '100%' }}>
                <Text style={styles.label}>{t('cycle.startDate')}</Text>
                <TouchableOpacity
                  style={[styles.input, { justifyContent: 'center' }]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={{ color: editDate ? '#111111' : '#999999' }}>
                    {editDate || t('cycle.pickStartDate')}
                  </Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <>
                    <DateTimePicker
                      value={editDateObj}
                      mode='date'
                      display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                      maximumDate={today}
                      neutralButton={{ label: t('cycle.clearDate') }}
                      onValueChange={(_e, d) => {
                        if (d) {
                          setEditDate(keyToDisplay(toKey(d)));
                          // Android: lịch là hộp thoại, chọn xong tự đóng.
                          // iOS: spinner hiện inline nên giữ lại để chọn
                          // tiếp, bấm "Đóng" bên dưới mới ẩn.
                          if (Platform.OS !== 'ios') setShowDatePicker(false);
                        }
                      }}
                      onDismiss={() => setShowDatePicker(false)}
                      onNeutralButtonPress={() => {
                        setEditDate('');
                        setShowDatePicker(false);
                      }}
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity
                        style={styles.saveButton}
                        onPress={() => setShowDatePicker(false)}
                      >
                        <Text style={styles.saveButtonText}>
                          {t('common.close')}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
                <Text style={styles.label}>{t('cycle.cycleLength')}</Text>
                <TextInput
                  style={styles.input}
                  value={editLength}
                  onChangeText={setEditLength}
                  keyboardType='numeric'
                />
                <Text style={styles.label}>{t('cycle.periodLength')}</Text>
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
                    {saving ? t('cycle.saving') : t('cycle.saveNewCycle')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('cycle.deviationsTitle')}</Text>
            {cycles.length < 2 ? (
              <Text style={styles.cardText}>{t('cycle.deviationsNoData')}</Text>
            ) : deviations.length === 0 ? (
              <Text style={styles.cardText}>{t('cycle.deviationsStable')}</Text>
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
                {t('cycle.actualLength', {
                  date: keyToDisplay(x.start),
                  actual: x.actual,
                  expected: x.expected,
                })}
              </Text>
            ))}
            <Text style={styles.cardText}>{t('cycle.notMedicalAdvice')}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {t('cycle.logDay', { date: keyToDisplay(selectedKey) })}
            </Text>
            <Text style={styles.cardText}>
              {selectedLog
                ? t('cycle.daySaved')
                : isPeriodDay(selectedKey)
                  ? t('cycle.predictedPeriod')
                  : t('cycle.predictedNoPeriod')}
            </Text>

            <Text style={styles.label}>{t('cycle.periodLabel')}</Text>
            <View style={styles.twoCols}>
              <TouchableOpacity
                style={[styles.choiceBtn, formHasPeriod && styles.choicePink]}
                onPress={() => setFormHasPeriod(true)}
              >
                <Text style={styles.choiceText}>{t('cycle.hasPeriod')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.choiceBtn, !formHasPeriod && styles.choiceGreen]}
                onPress={() => {
                  setFormHasPeriod(false);
                  setFormFlow(null);
                }}
              >
                <Text style={styles.choiceText}>{t('cycle.noPeriod')}</Text>
              </TouchableOpacity>
            </View>

            {formHasPeriod ? (
              <>
                <Text style={styles.label}>{t('cycle.flowLabel')}</Text>
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
                      <Text style={styles.chipText}>{t(f.labelKey)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}

            <Text style={styles.label}>{t('cycle.spottingLabel')}</Text>
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
                <Text style={styles.choiceText}>{t('common.yes')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.choiceBtn,
                  formSpotting === false && styles.choiceGreen,
                ]}
                onPress={() => setFormSpotting(false)}
              >
                <Text style={styles.choiceText}>{t('common.no')}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>{t('cycle.symptomsLabel')}</Text>
            <View style={styles.chipRow}>
              {SYMPTOMS.map((s) => {
                const active = formSymptoms.includes(s.key);
                return (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => toggleSymptom(s.key)}
                  >
                    <Text style={styles.chipText}>{t(s.labelKey)}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.chip, formOtherSelected && styles.chipActive]}
                onPress={() => setFormOtherSelected(!formOtherSelected)}
              >
                <Text style={styles.chipText}>{t('cycle.other')}</Text>
              </TouchableOpacity>
            </View>
            {formOtherSelected ? (
              <TextInput
                style={styles.input}
                value={formOtherText}
                onChangeText={setFormOtherText}
                placeholder={t('cycle.otherPlaceholder')}
              />
            ) : null}

            {isSelectedFuture ? (
              <Text style={styles.futureWarning}>
                {t('cycle.futureWarning')}
              </Text>
            ) : null}
            <TouchableOpacity
              style={[styles.saveButton, isSelectedFuture && { opacity: 0.5 }]}
              onPress={saveLog}
              disabled={saving || isSelectedFuture}
            >
              <Text style={styles.saveButtonText}>
                {saving ? t('cycle.saving') : t('cycle.saveLog')}
              </Text>
            </TouchableOpacity>
            {selectedLog ? (
              <TouchableOpacity style={styles.deleteButton} onPress={deleteLog}>
                <Text style={styles.deleteButtonText}>
                  {t('cycle.deleteLog')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <IconBadge name='leaf-outline' />
              <Text style={[styles.cardTitle, { marginBottom: 0 }]}>
                {t('cycle.knowledgeTitle')}
              </Text>
            </View>
            {articles.length === 0 ? (
              <Text style={styles.cardText}>
                {tr(
                  'cycle.noCycleArticles',
                  'Chưa có bài viết về chu kỳ.',
                  'No cycle articles yet.',
                )}
              </Text>
            ) : (
              // Nhóm B (v4): render bài bằng ArticleCard chuẩn dùng chung
              // (có ảnh cover ở đầu thẻ) thay cho hàng bài cũ không ảnh.
              // Tiêu đề section, empty state và openArticle giữ nguyên.
              articles.map((a) => (
                <ArticleCard
                  key={a.id}
                  post={a}
                  onOpen={() => openArticle(a)}
                />
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
