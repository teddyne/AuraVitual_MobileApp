// =====================================================================
// AuraVital — WorkoutPlayerScreen.tsx (Trình phát bài tập)
// Route params: { postId: string }.
// Cần cài: npx expo install expo-video expo-keep-awake
//
// Video là nguồn thật duy nhất: nút phát + thanh tua nằm trong chính
// trình phát video, bước tập hiện tại suy ra từ thời gian phát của
// video (start_at_sec từng bước). Đồng hồ đếm bước riêng + nút tua
// ±10s cũ đã bỏ vì trùng với điều khiển của video.
// =====================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Image, RefreshControl, ScrollView, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { getPostById, getWorkoutSteps, levelLabel, type Post, type WorkoutStep } from '../../../api/workoutApi';
import {
  isSavedPost,
  toggleSavedPost,
} from '../../../utils/saved/savedPosts';
import { useSettings } from '../../../context/SettingsContext';
import { useSubscription } from '../../../context/SubscriptionContext';
import { VideoPlayer, type VideoProgress } from '../../../components/workout/VideoPlayer';
import { fmtClock } from '../../../utils/workout/workoutFormat';
import { styles } from './WorkoutPlayerScreen.styles';

export default function WorkoutPlayerScreen() {
  useKeepAwake();
  const { t } = useSettings();
  // Video bài tập chỉ mở với Pro/Family; Free thấy màn khóa.
  const { canWorkout } = useSubscription();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const postId: string = route.params?.postId;
  const [post, setPost] = useState<Post | null>(null);
  const [steps, setSteps] = useState<WorkoutStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imgError, setImgError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saved, setSaved] = useState(false);
  // Thời gian phát hiện tại của video (VideoPlayer báo về 500ms/lần).
  const [videoTime, setVideoTime] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);
  // Yêu cầu tua video tới giây X (bấm 1 bước tập ở danh sách bên dưới).
  const [seekReq, setSeekReq] = useState<{ time: number; nonce: number } | null>(null);

  // Dấu lưu: đọc lúc mở màn + mỗi lần quay lại.
  const refreshSaved = useCallback(async () => {
    if (!postId) return;
    setSaved(await isSavedPost('workout', postId));
  }, [postId]);
  useFocusEffect(
    useCallback(() => {
      void refreshSaved();
    }, [refreshSaved]),
  );
  const onToggleSave = async () => {
    if (!postId) return;
    setSaved(await toggleSavedPost('workout', postId));
  };

  // Tải lại khi kéo refresh.
  const load = useCallback(async () => {
    try {
      if (!postId) throw new Error(t('workout.player.missingPostId'));
      const [p, s] = await Promise.all([getPostById(postId), getWorkoutSteps(postId)]);
      if (!p) throw new Error(t('workout.player.notFound'));
      setPost(p);
      setSteps(s);
    } catch (e: any) {
      setError(e?.message ?? t('workout.player.loadFailed'));
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

  // Giây bắt đầu của 1 bước TRÊN VIDEO (start_at_sec trong DB; bài cũ
  // chưa có thì tính dồn từ thời lượng các bước trước).
  const stepStartAt = useCallback((idx: number): number => {
    const s = steps[idx];
    if (!s) return 0;
    if (s.start_at_sec != null) return s.start_at_sec;
    let acc = 0;
    for (let i = 0; i < idx; i++) acc += steps[i].duration_sec || 0;
    return acc;
  }, [steps]);

  // Bước hiện tại suy ra từ thời gian phát của video.
  const stepIdx = useMemo(() => {
    if (steps.length === 0) return 0;
    let cur = 0;
    for (let i = 0; i < steps.length; i++) {
      if (videoTime >= stepStartAt(i)) cur = i;
      else break;
    }
    return cur;
  }, [steps, videoTime, stepStartAt]);

  // Video báo tiến độ → màn hình cập nhật bước hiện tại theo.
  const handleVideoProgress = useCallback((p: VideoProgress) => {
    setVideoTime(p.currentTime);
    setVideoPlaying(p.playing);
  }, []);

  // Bấm 1 bước tập → video nhảy tới đúng phút của bước đó và phát tiếp.
  // Video tua tự do được nên không còn khóa bước như trước.
  const seekToStep = (idx: number) => {
    if (steps.length === 0) return;
    setSeekReq({ time: stepStartAt(idx), nonce: Date.now() });
  };

  // Hết bước cuối cùng = tập xong (phần outro sau đó không tính).
  const lastStepEnd = steps.length > 0
    ? stepStartAt(steps.length - 1) + (steps[steps.length - 1].duration_sec || 0)
    : 0;
  const finished = lastStepEnd > 0 && videoTime >= lastStepEnd;

  const finishMinutes = post?.duration_min ?? (totalSec > 0 ? Math.max(1, Math.round(totalSec / 60)) : 15);

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
          <Text style={styles.error}>{error || t('workout.player.noWorkout')}</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // Gói Free: không phát video, hiện màn khóa + nút sang xem các gói.
  // Mọi logic tải bài, bước tập bên trên vẫn giữ nguyên.
  if (!canWorkout) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.center, { backgroundColor: '#fff' }]}>
          <View style={styles.lockCard}>
            <Ionicons name="lock-closed" size={48} color="#2E7D32" />
            <Text style={styles.lockTitle}>{t('workout.player.videoLockedTitle')}</Text>
            <Text style={styles.lockBody}>{t('workout.player.videoLockedBody')}</Text>
            <TouchableOpacity
              style={styles.lockBtn}
              onPress={() => navigation.navigate('Plans')}
            >
              <Text style={styles.lockBtnText}>{t('subscription.viewPlans')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const curStep = steps[stepIdx];

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
    <View style={{ paddingHorizontal: 16 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color="#1B2A1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('workout.player.title')}</Text>
      </View>
    </View>
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >

      {/* Video/bìa + dấu lưu góc trên bên phải (cùng kiểu card luyện tập). */}
      <View style={{ position: 'relative' }}>
        {post.video_url ? (
          <View style={styles.videoWrap}>
            <VideoPlayer uri={post.video_url} onProgress={handleVideoProgress} seekRequest={seekReq} />
          </View>
        ) : post.cover_url && !imgError ? (
          <Image source={{ uri: post.cover_url }} style={styles.cover} onError={() => setImgError(true)} />
        ) : (
          <View style={[styles.cover, { backgroundColor: '#2E7D32', justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="fitness" size={64} color="#fff" />
          </View>
        )}
        <TouchableOpacity style={styles.bookmark} onPress={onToggleSave}>
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color='#fff'
          />
        </TouchableOpacity>
      </View>

      {curStep && !finished && (
        <Text style={styles.nowPlaying}>{t('workout.player.nowPlaying', { title: curStep.title })}</Text>
      )}
      {finished && <Text style={styles.nowPlaying}>{t('workout.player.finished')}</Text>}

      <Text style={styles.title}>{post.title}</Text>
      {post.summary ? <Text style={styles.summary}>{post.summary}</Text> : null}

      <View style={styles.infoGrid}>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>{t('workout.player.durationLabel')}</Text>
          <Text style={styles.infoValue}>{t('workout.player.minutesValue', { min: post.duration_min ?? '—' })}</Text>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>{t('workout.player.burnLabel')}</Text>
          <Text style={styles.infoValue}>{post.kcal_estimate != null ? t('workout.player.kcalValue', { kcal: post.kcal_estimate }) : t('workout.player.noKcal')}</Text>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>{t('workout.player.levelLabel')}</Text>
          <Text style={styles.infoValue}>{levelLabel(post.level)}</Text>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>{t('workout.player.movesLabel')}</Text>
          <Text style={styles.infoValue}>{t('workout.player.movesValue', { count: steps.length })}</Text>
        </View>
      </View>

      <View style={styles.stepsHead}>
        <Text style={styles.h2}>{t('workout.player.stepsTitle')}</Text>
        <Text style={styles.stepsTotal}>{t('workout.player.stepsTotal', { count: steps.length, time: fmtClock(totalSec) })}</Text>
      </View>
      {steps.length === 0 && (
        <Text style={styles.empty}>{t('workout.player.noSteps')}</Text>
      )}
      {steps.map((s, idx) => {
        const isCurrent = idx === stepIdx && !finished;
        const isDone = finished || idx < stepIdx;
        return (
          <TouchableOpacity
            key={s.id}
            style={[styles.stepRow, isCurrent && styles.stepCurrent]}
            onPress={() => seekToStep(idx)}
          >
            <View style={[styles.stepPlay, isCurrent && styles.stepPlayActive]}>
              {isDone && !isCurrent ? (
                <Ionicons name="checkmark" size={18} color="#2E7D32" />
              ) : isCurrent ? (
                <Ionicons name={videoPlaying ? 'pause' : 'play'} size={18} color="#fff" />
              ) : (
                <Ionicons name="play" size={18} color="#8A968E" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>
                {idx + 1}. {s.title}
              </Text>
              <Text style={styles.stepSub}>
                {s.instruction ?? ''} · {fmtClock(s.duration_sec)}
                {isCurrent ? t('workout.player.playingSuffix') : ''}
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
            // Bắt đầu lại từ đầu video.
            setSeekReq({ time: 0, nonce: Date.now() });
          }
        }}
      >
        <Text style={styles.startText}>
          {finished || steps.length === 0 ? t('workout.player.finishAndLog') : t('workout.player.startNow')}
        </Text>
      </TouchableOpacity>
      {steps.length > 0 && !finished && (
        <TouchableOpacity
          style={styles.logLink}
          onPress={() => navigation.navigate('WorkoutLog', { postId: post.id, minutes: post.duration_min ?? finishMinutes })}
        >
          <Text style={styles.logLinkText}>{t('workout.player.logWithoutFinishing')}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
