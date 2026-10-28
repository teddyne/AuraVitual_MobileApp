import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../auth/AuthContext';
import { useSettings } from '../../../context/SettingsContext';
import {
  getRecommendation,
  saveRecommendation,
  syncRecommendationToProfile,
} from '../../../lib/auravitalApi';
import { isoToLabel } from '../../../lib/healthCalc';

const GOAL_LABEL: Record<string, string> = {
  maintain: 'Duy trì vóc dáng',
  lose: 'Giảm cân',
  gain: 'Tăng cân',
  sleep: 'Cải thiện giấc ngủ sâu',
  cycle: 'Chu kỳ & Nội tiết tố',
};
function fmtHours(h: number) {
  const hh = Math.floor(h),
    mm = Math.round((h - hh) * 60);
  return `${hh} giờ ${mm} phút`;
}

// Vòng tròn nhạt + icon xanh đậm, cùng kiểu ProfileSettings/ProfileSetup.
function IconBadge({ name }: { name: any }) {
  return (
    <View style={s.iconBadge}>
      <Ionicons name={name} size={22} color='#2E7D32' />
    </View>
  );
}

// Tiêu đề thẻ có icon, thay cho tiêu đề gắn emoji ở đầu.
function CardTitle({ icon, children, theme }: any) {
  return (
    <View style={s.cardTitleRow}>
      <IconBadge name={icon} />
      <Text style={[s.cardTitle, { color: theme.text, marginBottom: 0 }]}>
        {children}
      </Text>
    </View>
  );
}

export default function RecommendationScreen({ route, navigation }: any) {
  const { theme } = useSettings();
  const { user } = useAuth();
  const [rec, setRec] = useState<any>(route.params?.recommendation ?? null);
  const [loading, setLoading] = useState(!route.params?.recommendation);
  const savedRef = useRef(false);

  useEffect(() => {
    // Có params = vừa tính xong ở ProfileSetup: lưu lên DB, không chặn UI
    if (route.params?.recommendation) {
      if (user && !savedRef.current) {
        savedRef.current = true;
        (async () => {
          try {
            await saveRecommendation(user.id, route.params.recommendation);
            await syncRecommendationToProfile(
              user.id,
              route.params.recommendation,
            );
            await AsyncStorage.setItem(
              '@auravital:recommendation',
              JSON.stringify(route.params.recommendation),
            );
          } catch (e) {
            console.log('Save recommendation failed', e);
          }
        })();
      }
      return;
    }
    // Không có params: ưu tiên DB, rồi mới fallback AsyncStorage cũ
    (async () => {
      if (user) {
        try {
          const fromDb = await getRecommendation(user.id);
          if (fromDb) {
            setRec(fromDb);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.log('Load recommendation from DB failed', e);
        }
      }
      const raw = await AsyncStorage.getItem('@auravital:recommendation');
      if (raw) setRec(JSON.parse(raw));
      setLoading(false);
    })();
  }, [user]);

  if (loading)
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[s.wrap, { backgroundColor: theme.background }]}>
          <Text style={{ color: theme.text }}>Đang tải đề xuất...</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  if (!rec)
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[s.wrap, { backgroundColor: theme.background }]}>
          <Text style={[s.title, { color: theme.text }]}>
            Chưa có đề xuất cá nhân
          </Text>
          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: theme.primaryDark }]}
            onPress={() => navigation.replace('ProfileSetup')}
          >
            <Text style={s.primaryBtnText}>Thiết lập hồ sơ</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  const isWeight = ['maintain', 'lose', 'gain'].includes(rec.goal);
  const updated = rec.updatedAt ? new Date(rec.updatedAt) : null;
  const bmiColor =
    rec.asia.label === 'Bình thường'
      ? '#4E8A47'
      : rec.asia.label === 'Thiếu cân'
        ? '#F59E0B'
        : rec.asia.label === 'Thừa cân'
          ? '#D97706'
          : '#EF4444';
  return (
    <SafeAreaProvider>
      <SafeAreaView style={[s.wrap, { backgroundColor: theme.background }]}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <View style={[s.hero, { backgroundColor: theme.primaryDark }]}>
            <Text style={s.eyebrow}>ĐỀ XUẤT CÁ NHÂN</Text>
            <Text style={s.heroName}>{rec.displayName || 'Bạn'}</Text>
            {updated && (
              <Text style={s.heroSub}>
                Cập nhật {updated.toLocaleDateString('vi-VN')} lúc{' '}
                {updated.toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            )}
            <View style={s.pill}>
              <Text style={s.pillText}>{GOAL_LABEL[rec.goal] || rec.goal}</Text>
            </View>
          </View>

          {rec.goal === 'sleep' && (
            <View style={[s.card, { backgroundColor: theme.card }]}>
              <CardTitle icon='moon-outline' theme={theme}>
                Giấc ngủ đề xuất
              </CardTitle>
              <Text style={[s.big, { color: theme.text }]}>
                {rec.recommendedSleepHours} giờ / ngày
              </Text>
              <Text style={{ color: theme.muted }}>
                Khoảng bình thường cho lứa tuổi của bạn:{' '}
                {rec.recommendedSleepRange}.
              </Text>
              <Text style={{ color: theme.text, marginTop: 10 }}>
                Thói quen của bạn: đi ngủ {rec.sleepBedtime} — dậy{' '}
                {rec.sleepWakeTime} (
                {rec.habitualSleepHours !== null
                  ? fmtHours(rec.habitualSleepHours)
                  : 'chưa tính được'}{' '}
                mỗi đêm).
              </Text>
              {rec.habitualSleepHours !== null &&
                rec.habitualSleepHours < rec.recommendedSleepHours && (
                  <Text style={{ color: '#E65100', marginTop: 8 }}>
                    Bạn đang ngủ thiếu{' '}
                    {(
                      rec.recommendedSleepHours - rec.habitualSleepHours
                    ).toFixed(1)}{' '}
                    giờ so với đề xuất. Thử đi ngủ sớm hơn khoảng{' '}
                    {(
                      rec.recommendedSleepHours - rec.habitualSleepHours
                    ).toFixed(1)}{' '}
                    giờ, giữ giờ ngủ đều mỗi ngày.
                  </Text>
                )}
              {rec.habitualSleepHours !== null &&
                rec.habitualSleepHours >= rec.recommendedSleepHours && (
                  <Text style={{ color: '#4E8A47', marginTop: 8 }}>
                    Thói quen ngủ của bạn đã đạt đề xuất, giữ đều giờ ngủ mỗi
                    ngày.
                  </Text>
                )}
            </View>
          )}
          {rec.goal === 'cycle' && (
            <View style={[s.card, { backgroundColor: theme.card }]}>
              <CardTitle icon='flower-outline' theme={theme}>
                Chu kỳ của bạn
              </CardTitle>
              <Text style={{ color: theme.text }}>
                Ngày bắt đầu kỳ gần nhất: {isoToLabel(rec.cycleStartDate)} • Độ
                dài chu kỳ: {rec.cycleLengthDays} ngày • Số ngày hành kinh:{' '}
                {rec.periodLengthDays} ngày.
              </Text>
              <Text style={{ color: theme.text, marginTop: 10 }}>
                Kỳ sau dự kiến:{' '}
                <Text style={{ fontWeight: '800' }}>
                  {rec.cycleNextPeriodLabel}
                </Text>
              </Text>
              <Text style={{ color: theme.text, marginTop: 4 }}>
                Rụng trứng ước tính: {rec.cycleOvulationLabel} (kỳ dài − 14
                ngày, chỉ là ước tính, không phải chẩn đoán).
              </Text>
            </View>
          )}

          <View style={[s.card, { backgroundColor: theme.card }]}>
            <CardTitle icon='flash-outline' theme={theme}>
              Năng lượng
            </CardTitle>
            <View style={s.row}>
              <View style={s.badge}>
                <Text style={s.badgeText}>
                  {rec.goal === 'lose'
                    ? `−${rec.deficit}`
                    : rec.goal === 'gain'
                      ? `+${rec.surplus}`
                      : '0'}
                </Text>
                <Text style={s.badgeSub}>kcal/ngày</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.big, { color: theme.text }]}>
                  {rec.calorieTarget.toLocaleString('vi-VN')} kcal/ngày
                </Text>
                <Text style={{ color: theme.muted }}>
                  {rec.goal === 'lose'
                    ? `Thâm hụt ${rec.deficit} kcal/ngày`
                    : rec.goal === 'gain'
                      ? `Thặng dư ${rec.surplus} kcal/ngày`
                      : 'Bằng TDEE, để duy trì cân nặng'}
                </Text>
              </View>
            </View>
            <View style={s.statRow}>
              <View style={s.stat}>
                <Text style={{ color: theme.muted }}>TDEE</Text>
                <Text style={{ color: theme.text, fontWeight: '700' }}>
                  {rec.tdee.toLocaleString('vi-VN')} kcal
                </Text>
              </View>
              <View style={s.stat}>
                <Text style={{ color: theme.muted }}>BMR</Text>
                <Text style={{ color: theme.text, fontWeight: '700' }}>
                  {rec.bmr.toLocaleString('vi-VN')} kcal
                </Text>
              </View>
            </View>
            <Text style={{ color: theme.muted, marginTop: 8 }}>
              Cường độ: {rec.activityLabel} (hệ số {rec.factor})
              {!isWeight
                ? ' — mục tiêu này không hỏi cường độ nên calo tính theo hệ số trung bình mặc định.'
                : ''}
            </Text>
            {rec.durationLabel && (
              <Text style={{ color: theme.muted, marginTop: 4 }}>
                Trong {rec.durationLabel}
                {rec.weeklyChangeKg
                  ? ` • Cần đổi ${rec.weeklyChangeKg} kg/tuần`
                  : ''}
              </Text>
            )}
            {rec.ageEstimated && (
              <Text style={{ color: theme.muted, marginTop: 4 }}>
                Chưa nhập ngày sinh nên BMR tính với tuổi ước tính 25.
              </Text>
            )}
            {rec.isTooFast && rec.adviceText && (
              <View style={s.advice}>
                <View style={s.adviceTitleRow}>
                  <Ionicons
                    name='alert-circle-outline'
                    size={18}
                    color='#E65100'
                  />
                  <Text style={s.adviceTitle}>Lời khuyên</Text>
                </View>
                <Text
                  style={{ color: theme.muted, marginTop: 4, lineHeight: 19 }}
                >
                  {rec.adviceText}
                </Text>
              </View>
            )}
          </View>

          <View style={[s.card, { backgroundColor: theme.card }]}>
            <CardTitle icon='bar-chart-outline' theme={theme}>
              Chỉ số BMI
            </CardTitle>
            <View style={s.row}>
              <Text style={[s.big, { color: theme.text }]}>
                {rec.bmi.toFixed(1)}
              </Text>
              <View style={[s.pill, { backgroundColor: bmiColor }]}>
                <Text style={s.pillText}>{rec.asia.label}</Text>
              </View>
            </View>
            <Text style={{ color: theme.muted }}>{rec.asia.risk}</Text>
            <Text style={{ color: theme.text, marginTop: 8 }}>
              Chiều cao {rec.heightCm} cm • Cân nặng {rec.weightKg} kg
            </Text>
            <View style={s.scale}>
              {[14, 18.5, 23, 25, 30, 35].map((v, i) => null)}
              <View
                style={{
                  flexDirection: 'row',
                  height: 10,
                  borderRadius: 5,
                  overflow: 'hidden',
                }}
              >
                <View style={{ flex: 4.5, backgroundColor: '#F59E0B' }} />
                <View style={{ flex: 4.5, backgroundColor: '#4E8A47' }} />
                <View style={{ flex: 2, backgroundColor: '#D97706' }} />
                <View style={{ flex: 5, backgroundColor: '#F97316' }} />
                <View style={{ flex: 5, backgroundColor: '#EF4444' }} />
              </View>
            </View>
          </View>

          <View style={[s.card, { backgroundColor: theme.card }]}>
            <CardTitle icon='water-outline' theme={theme}>
              Nước mỗi ngày
            </CardTitle>
            <Text style={[s.big, { color: theme.text }]}>
              {rec.waterMl.toLocaleString('vi-VN')} ml / ngày
            </Text>
            <Text style={{ color: theme.muted }}>
              ≈ {rec.waterCups} ly 250 ml • Công thức: {rec.weightKg} kg × 35 ml
              {rec.waterExtra ? ` + ${rec.waterExtra} ml theo cường độ` : ''}.
            </Text>
          </View>

          {isWeight && (
            <View style={[s.card, { backgroundColor: theme.card }]}>
              <CardTitle icon='walk-outline' theme={theme}>
                Thời gian luyện tập
              </CardTitle>
              <Text style={[s.big, { color: theme.text }]}>
                {rec.exercise.minutes} phút / tuần
              </Text>
              <Text style={{ color: theme.muted }}>
                {rec.exercise.desc} ≈ {rec.exercise.kcalPerWeek} kcal/tuần.
              </Text>
              <View style={s.dotRow}>
                {Array.from({ length: 7 }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      s.dot,
                      i < rec.exercise.sessions && {
                        backgroundColor: theme.primaryDark,
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={{ color: theme.muted, marginTop: 8 }}>
                {rec.exercise.sessions} buổi × {rec.exercise.duration} phút ={' '}
                {rec.exercise.minutes} phút/tuần.
              </Text>
            </View>
          )}

          {(rec.goal === 'lose' || rec.goal === 'gain') && (
            <View style={[s.card, { backgroundColor: theme.card }]}>
              <CardTitle icon='flag-outline' theme={theme}>
                Biểu đồ mục tiêu
              </CardTitle>
              <View style={s.barRow}>
                <View style={{ alignItems: 'center' }}>
                  <View
                    style={[s.bar, { height: 80, backgroundColor: '#D1D5DB' }]}
                  />
                  <Text style={{ color: theme.muted }}>
                    Hiện tại {rec.weightKg} kg
                  </Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <View
                    style={[
                      s.bar,
                      {
                        height: Math.max(
                          40,
                          80 *
                            (rec.targetWeightKg /
                              Math.max(rec.weightKg, rec.targetWeightKg)),
                        ),
                        backgroundColor: theme.primaryDark,
                      },
                    ]}
                  />
                  <Text style={{ color: theme.muted }}>
                    Mục tiêu {rec.targetWeightKg} kg
                  </Text>
                </View>
              </View>
              <View
                style={[
                  s.pill,
                  {
                    backgroundColor: theme.primaryDark,
                    alignSelf: 'center',
                    marginTop: 12,
                  },
                ]}
              >
                <Text style={s.pillText}>
                  Cần {rec.targetDiff > 0 ? 'tăng' : 'giảm'}{' '}
                  {Math.abs(rec.targetDiff)} kg • Trong{' '}
                  {rec.durationLabel || `${rec.durationWeeks} tuần`} (bạn set)
                </Text>
              </View>
            </View>
          )}
          {rec.goal === 'maintain' && (
            <View style={[s.card, { backgroundColor: theme.card }]}>
              <CardTitle icon='flag-outline' theme={theme}>
                Biểu đồ mục tiêu
              </CardTitle>
              <View
                style={[
                  s.pill,
                  { backgroundColor: theme.primaryDark, alignSelf: 'center' },
                ]}
              >
                <Text style={s.pillText}>
                  Duy trì trong khoảng {rec.healthyMinKg}–{rec.healthyMaxKg} kg
                  {rec.durationLabel}
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: theme.primaryDark }]}
            onPress={() => navigation.replace('Main')}
          >
            <View style={s.btnRow}>
              <Text style={s.primaryBtnText}>Vào trang chủ</Text>
              <Ionicons name='arrow-forward' size={18} color='#fff' />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.secondaryBtn, { borderColor: theme.primaryDark }]}
            onPress={() => navigation.replace('ProfileSetup')}
          >
            <Text style={[s.secondaryText, { color: theme.primaryDark }]}>
              Chỉnh sửa hồ sơ
            </Text>
          </TouchableOpacity>
          <Text
            style={{ color: theme.muted, textAlign: 'center', marginTop: 12 }}
          >
            Các con số chỉ là ước tính, không thay cho tư vấn y tế.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
const s = StyleSheet.create({
  wrap: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800', padding: 16 },
  hero: { borderRadius: 24, padding: 20, marginBottom: 14 },
  eyebrow: { color: '#fff', opacity: 0.8, fontWeight: '700' },
  heroName: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 6 },
  heroSub: { color: '#fff', opacity: 0.85, marginTop: 4 },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  pillText: { color: '#fff', fontWeight: '700' },
  card: {
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', marginBottom: 10 },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EAF0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  big: { fontSize: 24, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontWeight: '800', color: '#4E8A47' },
  badgeSub: { fontSize: 11, color: '#4E8A47' },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  stat: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12, padding: 10 },
  advice: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  adviceTitle: { color: '#E65100', fontWeight: '800' },
  adviceTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scale: { marginTop: 12 },
  dotRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  dot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E5E7EB' },
  barRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
  },
  bar: { width: 56, borderRadius: 12 },
  primaryBtn: {
    borderRadius: 999,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondaryBtn: {
    borderRadius: 999,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
  },
  secondaryText: { fontWeight: '800' },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
