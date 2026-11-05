import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { IconBadge } from '../../../components/ui/IconBadge';
import { AppHeader } from '../../../components/ui/AppHeader';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pedometer } from 'expo-sensors';
import { supabase } from '../../../lib/supabase';
import { toKey } from '../../../utils/dates';
import { PRIMARY } from '../constants';
import { buildDaily, type Range } from '../utils/stepsFormat';
import { LAST_SYNC_KEY, loadAcc, saveAcc } from '../utils/stepsAcc';
import { StepsGauge } from '../components/StepsGauge';
import { StepsChart } from '../components/StepsChart';
import { StepsManualForm } from '../components/StepsManualForm';
import { StepsSyncCard, type SensorStatus } from '../components/StepsSyncCard';
import { styles } from './StepsDetailScreen.styles';

type Metric = {
  log_date: string;
  steps: number | null;
  steps_source?: string | null;
};
// Vòng tròn nhạt + icon xanh đậm, cùng kiểu ProfileSettings/ProfileSetup.

export default function StepsDetailScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<Range>('week');
  const [goal, setGoal] = useState(10000);
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);

  // Trạng thái cảm biến (mới).
  const [sensorStatus, setSensorStatus] = useState<SensorStatus>('checking');
  const [sensorToday, setSensorToday] = useState<number | null>(null);
  const [manualToday, setManualToday] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [sensorNote, setSensorNote] = useState<string | null>(null);
  const [sensorReady, setSensorReady] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [savingManual, setSavingManual] = useState(false);

  const lastUpsertRef = useRef<{ steps: number; at: number }>({
    steps: -1,
    at: 0,
  });
  const dbTodayRef = useRef<{ steps: number; source: string | null }>({
    steps: 0,
    source: null,
  });
  const sensorTodayRef = useRef<number | null>(null);
  useEffect(() => {
    sensorTodayRef.current = sensorToday;
  }, [sensorToday]);

  const loadAll = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const uid = auth.user.id;
      const prof = await supabase
        .from('profiles')
        .select('step_goal, height_cm, weight_kg')
        .eq('id', uid)
        .maybeSingle();
      if (prof.data) {
        if (prof.data.step_goal) setGoal(Number(prof.data.step_goal));
        if (prof.data.height_cm) setHeightCm(Number(prof.data.height_cm));
        if (prof.data.weight_kg) setWeightKg(Number(prof.data.weight_kg));
      }
      const from = new Date();
      from.setDate(from.getDate() - 29);
      const res = await supabase
        .from('health_metrics')
        .select('log_date, steps, steps_source')
        .eq('user_id', uid)
        .gte('log_date', toKey(from))
        .order('log_date', { ascending: true });
      const rows = (res.data || []) as Metric[];
      setMetrics(rows);
      const key = toKey(new Date());
      const todayRow = rows.find((m) => m.log_date === key);
      dbTodayRef.current = {
        steps: todayRow ? Number(todayRow.steps || 0) : 0,
        source: todayRow?.steps_source ?? null,
      };
      setManualToday(todayRow?.steps_source === 'manual');
      const ls = await AsyncStorage.getItem(LAST_SYNC_KEY);
      if (ls) setLastSyncAt(ls);
    } catch {
      // Giữ số cũ, không kẹt màn hình ở loading.
    } finally {
      setLoading(false);
    }
  }, []);

  // Upsert bước chân tự động. Thử đủ cột trước (kèm steps_synced_at), nếu
  // DB chưa có cột đó thì tự rơi về bản không có cột đó, chứ không vỡ màn.
  // Không bao giờ tự ghi đè ngày đã nhập tay, trừ khi gọi với force = true
  // (nút "Dùng lại đếm tự động" do chính người dùng bấm).
  const upsertTodaySteps = useCallback(
    async (
      uid: string,
      dateKey: string,
      steps: number,
      opts: { force?: boolean; skipManualCheck?: boolean } = {},
    ): Promise<'ok' | 'manual' | 'error'> => {
      if (!opts.force && !opts.skipManualCheck) {
        const row = await supabase
          .from('health_metrics')
          .select('steps_source')
          .eq('user_id', uid)
          .eq('log_date', dateKey)
          .maybeSingle();
        if (row.data?.steps_source === 'manual') return 'manual';
      }
      const base = {
        user_id: uid,
        log_date: dateKey,
        steps: Math.round(steps),
        steps_source: 'auto',
      };
      const attempts = [
        { ...base, steps_synced_at: new Date().toISOString() },
        { ...base },
        { user_id: uid, log_date: dateKey, steps: Math.round(steps) },
      ];
      for (const payload of attempts) {
        const { error } = await supabase
          .from('health_metrics')
          .upsert(payload, { onConflict: 'user_id,log_date' });
        if (!error) return 'ok';
        const msg = `${error.code || ''} ${error.message || ''}`;
        // Chỉ thử bản rút gọn khi lỗi đúng là thiếu cột; lỗi khác (RLS,
        // CHECK 0–100.000...) thì dừng ngay, không ghi bừa.
        if (!msg.includes('steps_synced_at') && error.code !== '42703') {
          return 'error';
        }
      }
      return 'error';
    },
    [],
  );
  const upsertRef = useRef(upsertTodaySteps);
  upsertRef.current = upsertTodaySteps;

  const markSynced = useCallback(async () => {
    const iso = new Date().toISOString();
    setLastSyncAt(iso);
    try {
      await AsyncStorage.setItem(LAST_SYNC_KEY, iso);
    } catch {
      // Không chặn gì.
    }
  }, []);

  // Đẩy lên Supabase có tiết chế: lần đầu đẩy ngay, sau đó chỉ đẩy khi đã
  // qua 60 giây hoặc số thay đổi từ 100 bước trở lên. Màn hình vẫn cập nhật
  // trực tiếp qua sensorToday, không chờ lần đẩy này.
  const throttledUpsert = useCallback(
    async (steps: number) => {
      const now = Date.now();
      const last = lastUpsertRef.current;
      if (steps === last.steps) return;
      if (now - last.at < 60000 && Math.abs(steps - last.steps) < 100) return;
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;
        const r = await upsertTodaySteps(
          auth.user.id,
          toKey(new Date()),
          steps,
          {},
        );
        if (r === 'ok') {
          lastUpsertRef.current = { steps, at: now };
          await markSynced();
        } else if (r === 'manual') {
          setManualToday(true);
          setSensorStatus('manual');
        }
      } catch {
        // Giữ số trên màn hình, lần đồng bộ sau thử lại.
      }
    },
    [upsertTodaySteps, markSynced],
  );

  // iOS: watchStepCount chỉ báo số bước từ lúc bắt đầu đăng ký, KHÔNG phải
  // tổng hôm nay, nên mỗi lần nó báo là truy vấn lại tổng từ 0 giờ tới giờ.
  // Cách này lấy đủ bước cả khi app đã đóng, vì hệ điều hành vẫn đếm.
  const refreshTodayIOS = useCallback(async () => {
    try {
      const db = dbTodayRef.current;
      if (db.source === 'manual') {
        setManualToday(true);
        setSensorStatus('manual');
        return;
      }
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const res = await Pedometer.getStepCountAsync(start, new Date());
      const cand = Math.round(res.steps);
      if (cand < 0 || cand > 100000) return;
      const eff = db.source === 'auto' ? Math.max(cand, db.steps) : cand;
      setSensorToday(eff);
      await throttledUpsert(eff);
    } catch {
      // Lỗi truy vấn lẻ không xóa số đang hiện.
    }
  }, [throttledUpsert]);

  // Android: watchStepCount trả về tổng tích lũy từ lúc khởi động lại máy.
  // Cộng delta từng lần nhận; giá trị tụt xuống nghĩa là máy vừa khởi động
  // lại thì cộng lại từ đầu. Qua ngày mới: chỉ cộng dồn tiếp khi ngày cũ
  // đúng là hôm qua; để qua nhiều ngày không mở app thì reset để khỏi cộng
  // dồn mấy ngày vào một ngày.
  const handleAndroidUpdate = useCallback(
    async (cumulative: number) => {
      try {
        const today = toKey(new Date());
        const y = new Date();
        y.setDate(y.getDate() - 1);
        const yesterday = toKey(y);
        const acc = await loadAcc();
        let total: number;
        if (!acc) {
          total = 0;
          await saveAcc({ date: today, total: 0, lastSeen: cumulative });
        } else if (acc.date === today) {
          total =
            cumulative >= acc.lastSeen
              ? acc.total + (cumulative - acc.lastSeen)
              : acc.total + cumulative;
          await saveAcc({ date: today, total, lastSeen: cumulative });
        } else if (acc.date === yesterday) {
          total =
            cumulative >= acc.lastSeen ? cumulative - acc.lastSeen : cumulative;
          await saveAcc({ date: today, total, lastSeen: cumulative });
        } else {
          total = 0;
          await saveAcc({ date: today, total: 0, lastSeen: cumulative });
        }
        const db = dbTodayRef.current;
        if (db.source === 'manual') {
          setManualToday(true);
          setSensorStatus('manual');
          return;
        }
        // Lấy max với số auto đã lưu để không tụt số khi AsyncStorage mất
        // (ví dụ xóa dữ liệu app), rồi seed lại bộ tích lũy cho đúng mốc.
        const eff = db.source === 'auto' ? Math.max(total, db.steps) : total;
        if (eff !== total) {
          await saveAcc({ date: today, total: eff, lastSeen: cumulative });
        }
        setSensorToday(eff);
        await throttledUpsert(eff);
      } catch {
        // Lỗi lẻ không xóa số đang hiện.
      }
    },
    [throttledUpsert],
  );

  // iOS: lấp 6 ngày trước (không tạo dòng 0 cho ngày chưa có, không ghi đè
  // ngày nhập tay, không hạ số auto đã cao hơn). Ngày xa hơn 7 ngày thì hệ
  // điều hành không còn dữ liệu nên biểu đồ tháng vẫn giữ số DB cũ.
  const backfillWeekIOS = useCallback(
    async (uid: string) => {
      for (let ago = 1; ago <= 6; ago++) {
        try {
          const day = new Date();
          day.setDate(day.getDate() - ago);
          const start = new Date(day);
          start.setHours(0, 0, 0, 0);
          const end = new Date(day);
          end.setHours(23, 59, 59, 999);
          const res = await Pedometer.getStepCountAsync(start, end);
          const steps = Math.round(res.steps);
          if (steps < 0 || steps > 100000) continue;
          const key = toKey(day);
          const row = await supabase
            .from('health_metrics')
            .select('steps, steps_source')
            .eq('user_id', uid)
            .eq('log_date', key)
            .maybeSingle();
          if (row.data?.steps_source === 'manual') continue;
          const old = row.data ? Number(row.data.steps || 0) : 0;
          if (row.data && row.data.steps_source === 'auto' && old >= steps) {
            continue;
          }
          if (!row.data && steps === 0) continue;
          await upsertTodaySteps(uid, key, steps, { skipManualCheck: true });
        } catch {
          // Ngày nào lỗi thì bỏ qua ngày đó, các ngày khác vẫn lấp.
        }
      }
    },
    [upsertTodaySteps],
  );

  const syncSensor = useCallback(
    async (force = false): Promise<boolean> => {
      setSyncing(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) {
          setSensorStatus('error');
          return false;
        }
        const uid = auth.user.id;
        const today = toKey(new Date());
        const available = await Pedometer.isAvailableAsync().catch(() => false);
        if (!available) {
          setSensorStatus('unsupported');
          setSensorNote(
            'Điện thoại này không có cảm biến bước chân (thường gặp trên máy ảo). Dùng ô nhập tay bên dưới, số đó vẫn lưu vào DB bình thường.',
          );
          return false;
        }
        let perm = await Pedometer.getPermissionsAsync();
        if (!perm.granted) perm = await Pedometer.requestPermissionsAsync();
        if (!perm.granted) {
          setSensorStatus('denied');
          setSensorNote(
            'App chưa được cấp quyền chuyển động nên chưa đọc được cảm biến. Bấm "Cấp quyền lại", hoặc dùng ô nhập tay bên dưới.',
          );
          return false;
        }
        setSensorReady(true);
        setSensorNote(null);

        const row = await supabase
          .from('health_metrics')
          .select('steps, steps_source')
          .eq('user_id', uid)
          .eq('log_date', today)
          .maybeSingle();
        const dbSteps = row.data ? Number(row.data.steps || 0) : 0;
        const dbSource = row.data?.steps_source ?? null;
        if (!force && dbSource === 'manual') {
          setManualToday(true);
          setSensorStatus('manual');
          setSensorNote(
            'Hôm nay đang dùng số nhập tay nên đồng bộ tự động không ghi đè. Muốn quay lại đếm tự động thì bấm nút bên dưới.',
          );
          return false;
        }

        let candidate: number;
        if (Platform.OS === 'ios') {
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          const res = await Pedometer.getStepCountAsync(start, new Date());
          candidate = Math.round(res.steps);
        } else {
          // Android: số hôm nay tính từ bộ tích lũy, seed bằng số auto đã
          // lưu trong DB để lần watch sau cộng tiếp đúng mốc.
          const acc = await loadAcc();
          let total = dbSource === 'auto' ? dbSteps : 0;
          if (acc && acc.date === today) {
            total = Math.max(acc.total, total);
            await saveAcc({ date: today, total, lastSeen: acc.lastSeen });
          }
          candidate = total;
        }
        // Không tự cắt ngọn cho đẹp số: ngoài khoảng 0–100.000 thì giữ số cũ.
        if (
          !Number.isFinite(candidate) ||
          candidate < 0 ||
          candidate > 100000
        ) {
          setSensorStatus('error');
          setSensorNote(
            'Số cảm biến ngoài khoảng 0–100.000 nên app giữ số cũ, không ghi đè.',
          );
          return false;
        }
        const effective =
          dbSource === 'auto' ? Math.max(candidate, dbSteps) : candidate;
        setSensorToday(effective);
        setManualToday(false);
        const up = await upsertTodaySteps(uid, today, effective, {
          force,
          skipManualCheck: true,
        });
        if (up === 'ok') {
          await markSynced();
        } else if (up === 'error') {
          setSensorNote(
            'Đã đọc được cảm biến nhưng chưa lưu lên Supabase, thử kéo làm mới lại.',
          );
        }
        setSensorStatus('available');
        if (Platform.OS === 'ios') {
          await backfillWeekIOS(uid);
        }
        await loadAll();
        return true;
      } catch {
        setSensorStatus('error');
        setSensorNote(
          'Không đọc được cảm biến lúc này, số đang hiện là số đã lưu trong DB.',
        );
        return false;
      } finally {
        setSyncing(false);
      }
    },
    [loadAll, upsertTodaySteps, backfillWeekIOS, markSynced],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      await loadAll();
      if (alive) await syncSensor(false);
    })();
    return () => {
      alive = false;
    };
  }, [loadAll, syncSensor]);

  // Đăng ký watch khi đã có quyền. Chỉ chạy khi màn này đang mở.
  useEffect(() => {
    if (!sensorReady) return;
    let sub: { remove: () => void } | null = null;
    (async () => {
      try {
        if (Platform.OS === 'ios') {
          sub = Pedometer.watchStepCount(() => {
            void refreshTodayIOS();
          });
        } else {
          sub = Pedometer.watchStepCount((result) => {
            void handleAndroidUpdate(result.steps);
          });
        }
      } catch {
        // Không có cảm biến thì trạng thái đã báo ở syncSensor.
      }
    })();
    return () => {
      sub?.remove();
      // Rời màn: đẩy nốt số mới nhất, không để mất bước vừa đi.
      const latest = sensorTodayRef.current;
      if (latest != null) {
        supabase.auth
          .getUser()
          .then(({ data }) => {
            if (data.user) {
              void upsertRef.current(
                data.user.id,
                toKey(new Date()),
                latest,
                {},
              );
            }
          })
          .catch(() => {});
      }
    };
  }, [sensorReady, refreshTodayIOS, handleAndroidUpdate]);

  // Về foreground là đồng bộ lại (bắt bước đã đi lúc app đóng, trên iOS).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncSensor(false);
    });
    return () => sub.remove();
  }, [syncSensor]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await syncSensor(false);
      await loadAll();
    } finally {
      setRefreshing(false);
    }
  };

  const saveManual = async () => {
    const v = parseInt(manualInput.replace(/\D/g, ''), 10);
    if (!Number.isFinite(v) || v < 0 || v > 100000) {
      setSensorNote('Nhập số bước từ 0 tới 100.000.');
      return;
    }
    setSavingManual(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const uid = auth.user.id;
      const key = toKey(new Date());
      const { error } = await supabase
        .from('health_metrics')
        .upsert(
          { user_id: uid, log_date: key, steps: v, steps_source: 'manual' },
          { onConflict: 'user_id,log_date' },
        );
      if (error) {
        const r2 = await supabase
          .from('health_metrics')
          .upsert(
            { user_id: uid, log_date: key, steps: v },
            { onConflict: 'user_id,log_date' },
          );
        if (r2.error) throw r2.error;
      }
      setManualInput('');
      setSensorToday(null);
      setManualToday(true);
      setSensorStatus('manual');
      await loadAll();
    } catch {
      setSensorNote('Lưu số nhập tay thất bại, thử lại.');
    } finally {
      setSavingManual(false);
    }
  };

  // Số hiển thị hôm nay ưu tiên cảm biến, trừ ngày đã nhập tay.
  const dbMap = new Map(metrics.map((m) => [m.log_date, Number(m.steps || 0)]));
  const displayMap = new Map(dbMap);
  if (sensorToday != null && !manualToday) {
    displayMap.set(toKey(new Date()), sensorToday);
  }
  const todayKey = toKey(new Date());
  const todaySteps = displayMap.get(todayKey) || 0;
  const percent = goal > 0 ? Math.min(todaySteps / goal, 1) : 0;

  // ƯỚC TÍNH, không phải số đo từ cảm biến:
  // sải chân trung bình ~ 0,413 x chiều cao; kcal đi bộ ~ 0,75 kcal/kg/km;
  // phút vận động ~ bước / 100 bước mỗi phút ở tốc độ đi bộ vừa.
  const strideM = heightCm ? (heightCm * 0.413) / 100 : 0.75;
  const distanceKm = (todaySteps * strideM) / 1000;
  const kcal = weightKg ? distanceKm * weightKg * 0.75 : todaySteps * 0.04;
  const activeMin = Math.round(todaySteps / 100);

  const chartData =
    range === 'today'
      ? [{ label: 'Hôm nay', steps: todaySteps }]
      : range === 'week'
        ? buildDaily(displayMap, 7)
        : buildDaily(displayMap, 30);
  const chartSum = chartData.reduce((s, x) => s + x.steps, 0);
  const chartAvg =
    range === 'today' ? todaySteps : Math.round(chartSum / chartData.length);

  const statusText =
    sensorStatus === 'checking'
      ? 'Đang kiểm tra cảm biến…'
      : sensorStatus === 'available'
        ? 'Đang đếm từ cảm biến điện thoại'
        : sensorStatus === 'denied'
          ? 'Chưa được cấp quyền chuyển động'
          : sensorStatus === 'unsupported'
            ? 'Điện thoại này không có cảm biến bước chân'
            : sensorStatus === 'manual'
              ? 'Hôm nay đang dùng số nhập tay'
              : 'Không đọc được cảm biến lúc này';
  const platformNote =
    Platform.OS === 'ios'
      ? 'iOS: Hệ điều hành đếm cả khi app đóng, mở app là lấy đủ từ 0 giờ.'
      : Platform.OS === 'android'
        ? 'Android: Số chỉ cập nhật khi app đang mở hoặc vừa mở lại, không đếm nền đầy đủ như iOS.'
        : '';
  const showManualForm =
    sensorStatus === 'denied' ||
    sensorStatus === 'unsupported' ||
    sensorStatus === 'error' ||
    manualToday;

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

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <AppHeader title='Theo dõi bước chân chi tiết' withTopInset={false} />
        </View>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >

          <View style={styles.liveRow}>
            <View
              style={[
                styles.liveDot,
                sensorStatus !== 'available' && { backgroundColor: '#999' },
              ]}
            />
            <Text style={styles.live}>
              {sensorStatus === 'available' ? 'TRỰC TIẾP HÔM NAY' : 'HÔM NAY'}
            </Text>
          </View>

          <StepsSyncCard
            statusText={statusText}
            lastSyncAt={lastSyncAt}
            sensorNote={sensorNote}
            platformNote={platformNote}
            sensorStatus={sensorStatus}
            syncing={syncing}
            manualToday={manualToday}
            onSync={(force) => void syncSensor(force)}
          />

          {showManualForm ? (
            <StepsManualForm
              manualInput={manualInput}
              onChangeText={setManualInput}
              savingManual={savingManual}
              onSave={saveManual}
            />
          ) : null}

          <StepsGauge todaySteps={todaySteps} goal={goal} percent={percent} />

          <View style={styles.row3}>
            <View style={styles.mini}>
              <IconBadge name='flame-outline' />
              <Text style={styles.miniNum}>{Math.round(kcal)}</Text>
              <Text style={styles.miniLabel}>kcal tiêu thụ (ước tính)</Text>
            </View>
            <View style={styles.mini}>
              <IconBadge name='location-outline' />
              <Text style={styles.miniNum}>{distanceKm.toFixed(1)}</Text>
              <Text style={styles.miniLabel}>km quãng đường (ước tính)</Text>
            </View>
            <View style={styles.mini}>
              <IconBadge name='time-outline' />
              <Text style={styles.miniNum}>{activeMin}</Text>
              <Text style={styles.miniLabel}>phút vận động (ước tính)</Text>
            </View>
          </View>

          <StepsChart
            chartData={chartData}
            range={range}
            onRangeChange={setRange}
            chartAvg={chartAvg}
            todaySteps={todaySteps}
            goal={goal}
          />
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

