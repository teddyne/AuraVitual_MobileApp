import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Dimensions,
  Platform,
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
import Svg, { Circle, Line, Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pedometer } from 'expo-sensors';
import { supabase } from '../../../lib/supabase';

const PRIMARY = '#4E8A47';
const SAGE = '#8FBF9A';
const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const ACC_KEY = '@auravital:steps_acc';
const LAST_SYNC_KEY = '@auravital:steps_last_sync';
const pad = (n: number) => String(n).padStart(2, '0');
const toKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const fmt = (n: number) =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const formatSyncTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};

type Metric = {
  log_date: string;
  steps: number | null;
  steps_source?: string | null;
};
type Range = 'today' | 'week' | 'month';
type SensorStatus =
  'checking' | 'available' | 'denied' | 'unsupported' | 'manual' | 'error';
// Bộ tích lũy Android: cảm biến Android trả về tổng tích lũy từ lúc khởi
// động lại máy, không phải tổng của hôm nay, nên phải tự cộng delta và chỉ
// lưu cục bộ trên máy này (không đưa lên Supabase).
type AccState = { date: string; total: number; lastSeen: number };

async function loadAcc(): Promise<AccState | null> {
  try {
    const raw = await AsyncStorage.getItem(ACC_KEY);
    return raw ? (JSON.parse(raw) as AccState) : null;
  } catch {
    return null;
  }
}

async function saveAcc(acc: AccState) {
  try {
    await AsyncStorage.setItem(ACC_KEY, JSON.stringify(acc));
  } catch {
    // Mất bộ tích lũy chỉ làm sai số Android trong ngày, không chặn màn hình.
  }
}

function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
  }
  return d;
}

// Vòng tròn nhạt + icon xanh đậm, cùng kiểu ProfileSettings/ProfileSetup.
function IconBadge({ name }: { name: any }) {
  return (
    <View style={styles.iconBadge}>
      <Ionicons name={name} size={22} color='#2E7D32' />
    </View>
  );
}

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

  const buildDaily = (days: number) => {
    const out: { label: string; steps: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      out.push({ label: WD[d.getDay()], steps: displayMap.get(toKey(d)) || 0 });
    }
    return out;
  };
  const chartData =
    range === 'today'
      ? [{ label: 'Hôm nay', steps: todaySteps }]
      : range === 'week'
        ? buildDaily(7)
        : buildDaily(30);
  const chartSum = chartData.reduce((s, x) => s + x.steps, 0);
  const chartAvg =
    range === 'today' ? todaySteps : Math.round(chartSum / chartData.length);

  // Vòng gauge 3/4: cung 270 độ, hở 90 độ ở phía dưới.
  const R = 82;
  const C = 2 * Math.PI * R;
  const arc = 0.75 * C;

  // Biểu đồ đường trơn
  const chartW = Dimensions.get('window').width - 64;
  const chartH = 160;
  const maxY = Math.max(...chartData.map((x) => x.steps), goal, 1000) * 1.15;
  const pts = chartData.map((x, i) => ({
    x:
      chartData.length === 1
        ? chartW / 2
        : 10 + (i * (chartW - 20)) / (chartData.length - 1),
    y: chartH - 20 - (x.steps / maxY) * (chartH - 40),
  }));
  const goalY = chartH - 20 - (goal / maxY) * (chartH - 40);

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
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation?.goBack()}>
              <Ionicons
                name='chevron-back'
                size={30}
                color='#111'
                style={{ marginRight: 12 }}
              />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Theo dõi bước chân chi tiết</Text>
          </View>

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

          <View style={styles.syncCard}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              <IconBadge name='walk-outline' />
              <Text style={[styles.syncTitle, { flex: 1 }]}>{statusText}</Text>
            </View>
            <Text style={styles.syncText}>
              {lastSyncAt
                ? `Đồng bộ lần cuối: ${formatSyncTime(lastSyncAt)}`
                : 'Chưa đồng bộ lần nào từ cảm biến.'}
            </Text>
            {sensorNote ? (
              <Text style={styles.syncText}>{sensorNote}</Text>
            ) : null}
            {sensorStatus === 'available' && platformNote ? (
              <Text style={styles.syncText}>{platformNote}</Text>
            ) : null}
            <View style={styles.syncRow}>
              <TouchableOpacity
                style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
                onPress={() => void syncSensor(false)}
                disabled={syncing}
              >
                <Text style={styles.syncBtnText}>
                  {syncing ? 'Đang đồng bộ…' : 'Đồng bộ lại'}
                </Text>
              </TouchableOpacity>
              {sensorStatus === 'denied' ? (
                <TouchableOpacity
                  style={styles.syncBtn}
                  onPress={() => void syncSensor(false)}
                >
                  <Text style={styles.syncBtnText}>Cấp quyền lại</Text>
                </TouchableOpacity>
              ) : null}
              {manualToday ? (
                <TouchableOpacity
                  style={styles.syncBtn}
                  onPress={() => void syncSensor(true)}
                >
                  <Text style={styles.syncBtnText}>Dùng lại đếm tự động</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {showManualForm ? (
            <View style={styles.manualCard}>
              <Text style={styles.cardTitle}>Nhập tay số bước hôm nay</Text>
              <Text style={styles.cardText}>
                Dùng khi điện thoại không có cảm biến, chưa cấp quyền, hoặc bạn
                muốn sửa số hôm nay. Số nhập tay sẽ không bị đồng bộ tự động ghi
                đè trong ngày hôm nay.
              </Text>
              <View style={styles.manualRow}>
                <TextInput
                  style={styles.manualInput}
                  value={manualInput}
                  onChangeText={setManualInput}
                  keyboardType='number-pad'
                  placeholder='Ví dụ: 6500'
                  placeholderTextColor='#999'
                />
                <TouchableOpacity
                  style={styles.manualBtn}
                  onPress={saveManual}
                  disabled={savingManual}
                >
                  <Text style={styles.manualBtnText}>
                    {savingManual ? 'Đang lưu…' : 'Lưu'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={{ alignItems: 'center' }}>
              <Svg width={230} height={230} viewBox='0 0 200 200'>
                <Circle
                  cx={100}
                  cy={100}
                  r={R}
                  stroke='#E3EBE6'
                  strokeWidth={16}
                  fill='none'
                  strokeDasharray={`${arc} ${C - arc}`}
                  transform='rotate(135 100 100)'
                  strokeLinecap='round'
                />
                <Circle
                  cx={100}
                  cy={100}
                  r={R}
                  stroke={PRIMARY}
                  strokeWidth={16}
                  fill='none'
                  strokeDasharray={`${percent * arc} ${C - percent * arc}`}
                  transform='rotate(135 100 100)'
                  strokeLinecap='round'
                />
              </Svg>
              <View style={styles.gaugeCenter}>
                <Text style={styles.gaugeNumber}>{fmt(todaySteps)}</Text>
                <Text style={styles.gaugeSub}>Bước / mục tiêu {fmt(goal)}</Text>
              </View>
            </View>
            <View style={styles.banner}>
              <Ionicons name='trophy-outline' size={18} color={PRIMARY} />
              <Text style={styles.bannerText}>
                {percent >= 1
                  ? 'Bạn đã đạt mục tiêu hôm nay!'
                  : `Bạn đã đạt ${Math.round(percent * 100)}% mục tiêu hôm nay!`}
              </Text>
            </View>
          </View>

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

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Xu hướng vận động</Text>
            <Text style={styles.cardText}>
              {range === 'today'
                ? `Hôm nay: ${fmt(todaySteps)} bước`
                : `Trung bình ${fmt(chartAvg)} bước/ngày (${chartData.length} ngày, ngày chưa ghi tính là 0)`}
            </Text>
            <View style={styles.switchRow}>
              {(['today', 'week', 'month'] as Range[]).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.switchBtn, range === r && styles.switchActive]}
                  onPress={() => setRange(r)}
                >
                  <Text
                    style={[
                      styles.switchText,
                      range === r && styles.switchTextActive,
                    ]}
                  >
                    {r === 'today'
                      ? 'Hôm nay'
                      : r === 'week'
                        ? 'Tuần'
                        : 'Tháng'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Svg width={chartW} height={chartH}>
              <Line
                x1={0}
                y1={goalY}
                x2={chartW}
                y2={goalY}
                stroke={SAGE}
                strokeWidth={1}
                strokeDasharray='6 6'
              />
              <Path
                d={smoothPath(pts)}
                stroke={PRIMARY}
                strokeWidth={2.5}
                fill='none'
              />
              {pts.map((p, i) => (
                <Circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={4}
                  fill={PRIMARY}
                  stroke='#fff'
                  strokeWidth={1.5}
                />
              ))}
            </Svg>
            <View style={styles.xLabels}>
              {chartData.map((x, i) => (
                <Text key={i} style={styles.xLabel}>
                  {range === 'month'
                    ? i % 5 === 0 || i === chartData.length - 1
                      ? x.label
                      : ''
                    : x.label}
                </Text>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9F9FF' },
  scroll: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EAF0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  live: { color: PRIMARY, fontWeight: '700', fontSize: 12 },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PRIMARY,
  },
  syncCard: {
    backgroundColor: '#EAF5EC',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  syncTitle: { fontSize: 14, fontWeight: '700', color: PRIMARY },
  syncText: { fontSize: 12, color: '#444', marginTop: 4, lineHeight: 17 },
  syncRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  syncBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  syncBtnDisabled: { opacity: 0.6 },
  syncBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  manualCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  manualRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  manualInput: {
    flex: 1,
    backgroundColor: '#EEF1FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111',
  },
  manualBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  manualBtnText: { color: '#fff', fontWeight: '700' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  gaugeCenter: { position: 'absolute', top: 88, alignItems: 'center' },
  gaugeNumber: { fontSize: 30, fontWeight: '800', color: '#111' },
  gaugeSub: { fontSize: 12, color: '#666', textAlign: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EAF5EC',
    padding: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  bannerText: { color: PRIMARY, fontWeight: '700' },
  row3: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  mini: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
  },
  miniNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    marginVertical: 4,
  },
  miniLabel: { fontSize: 11, color: '#666', textAlign: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  cardText: { fontSize: 13, color: '#666', marginVertical: 6 },
  switchRow: {
    flexDirection: 'row',
    backgroundColor: '#EEF1FF',
    borderRadius: 999,
    padding: 4,
    marginBottom: 12,
  },
  switchBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
  },
  switchActive: { backgroundColor: PRIMARY },
  switchText: { color: '#333', fontWeight: '600' },
  switchTextActive: { color: '#fff' },
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  xLabel: { fontSize: 11, color: '#666', flex: 1, textAlign: 'center' },
});
