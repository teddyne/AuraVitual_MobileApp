// =====================================================================
// AuraVital — WorkoutLogScreen.tsx (Ghi nhận tập luyện)
// Đặt tại: src/features/workout/screens/WorkoutLogScreen.tsx
// Route params (đều không bắt buộc):
//   { postId?: string, minutes?: number }
// Luồng giống "thêm bữa ăn" nhưng cho tập luyện:
//   chọn bài (từ DB) -> sửa số phút theo đúng mình đã tập ->
//   kcal tự tính theo tỉ lệ -> lưu -> danh sách ngày đó hiện ra,
//   bấm Sửa để đổi phút, bấm Xóa để bỏ dòng đó.
// Quy tắc 1 bài / 1 ngày chỉ 1 dòng (UNIQUE v6): lưu lại cùng bài
// cùng ngày sẽ GHI ĐÈ số phút cũ, không tạo dòng trùng.
// =====================================================================
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import {
  calcKcal, deleteWorkoutLog, getWeeklySummary, getWorkoutLogsForDate,
  getWorkouts, saveWorkoutLog, updateWorkoutLogMinutes,
  type Post, type WorkoutLog,
} from '../../../lib/workoutApi';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function displayDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}
function fmtHM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return h > 0 ? `${h}h ${m}ph` : `${m}ph`;
}

export default function WorkoutLogScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth() as { user: { id: string } | null };
  const [workouts, setWorkouts] = useState<Post[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [date, setDate] = useState<string>(todayStr());
  const [selectedId, setSelectedId] = useState<string | null>(route.params?.postId ?? null);
  const [minutesText, setMinutesText] = useState<string>(
    route.params?.minutes != null ? String(route.params.minutes) : '',
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const selected = workouts.find((w) => w.id === selectedId) ?? null;
  const minutes = parseInt(minutesText, 10);
  const minutesValid = Number.isInteger(minutes) && minutes >= 1 && minutes <= 480;
  const kcalPreview = selected && minutesValid ? calcKcal(selected, minutes) : 0;

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [w, l, s] = await Promise.all([
        getWorkouts(),
        getWorkoutLogsForDate(user.id, date),
        getWeeklySummary(user.id, date, null),
      ]);
      setWorkouts(w);
      setLogs(l);
      setWeekMinutes(s.workoutMinutes);
      if (selectedId && !minutesText) {
        const pre = w.find((x) => x.id === selectedId);
        if (pre?.duration_min) setMinutesText(String(pre.duration_min));
      }
    } catch (e: any) {
      setError(e?.message ?? 'Không tải được dữ liệu.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, date]); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useEffect(() => {
    setLoading(true);
    load();
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickWorkout = (w: Post) => {
    setSelectedId(w.id);
    setEditingId(null);
    if (w.duration_min) setMinutesText(String(w.duration_min));
  };

  const startEdit = (log: WorkoutLog) => {
    setEditingId(log.id);
    setSelectedId(log.post_id);
    setMinutesText(String(log.minutes));
  };

  const onSave = async () => {
    if (!user?.id) {
      Alert.alert('Chưa đăng nhập', 'Đăng nhập rồi mới ghi nhận được.');
      return;
    }
    if (!selected) {
      Alert.alert('Chưa chọn bài tập', 'Chọn 1 bài tập trong danh sách bên dưới.');
      return;
    }
    if (!minutesValid) {
      Alert.alert('Số phút chưa đúng', 'Nhập số phút từ 1 đến 480.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateWorkoutLogMinutes(editingId, selected, minutes);
      } else {
        await saveWorkoutLog(user.id, selected, date, minutes);
      }
      setEditingId(null);
      await load();
      Alert.alert('Đã lưu', editingId ? 'Đã cập nhật số phút.' : 'Đã ghi nhận buổi tập.');
    } catch (e: any) {
      Alert.alert('Không lưu được', e?.message ?? 'Thử lại sau.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (log: WorkoutLog) => {
    Alert.alert('Xóa buổi tập này?', `${log.post?.title ?? 'Bài tập'} · ${log.minutes} phút`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWorkoutLog(log.id);
            await load();
          } catch (e: any) {
            Alert.alert('Không xóa được', e?.message ?? 'Thử lại sau.');
          }
        },
      },
    ]);
  };

  const changeDate = (delta: number) => {
    const next = addDays(date, delta);
    if (next > todayStr()) {
      Alert.alert('Ngày tương lai', 'Không ghi nhận cho ngày chưa tới.');
      return;
    }
    setDate(next);
    setEditingId(null);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading && workouts.length === 0) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.center, { backgroundColor: '#F9FBF9' }]}>
          <ActivityIndicator size="large" color="#2E7D32" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FBF9' }}>
        <View style={{ flex: 1 }}>
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Quay lại</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ghi nhận tập luyện</Text>
        <View style={{ width: 60 }} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.dateRow}>
        <TouchableOpacity style={styles.dateBtn} onPress={() => changeDate(-1)}>
          <Text style={styles.dateBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.dateText}>{displayDate(date)}{date === todayStr() ? ' (Hôm nay)' : ''}</Text>
        <TouchableOpacity style={styles.dateBtn} onPress={() => changeDate(1)}>
          <Text style={styles.dateBtnText}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.totalBox}>
        <Text style={styles.totalLabel}>Tổng tuần kết thúc ngày {displayDate(date)}</Text>
        <Text style={styles.totalBig}>{fmtHM(weekMinutes)}</Text>
        <Text style={styles.totalSub}>Ngày {displayDate(date)}: {logs.reduce((s, l) => s + l.minutes, 0)} phút · {logs.reduce((s, l) => s + l.kcal, 0)} kcal ước lượng</Text>
      </View>

      <Text style={styles.h2}>Chọn bài tập</Text>
      {workouts.length === 0 && <Text style={styles.empty}>Chưa có bài tập trong database. Chạy seed v6 rồi tải lại.</Text>}
      {workouts.map((w) => (
        <TouchableOpacity
          key={w.id}
          style={[styles.workRow, selectedId === w.id && styles.workRowActive]}
          onPress={() => pickWorkout(w)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.workTitle}>{w.title}</Text>
            <Text style={styles.workSub}>
              {w.duration_min ?? '—'} phút chuẩn{w.kcal_estimate != null ? ` · ${w.kcal_estimate} kcal/buổi` : ''}
            </Text>
          </View>
          {selectedId === w.id && <Text style={styles.check}>✓</Text>}
        </TouchableOpacity>
      ))}

      <Text style={styles.h2}>{editingId ? 'Sửa số phút đã tập' : 'Số phút bạn đã tập'}</Text>
      <TextInput
        style={styles.input}
        value={minutesText}
        onChangeText={setMinutesText}
        keyboardType="number-pad"
        placeholder="Ví dụ: 20"
        placeholderTextColor="#9AA59E"
      />
      {!minutesValid && minutesText !== '' && (
        <Text style={styles.error}>Số phút phải từ 1 đến 480.</Text>
      )}
      <Text style={styles.kcalLine}>
        Kcal ước lượng: {selected ? `${kcalPreview} kcal` : '—'} (tính theo tỉ lệ với buổi chuẩn)
      </Text>
      <TouchableOpacity style={styles.saveBtn} onPress={onSave} disabled={saving}>
        <Text style={styles.saveText}>{saving ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Lưu buổi tập'}</Text>
      </TouchableOpacity>
      {editingId && (
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => {
            setEditingId(null);
            setMinutesText(selected?.duration_min ? String(selected.duration_min) : '');
          }}
        >
          <Text style={styles.cancelText}>Hủy sửa</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.h2}>Buổi tập ngày {displayDate(date)}</Text>
      {logs.length === 0 && <Text style={styles.empty}>Chưa ghi nhận buổi nào trong ngày này.</Text>}
      {logs.map((log) => (
        <View key={log.id} style={styles.logRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.workTitle}>{log.post?.title ?? 'Bài tập'}</Text>
            <Text style={styles.workSub}>{log.minutes} phút · {log.kcal} kcal ước lượng</Text>
          </View>
          <TouchableOpacity onPress={() => startEdit(log)}>
            <Text style={styles.action}>Sửa</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(log)}>
            <Text style={[styles.action, { color: '#B23A3A' }]}>Xóa</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddWorkout')}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#F9FBF9', paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  back: { fontSize: 15, color: '#2E7D32', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1B2A1E' },
  error: { color: '#B23A3A', fontSize: 14, marginTop: 10 },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
  dateBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  dateBtnText: { fontSize: 20, color: '#2E7D32' },
  dateText: { fontSize: 18, fontWeight: '800', color: '#1B2A1E' },
  totalBox: { backgroundColor: '#EAF6EC', borderRadius: 20, padding: 16, marginTop: 14 },
  totalLabel: { fontSize: 13, color: '#5B665E' },
  totalBig: { fontSize: 28, fontWeight: '800', color: '#1B2A1E', marginTop: 4 },
  totalSub: { fontSize: 14, color: '#3D4A41', marginTop: 4 },
  h2: { fontSize: 17, fontWeight: '800', color: '#1B2A1E', marginTop: 22, marginBottom: 10 },
  empty: { fontSize: 14, color: '#6B7A6E' },
  workRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#EEE' },
  workRowActive: { borderColor: '#2E7D32', backgroundColor: '#EAF6EC' },
  workTitle: { fontSize: 15, fontWeight: '700', color: '#1B2A1E' },
  workSub: { fontSize: 13, color: '#5B665E', marginTop: 3 },
  check: { fontSize: 20, color: '#2E7D32', fontWeight: '800' },
  input: { backgroundColor: '#fff', borderRadius: 14, padding: 14, fontSize: 18, color: '#1B2A1E' },
  kcalLine: { fontSize: 14, color: '#5B665E', marginTop: 8 },
  saveBtn: { backgroundColor: '#2E7D32', borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', marginTop: 10 },
  cancelText: { color: '#6B7A6E', fontWeight: '700' },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8 },
  action: { fontSize: 14, fontWeight: '700', color: '#2E7D32' },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});
