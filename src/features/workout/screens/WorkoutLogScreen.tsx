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
  ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../../components/ui/AppHeader';
import { useAuth } from '../../auth/AuthContext';
import {
  calcKcal, deleteWorkoutLog, getWeeklySummary, getWorkoutLogsForDate,
  getWorkouts, saveWorkoutLog, updateWorkoutLogMinutes,
  type Post, type WorkoutLog,
} from '../../../api/workoutApi';
import { toKey } from '../../../utils/dates';
import { displayDate, fmtHM } from '../../../utils/workout/workoutFormat';
import { useSettings } from '../../../context/SettingsContext';
import { styles } from './WorkoutLogScreen.styles';

// CO TINH DE NGUYEN TAI CHO, khong thay bang addDays trong
// src/utils/dates.ts: ham do nhan Date, ham nay nhan chuoi ISO
// 'YYYY-MM-DD' (chu ky khac nhau).
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function WorkoutLogScreen() {
  const { t } = useSettings();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth() as { user: { id: string } | null };
  const [workouts, setWorkouts] = useState<Post[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [date, setDate] = useState<string>(toKey(new Date()));
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
      setError(e?.message ?? t('common.loadFailed'));
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
      Alert.alert(t('workout.log.notLoggedInTitle'), t('workout.log.notLoggedInBody'));
      return;
    }
    if (!selected) {
      Alert.alert(t('workout.log.noWorkoutTitle'), t('workout.log.noWorkoutBody'));
      return;
    }
    if (!minutesValid) {
      Alert.alert(t('workout.log.invalidMinutesTitle'), t('workout.log.invalidMinutesBody'));
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
      Alert.alert(t('workout.log.savedTitle'), editingId ? t('workout.log.savedUpdated') : t('workout.log.savedLogged'));
    } catch (e: any) {
      Alert.alert(t('workout.log.saveFailedTitle'), e?.message ?? t('common.tryAgainLater'));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (log: WorkoutLog) => {
    Alert.alert(t('workout.log.deleteConfirmTitle'), t('workout.log.deleteConfirmBody', { title: log.post?.title ?? t('home.workout'), min: log.minutes }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWorkoutLog(log.id);
            await load();
          } catch (e: any) {
            Alert.alert(t('workout.log.deleteFailedTitle'), e?.message ?? t('common.tryAgainLater'));
          }
        },
      },
    ]);
  };

  const changeDate = (delta: number) => {
    const next = addDays(date, delta);
    if (next > toKey(new Date())) {
      Alert.alert(t('workout.log.futureDateTitle'), t('workout.log.futureDateBody'));
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
    <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
      <AppHeader title={t('workout.log.title')} withTopInset={false} />
    </View>
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.dateRow}>
        <TouchableOpacity style={styles.dateBtn} onPress={() => changeDate(-1)}>
          <Text style={styles.dateBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.dateText}>{displayDate(date)}{date === toKey(new Date()) ? ` (${t('home.today')})` : ''}</Text>
        <TouchableOpacity style={styles.dateBtn} onPress={() => changeDate(1)}>
          <Text style={styles.dateBtnText}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.totalBox}>
        <Text style={styles.totalLabel}>{t('workout.log.weekTotalEnding', { date: displayDate(date) })}</Text>
        <Text style={styles.totalBig}>{fmtHM(weekMinutes)}</Text>
        <Text style={styles.totalSub}>{t('workout.log.daySummary', { date: displayDate(date), minutes: logs.reduce((s, l) => s + l.minutes, 0), kcal: logs.reduce((s, l) => s + l.kcal, 0) })}</Text>
      </View>

      <Text style={styles.h2}>{t('workout.log.chooseWorkout')}</Text>
      {workouts.length === 0 && <Text style={styles.empty}>{t('workout.log.noWorkoutsDb')}</Text>}
      {workouts.map((w) => (
        <TouchableOpacity
          key={w.id}
          style={[styles.workRow, selectedId === w.id && styles.workRowActive]}
          onPress={() => pickWorkout(w)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.workTitle}>{w.title}</Text>
            <Text style={styles.workSub}>
              {t('workout.log.standardDuration', { min: w.duration_min ?? '—' })}{w.kcal_estimate != null ? ` · ${t('workout.log.kcalPerSession', { kcal: w.kcal_estimate })}` : ''}
            </Text>
          </View>
          {selectedId === w.id && <Text style={styles.check}>✓</Text>}
        </TouchableOpacity>
      ))}

      <Text style={styles.h2}>{editingId ? t('workout.log.editMinutes') : t('workout.log.enterMinutes')}</Text>
      <TextInput
        style={styles.input}
        value={minutesText}
        onChangeText={setMinutesText}
        keyboardType="number-pad"
        placeholder={t('workout.log.minutesPlaceholder')}
        placeholderTextColor="#9AA59E"
      />
      {!minutesValid && minutesText !== '' && (
        <Text style={styles.error}>{t('workout.log.minutesRangeError')}</Text>
      )}
      <Text style={styles.kcalLine}>
        {t('workout.log.kcalEstimate', { value: selected ? t('workout.log.kcalValue', { kcal: kcalPreview }) : '—' })}
      </Text>
      <TouchableOpacity style={styles.saveBtn} onPress={onSave} disabled={saving}>
        <Text style={styles.saveText}>{saving ? t('common.saving') : editingId ? t('workout.log.update') : t('workout.log.saveSession')}</Text>
      </TouchableOpacity>
      {editingId && (
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => {
            setEditingId(null);
            setMinutesText(selected?.duration_min ? String(selected.duration_min) : '');
          }}
        >
          <Text style={styles.cancelText}>{t('workout.log.cancelEdit')}</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.h2}>{t('workout.log.sessionsOnDate', { date: displayDate(date) })}</Text>
      {logs.length === 0 && <Text style={styles.empty}>{t('workout.log.noSessions')}</Text>}
      {logs.map((log) => (
        <View key={log.id} style={styles.logRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.workTitle}>{log.post?.title ?? t('home.workout')}</Text>
            <Text style={styles.workSub}>{t('workout.log.sessionSummary', { min: log.minutes, kcal: log.kcal })}</Text>
          </View>
          <TouchableOpacity onPress={() => startEdit(log)}>
            <Text style={styles.action}>{t('common.edit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(log)}>
            <Text style={[styles.action, { color: '#B23A3A' }]}>{t('common.delete')}</Text>
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
