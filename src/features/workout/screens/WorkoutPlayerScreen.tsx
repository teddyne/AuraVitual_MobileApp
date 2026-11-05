// =====================================================================
// AuraVital — WorkoutPlayerScreen.tsx (Trình phát bài tập)
// Route params: { postId: string }.
// Cần cài: npx expo install expo-video expo-keep-awake
// =====================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, RefreshControl, ScrollView, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { getPostById, getWorkoutSteps, levelLabel, type Post, type WorkoutStep } from '../../../lib/workoutApi';
import { VideoPlayer } from '../components/VideoPlayer';
import { fmtClock } from '../utils/workoutFormat';
import { styles } from './WorkoutPlayerScreen.styles';

export default function WorkoutPlayerScreen() {
  useKeepAwake();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const postId: string = route.params?.postId;
  const [post, setPost] = useState<Post | null>(null);
  const [steps, setSteps] = useState<WorkoutStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Một mốc thời gian duy nhất (giây từ đầu bài) thay cho 2 state
  // bước + giây-trong-bước: tránh việc cập nhật lồng nhau trong updater
  // của setState, vốn có thể nhảy bước khi StrictMode gọi updater 2 lần.
  const [elapsedTotal, setElapsedTotal] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tải lại khi kéo refresh (không reset bộ đếm đang chạy).
  const load = useCallback(async () => {
    try {
      if (!postId) throw new Error('Thiếu postId.');
      const [p, s] = await Promise.all([getPostById(postId), getWorkoutSteps(postId)]);
      if (!p) throw new Error('Không tìm thấy bài tập này trong database.');
      setPost(p);
      setSteps(s);
    } catch (e: any) {
      setError(e?.message ?? 'Không tải được bài tập.');
    } finally {
      setLoading(false);
    }
  }, [postId]);
  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const totalSec = useMemo(() => steps.reduce((sum, s) => sum + (s.duration_sec || 0), 0), [steps]);

  // Bước hiện tại suy ra từ elapsedTotal, không lưu state riêng.
  const stepIdx = useMemo(() => {
    if (steps.length === 0) return 0;
    let acc = 0;
    for (let i = 0; i < steps.length; i++) {
      acc += steps[i].duration_sec || 0;
      if (elapsedTotal < acc) return i;
    }
    return steps.length - 1;
  }, [steps, elapsedTotal]);

  useEffect(() => {
    if (!playing || finished || steps.length === 0) return;
    timerRef.current = setInterval(() => {
      setElapsedTotal((prev) => {
        if (prev + 1 >= totalSec) {
          setFinished(true);
          setPlaying(false);
          return totalSec;
        }
        return prev + 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, finished, steps, totalSec]);

  const seek = (delta: number) => {
    if (steps.length === 0) return;
    setElapsedTotal((prev) => Math.max(0, Math.min(totalSec, prev + delta)));
  };

  const goToStep = (idx: number) => {
    if (idx > stepIdx && !finished) {
      Alert.alert('Chưa mở', 'Hoàn thành bước trước rồi mới mở bước này.');
      return;
    }
    let start = 0;
    for (let i = 0; i < idx && i < steps.length; i++) start += steps[i].duration_sec || 0;
    setElapsedTotal(start);
    setFinished(false);
  };

  const finishMinutes = totalSec > 0 ? Math.max(1, Math.round(totalSec / 60)) : post?.duration_min ?? 15;

  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.center, { backgroundColor: '#fff' }]}>
          <ActivityIndicator size="large" color="#2E7D32" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }
  if (error || !post) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.center, { backgroundColor: '#fff' }]}>
          <Text style={styles.error}>{error || 'Không có bài tập.'}</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const curStep = steps[stepIdx];
  const progressPct = totalSec > 0 ? (elapsedTotal / totalSec) * 100 : 0;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
    <View style={{ paddingHorizontal: 16 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color="#1B2A1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trình phát bài tập</Text>
      </View>
    </View>
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >

      {post.video_url ? (
        <View style={styles.videoWrap}>
          <VideoPlayer uri={post.video_url} />
          <Text style={styles.videoNote}>Video mẫu</Text>
        </View>
      ) : post.cover_url && !imgError ? (
        <Image source={{ uri: post.cover_url }} style={styles.cover} onError={() => setImgError(true)} />
      ) : (
        <View style={[styles.cover, { backgroundColor: '#2E7D32', justifyContent: 'center', alignItems: 'center' }]}>
          <Ionicons name="fitness" size={64} color="#fff" />
        </View>
      )}

      {/* Thanh tiến trình của bộ đếm bước tập */}
      <View style={styles.playerBar}>
        <TouchableOpacity style={styles.seekBtn} onPress={() => seek(-10)}>
          <Text style={styles.seekText}>↺ 10</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bigPlay}
          onPress={() => {
            if (finished) {
              setElapsedTotal(0);
              setFinished(false);
              setPlaying(true);
            } else {
              setPlaying((v) => !v);
            }
          }}
        >
          <Ionicons name={playing ? 'pause' : 'play'} size={28} color="#fff" style={{ marginLeft: playing ? 0 : 3 }} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.seekBtn} onPress={() => seek(10)}>
          <Text style={styles.seekText}>10 ↻</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{fmtClock(elapsedTotal)}</Text>
        <Text style={styles.timeText}>{fmtClock(totalSec)}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.min(100, progressPct)}%` }]} />
      </View>
      {curStep && !finished && (
        <Text style={styles.nowPlaying}>Đang phát: {curStep.title}</Text>
      )}
      {finished && <Text style={styles.nowPlaying}>✓ Hoàn thành chuỗi động tác!</Text>}

      <Text style={styles.title}>{post.title}</Text>
      {post.summary ? <Text style={styles.summary}>{post.summary}</Text> : null}

      <View style={styles.infoGrid}>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>THỜI LƯỢNG</Text>
          <Text style={styles.infoValue}>{post.duration_min ?? '—'} Phút</Text>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>ĐỐT CHÁY</Text>
          <Text style={styles.infoValue}>{post.kcal_estimate != null ? `${post.kcal_estimate} Kcal` : 'Chưa có'}</Text>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>CẤP ĐỘ</Text>
          <Text style={styles.infoValue}>{levelLabel(post.level)}</Text>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>SỐ ĐỘNG TÁC</Text>
          <Text style={styles.infoValue}>{steps.length} động tác</Text>
        </View>
      </View>

      <View style={styles.stepsHead}>
        <Text style={styles.h2}>Chuỗi động tác</Text>
        <Text style={styles.stepsTotal}>{steps.length} động tác ({fmtClock(totalSec)})</Text>
      </View>
      {steps.length === 0 && (
        <Text style={styles.empty}>Bài này chưa có bước tập trong bảng workout_steps. Vẫn ghi nhận được theo thời lượng chuẩn của bài.</Text>
      )}
      {steps.map((s, idx) => {
        const isCurrent = idx === stepIdx && !finished;
        const isDone = finished || idx < stepIdx;
        return (
          <TouchableOpacity
            key={s.id}
            style={[styles.stepRow, isCurrent && styles.stepCurrent]}
            onPress={() => goToStep(idx)}
          >
            <View style={[styles.stepPlay, isCurrent && styles.stepPlayActive]}>
              {isDone && !isCurrent ? (
                <Ionicons name="checkmark" size={18} color="#2E7D32" />
              ) : isCurrent ? (
                <Ionicons name={playing ? 'pause' : 'play'} size={18} color="#fff" />
              ) : (
                <Ionicons name="lock-closed" size={16} color="#8A968E" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>
                {idx + 1}. {s.title}
              </Text>
              <Text style={styles.stepSub}>
                {s.instruction ?? ''} · {fmtClock(s.duration_sec)}
                {isCurrent ? ' (Đang phát)' : ''}
              </Text>
            </View>
            <Text style={styles.stepNum}>{String(idx + 1).padStart(2, '0')}</Text>
          </TouchableOpacity>
        );
      })}

      {/* <Text style={styles.keepAwake}>Màn hình luôn sáng tự động (Keep Screen On)</Text> */}
      <TouchableOpacity
        style={styles.startBtn}
        onPress={() => {
          if (finished || steps.length === 0) {
            navigation.navigate('WorkoutLog', { postId: post.id, minutes: finishMinutes });
          } else {
            setPlaying(true);
          }
        }}
      >
        <Text style={styles.startText}>
          {finished || steps.length === 0 ? '✓ Hoàn thành & Ghi nhận' : '▶ Bắt đầu luyện tập ngay'}
        </Text>
      </TouchableOpacity>
      {steps.length > 0 && !finished && (
        <TouchableOpacity
          style={styles.logLink}
          onPress={() => navigation.navigate('WorkoutLog', { postId: post.id, minutes: post.duration_min ?? finishMinutes })}
        >
          <Text style={styles.logLinkText}>Hoặc ghi nhận ngay mà không cần tập hết →</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
