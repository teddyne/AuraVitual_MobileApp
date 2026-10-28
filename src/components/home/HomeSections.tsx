import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  levelLabel,
  type Post,
  type WeeklySummary,
} from '../../lib/workoutApi';

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={styles.barTrack}>
      <View
        style={[
          styles.barFill,
          { width: `${clamped}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
}

function IconCircle({ bg, name }: { bg: string; name: any }) {
  return (
    <View style={[styles.iconCircle, { backgroundColor: bg }]}>
      <Ionicons name={name} size={19} color='#fff' />
    </View>
  );
}

function fmt(n: number): string {
  return n.toLocaleString('vi-VN');
}

function fmtHoursMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return h > 0 ? `${h}h ${m}ph` : `${m}ph`;
}

function fmtSleepHours(totalHours: number): string {
  const h = Math.floor(totalHours);
  const m = Math.round((totalHours - h) * 60);
  return `${h}h ${m}m`; // đúng dạng thẻ Figma: "7h 31m"
}

// ---------------------------------------------------------------------
// 1) Chỉ số nổi bật trong ngày — lưới 2x2, thanh đo như ảnh Figma.
// ---------------------------------------------------------------------
export type HighlightProps = {
  steps: number | null;
  stepGoal: number | null;
  daysToPeriod: number | null; // null = chưa có dữ liệu chu kỳ
  cyclePhaseLabel: string | null; // ví dụ "Pha nang noãn", null thì ẩn dòng này
  sleepHours: number | null;
  sleepGoalHours: number | null;
  kcal: number | null;
  calorieGoal: number | null;
  onSteps: () => void;
  onCycle: () => void;
  onSleep: () => void;
  onNutrition: () => void;
};

export function HighlightCards(p: HighlightProps) {
  const stepPct =
    p.steps != null && p.stepGoal ? (p.steps / p.stepGoal) * 100 : 0;
  const sleepPct =
    p.sleepHours != null && p.sleepGoalHours
      ? (p.sleepHours / p.sleepGoalHours) * 100
      : 0;
  const kcalPct =
    p.kcal != null && p.calorieGoal ? (p.kcal / p.calorieGoal) * 100 : 0;
  return (
    <View>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Chỉ số nổi bật trong ngày</Text>
        <Text style={styles.sectionSub}>Dữ liệu thời gian thực</Text>
      </View>
      <View style={styles.grid}>
        <TouchableOpacity
          style={[styles.card, { backgroundColor: '#EAF6EC' }]}
          onPress={p.onSteps}
        >
          <IconCircle bg='#2E7D32' name='walk' />
          <Text style={styles.big}>{p.steps != null ? fmt(p.steps) : '—'}</Text>
          <Text style={styles.cardLabel}>Bước chân</Text>
          <ProgressBar pct={stepPct} color='#2E7D32' />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: '#FDECEC' }]}
          onPress={p.onCycle}
        >
          <IconCircle bg='#D96C6C' name='heart' />
          <Text style={[styles.big, { color: '#B23A3A' }]}>
            {p.daysToPeriod != null ? `${p.daysToPeriod} ngày` : '—'}
          </Text>
          <Text style={styles.cardLabel}>Trước kỳ kinh tiếp theo</Text>
          {p.cyclePhaseLabel ? (
            <Text style={styles.phase}>● {p.cyclePhaseLabel}</Text>
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: '#EAF0FF' }]}
          onPress={p.onSleep}
        >
          <IconCircle bg='#5B6FD6' name='moon' />
          <Text style={styles.big}>
            {p.sleepHours != null ? fmtSleepHours(p.sleepHours) : '—'}
          </Text>
          <Text style={styles.cardLabel}>Giấc ngủ ngon</Text>
          <ProgressBar pct={sleepPct} color='#5B6FD6' />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: '#FFF6E3' }]}
          onPress={p.onNutrition}
        >
          <IconCircle bg='#E9A23B' name='restaurant' />
          <Text style={styles.big}>
            {p.kcal != null ? fmt(p.kcal) : '—'}
            <Text style={styles.bigUnit}> kcal</Text>
          </Text>
          <Text style={styles.cardLabel}>Năng lượng đã nạp</Text>
          <ProgressBar pct={kcalPct} color='#E9A23B' />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------
// 2) Đề xuất bài tập hôm nay — 1 thẻ lớn như ảnh Figma.
//    Bấm vào thẻ / nút play -> trình phát. "Xem tất cả" -> tab Khám phá.
// ---------------------------------------------------------------------
export function TodayWorkoutCard({
  post,
  onPress,
  onSeeAll,
}: {
  post: Post | null;
  onPress: (post: Post) => void;
  onSeeAll: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  if (!post) {
    return (
      <View>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Đề xuất bài tập hôm nay</Text>
          <TouchableOpacity onPress={onSeeAll}>
            <Text style={styles.seeAll}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>
        <View
          style={[
            styles.workoutCard,
            {
              backgroundColor: '#EAF6EC',
              justifyContent: 'center',
              alignItems: 'center',
            },
          ]}
        >
          <Text style={styles.emptyText}>
            Chưa có bài tập trong database.{'\n'}Chạy seed v6 rồi tải lại.
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Đề xuất bài tập hôm nay</Text>
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={styles.seeAll}>Xem tất cả</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.workoutCard}
        onPress={() => onPress(post)}
        activeOpacity={0.9}
      >
        {post.cover_url && !imgError ? (
          <Image
            source={{ uri: post.cover_url }}
            style={styles.workoutImage}
            onError={() => setImgError(true)}
          />
        ) : (
          <View
            style={[
              styles.workoutImage,
              {
                backgroundColor: '#2E7D32',
                justifyContent: 'center',
                alignItems: 'center',
              },
            ]}
          >
            <Ionicons name='fitness' size={64} color='#fff' />
          </View>
        )}
        <View style={styles.workoutOverlay} />
        <View style={styles.chipRow}>
          {post.duration_min != null && (
            <View style={[styles.chip, { backgroundColor: '#2E7D32' }]}>
              <Text style={styles.chipText}>{post.duration_min} PHÚT</Text>
            </View>
          )}
          <View
            style={[styles.chip, { backgroundColor: 'rgba(120,120,120,0.9)' }]}
          >
            <Text style={styles.chipText}>
              {levelLabel(post.level).toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={styles.playBtn}>
          <Ionicons
            name='play'
            size={28}
            color='#2E7D32'
            style={{ marginLeft: 3 }}
          />
        </View>
        <View style={styles.workoutText}>
          <Text style={styles.workoutTitle} numberOfLines={2}>
            {post.title}
          </Text>
          {post.summary ? (
            <Text style={styles.workoutSummary} numberOfLines={2}>
              {post.summary}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------
// 3) Tổng kết tuần — bấm ô Luyện tập -> trang ghi nhận tập luyện.
//    Chỉ hiện số thật: không có "ngủ sâu +8%", không có "đạt mục tiêu
//    tuần" vì DB không có 2 số đó.
// ---------------------------------------------------------------------
export function WeeklySummaryCard({
  summary,
  onPressWorkout,
}: {
  summary: WeeklySummary | null;
  onPressWorkout: () => void;
}) {
  return (
    <View style={styles.weeklyWrap}>
      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.sectionTitle}>Tổng kết tuần</Text>
          <Text style={styles.sectionSub}>Đồng bộ nhịp sinh học liên tục</Text>
        </View>
        <View style={styles.sparkle}>
          <Ionicons name='sparkles' size={20} color='#2E7D32' />
        </View>
      </View>
      <View style={styles.grid}>
        <View style={styles.miniCard}>
          <Text style={styles.miniLabel}>👣 TỔNG BƯỚC</Text>
          <Text style={styles.miniBig}>
            {summary ? fmt(summary.stepsTotal) : '—'}
          </Text>
          <Text style={styles.miniSub}>
            {summary && summary.stepsChangePct != null
              ? `${summary.stepsChangePct >= 0 ? '+' : ''}${summary.stepsChangePct}% so với tuần trước`
              : 'Chưa đủ dữ liệu tuần trước để so sánh'}
          </Text>
        </View>
        <TouchableOpacity style={styles.miniCard} onPress={onPressWorkout}>
          <Text style={styles.miniLabel}>🏋️ LUYỆN TẬP</Text>
          <Text style={styles.miniBig}>
            {summary ? fmtHoursMinutes(summary.workoutMinutes) : '—'}
          </Text>
          <Text style={styles.miniSub}>
            {summary
              ? `${summary.workoutSessions} buổi · ${fmt(summary.workoutKcal)} kcal ước lượng`
              : ''}
          </Text>
          <Text style={styles.miniLink}>Ghi nhận tập luyện →</Text>
        </TouchableOpacity>
        <View style={styles.miniCard}>
          <Text style={styles.miniLabel}>💧 NƯỚC UỐNG</Text>
          <Text style={styles.miniBig}>
            {summary ? `${fmt(summary.waterTotalMl)} ml` : '—'}
          </Text>
          <Text style={styles.miniSub}>
            {summary && summary.waterAvgPctOfGoal != null
              ? `Trung bình ${summary.waterAvgPctOfGoal}% mục tiêu/ngày`
              : 'Chưa có mục tiêu nước'}
          </Text>
        </View>
        <View style={styles.miniCard}>
          <Text style={styles.miniLabel}>🌙 GIỜ NGỦ</Text>
          <Text style={styles.miniBig}>
            {summary ? fmtSleepHours(summary.sleepTotalHours) : '—'}
          </Text>
          <Text style={styles.miniSub}>
            {summary ? `Trung bình ${summary.sleepAvgHours}h/ngày` : ''}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------
// 4) Kiến thức dinh dưỡng — 2-3 bài viết, bấm vào -> trang chi tiết.
// ---------------------------------------------------------------------
export function HomeArticles({
  articles,
  onPressArticle,
  onSeeAll,
}: {
  articles: Post[];
  onPressArticle: (post: Post) => void;
  onSeeAll: () => void;
}) {
  const [badImg, setBadImg] = useState<Record<string, boolean>>({});
  return (
    <View>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Kiến thức dinh dưỡng</Text>
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={styles.seeAll}>Xem tất cả</Text>
        </TouchableOpacity>
      </View>
      {articles.length === 0 ? (
        <Text style={styles.emptyText}>
          Chưa có bài viết trong database. Chạy seed v5/v6 rồi tải lại.
        </Text>
      ) : (
        articles.map((a, index) => (
          <TouchableOpacity
            key={`${a.id ?? 'no-id'}-${index}`}
            style={styles.articleRow}
            onPress={() => onPressArticle(a)}
          >
            {a.cover_url && !badImg[a.id] ? (
              <Image
                source={{ uri: a.cover_url }}
                style={styles.articleThumb}
                onError={() => setBadImg((s) => ({ ...s, [a.id]: true }))}
              />
            ) : (
              <View
                style={[
                  styles.articleThumb,
                  {
                    backgroundColor: '#EAF6EC',
                    justifyContent: 'center',
                    alignItems: 'center',
                  },
                ]}
              >
                <Ionicons name='book' size={28} color='#2E7D32' />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.articleTitle} numberOfLines={2}>
                {a.title}
              </Text>
              {a.summary ? (
                <Text style={styles.articleSummary} numberOfLines={2}>
                  {a.summary}
                </Text>
              ) : null}
              <Text style={styles.articleMeta}>
                {a.duration_min != null
                  ? `${a.duration_min} phút đọc`
                  : 'Bài viết'}{' '}
                · {levelLabel(a.level)}
              </Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 24,
  },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#1B2A1E' },
  sectionSub: { fontSize: 13, color: '#6B7A6E' },
  seeAll: { fontSize: 15, fontWeight: '600', color: '#2E7D32' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    borderRadius: 20,
    padding: 12,
    marginBottom: 12,
    minHeight: 148,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  big: { fontSize: 26, fontWeight: '800', color: '#1B2A1E' },
  bigUnit: { fontSize: 16, fontWeight: '600', color: '#5B665E' },
  cardLabel: { fontSize: 14, color: '#3D4A41', marginTop: 2, marginBottom: 8 },
  phase: { fontSize: 14, color: '#8A4A4A', marginTop: 2 },
  barTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.10)',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 4 },
  workoutCard: {
    height: 240,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#DDD',
  },
  workoutImage: { position: 'absolute', width: '100%', height: '100%' },
  workoutOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  chipRow: { flexDirection: 'row', gap: 8, margin: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  chipText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  playBtn: {
    position: 'absolute',
    alignSelf: 'center',
    top: 95,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  workoutText: { position: 'absolute', bottom: 16, left: 16, right: 16 },
  workoutTitle: { color: '#fff', fontSize: 21, fontWeight: '800' },
  workoutSummary: { color: '#EDEDED', fontSize: 14, marginTop: 4 },
  weeklyWrap: {
    backgroundColor: '#EEF3FF',
    borderRadius: 24,
    padding: 16,
    marginTop: 8,
  },
  sparkle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3EBFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    minHeight: 110,
  },
  miniLabel: { fontSize: 12, fontWeight: '700', color: '#5B665E' },
  miniBig: { fontSize: 20, fontWeight: '800', color: '#1B2A1E', marginTop: 6 },
  miniSub: { fontSize: 13, color: '#2E7D32', marginTop: 4 },
  miniLink: { fontSize: 13, fontWeight: '700', color: '#2E7D32', marginTop: 6 },
  articleRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    alignItems: 'flex-start',
  },
  articleThumb: { width: 76, height: 76, borderRadius: 14 },
  articleTitle: { fontSize: 16, fontWeight: '700', color: '#1B2A1E' },
  articleSummary: { fontSize: 14, color: '#5B665E', marginTop: 3 },
  articleMeta: { fontSize: 13, color: '#8A968E', marginTop: 4 },
  emptyText: {
    fontSize: 14,
    color: '#6B7A6E',
    textAlign: 'center',
    padding: 16,
  },
});
