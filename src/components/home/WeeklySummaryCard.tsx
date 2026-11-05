import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fmt, fmtHoursMinutes, fmtSleepHours } from './homeFormat';
import { type WeeklySummary } from '../../lib/workoutApi';
import { styles } from './HomeSections.styles';

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
          <Text style={[styles.sectionTitle, { color: '#000' }]}>Tổng kết tuần</Text>
        </View>
        <View style={styles.sparkle}>
          <Ionicons name='sparkles' size={20} color='#2E7D32' />
        </View>
      </View>
      <View style={styles.grid}>
        <View style={styles.miniCard}>
          <Text style={styles.miniLabel}>TỔNG BƯỚC</Text>
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
          <Text style={styles.miniLabel}>LUYỆN TẬP</Text>
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
          <Text style={styles.miniLabel}>NƯỚC UỐNG</Text>
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
          <Text style={styles.miniLabel}>GIỜ NGỦ</Text>
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

