import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../../context/SettingsContext';
import { formatSleep, healthScore } from '../../../lib/auravitalApi';
import {
  DEFAULT_SHARING,
  deriveEvents,
  displayNameOf,
  getMemberDetail,
  healthBadge,
  setNickname,
  stepsToKcal,
  stepsToKm,
  timeAgo,
  type FamilyMember,
} from '../../../lib/familyApi';

export default function FamilyDetailScreen({ navigation, route }: any) {
  const { theme } = useSettings();
  const memberId: string | undefined = route?.params?.memberId;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [member, setMember] = useState<FamilyMember | null>(null);
  const [editingNick, setEditingNick] = useState(false);
  const [nickDraft, setNickDraft] = useState('');

  const load = useCallback(async () => {
    if (!memberId) {
      setLoading(false);
      return;
    }
    const m = await getMemberDetail(memberId).catch(() => null);
    setMember(m);
    setLoading(false);
    setRefreshing(false);
  }, [memberId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const goSettings = () => navigation.navigate('SharingSettings');
  const goAccount = () => {
    const root = navigation.getParent?.() ?? navigation;
    root.navigate('Main', { screen: 'AccountTab' });
  };

  const onSaveNick = async () => {
    if (!member) return;
    const ok = await setNickname(member.ownerId, nickDraft);
    if (!ok) {
      Alert.alert('Lỗi', 'Không lưu được biệt danh.');
      return;
    }
    setEditingNick(false);
    void load();
  };

  const onSosSettings = () => {
    Alert.alert(
      'SOS 24/7 (bản demo giao diện)',
      'Tính năng bảo vệ khẩn cấp hiện chỉ hiển thị giao diện. Khi hoàn thiện, hệ thống sẽ gọi liên lạc ưu tiên và gửi vị trí khi phát hiện ngã té hoặc nhịp tim cao kéo dài lúc nghỉ ngơi.',
    );
  };

  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
          <ActivityIndicator size='large' color={theme.primaryDark} style={{ marginTop: 80 }} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!member) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
          <View style={{ padding: 16 }}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 12, paddingVertical: 4 }}>
              <Ionicons name="chevron-back" size={28}/>
            </TouchableOpacity>
            <Text style={[s.notFound, { color: theme.text }]}>
              Không tìm thấy thành viên (có thể liên kết đã bị hủy).
            </Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const name = displayNameOf(member);
  const metric = member.latest;
  const settings = member.settings ?? DEFAULT_SHARING;
  const sharingOff = !settings.share_enabled;
  const score = metric ? healthScore(metric, {
    step_goal: member.stepGoal,
    water_goal_ml: member.waterGoalMl,
    sleep_goal_hours: member.sleepGoalHours,
  } as any) : null;
  const badge = healthBadge(score);
  const events = deriveEvents(member);
  const showHr = !sharingOff && settings.share_heart_rate && metric?.heart_rate != null;
  const showSteps = !sharingOff && settings.share_steps && metric?.steps != null;
  const showSleep = !sharingOff && settings.share_sleep && metric?.sleep_hours != null;
  const showSpo2 = !sharingOff && settings.share_spo2 && metric?.spo2 != null;
  const showWeight = !sharingOff && settings.share_weight && metric?.weight_kg != null;
  const hrStatus =
    metric?.heart_rate == null
      ? ''
      : metric.heart_rate < 60
        ? 'Thấp (dưới 60)'
        : metric.heart_rate <= 100
          ? 'Bình thường (60-90)'
          : 'Cao (trên 100)';

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          {/* Header: quay lại + tiêu đề + cài đặt */}
          <View style={s.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 12, paddingVertical: 4 }}>
              <Ionicons name="chevron-back" size={28}/>
            </TouchableOpacity>

            <Text style={[s.headerTitle, { color: theme.text }]} numberOfLines={1}>
              Sức khỏe của {name}
            </Text>

            <View style={s.headerBtns}>
              <TouchableOpacity onPress={goSettings}>
                <Ionicons name='settings-outline' size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
          }
        >

          {/* Thẻ hồ sơ */}
          <View style={[s.profileCard, { backgroundColor: theme.cardAlt }]}>
            <View style={[s.initialCircle, { backgroundColor: '#FFFFFF' }]}>
              <Text style={[s.initial, { color: theme.primaryDark }]}>
                {name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              {editingNick ? (
                <View style={s.nickRow}>
                  <TextInput
                    value={nickDraft}
                    onChangeText={setNickDraft}
                    placeholder='Biệt danh, ví dụ: Bố'
                    placeholderTextColor={theme.muted}
                    maxLength={30}
                    style={[s.nickInput, { backgroundColor: '#FFFFFF', color: theme.text }]}
                  />
                  <TouchableOpacity onPress={onSaveNick}>
                    <Text style={[s.nickSave, { color: theme.primaryDark }]}>Lưu</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingNick(false)}>
                    <Text style={[s.nickSave, { color: theme.muted }]}>Hủy</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={s.nameRow}>
                  <Text style={[s.profileName, { color: theme.text }]} numberOfLines={1}>
                    {member.nickname && member.nickname !== member.displayName
                      ? `${member.nickname} (${member.displayName})`
                      : member.displayName}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setNickDraft(member.nickname ?? '');
                      setEditingNick(true);
                    }}
                  >
                    <Text style={[s.editNick, { color: theme.primaryDark }]}> ✎</Text>
                  </TouchableOpacity>
                </View>
              )}
              <Text style={[s.profileSub, { color: theme.text }]}>● Đang kết nối</Text>
              <Text style={[s.profileSub2, { color: theme.muted }]}>
                {metric ? `Đồng bộ ngày ${timeAgo(metric.updated_at)}` : 'Chưa có dữ liệu'}
              </Text>
            </View>
            {score != null && (
              <View style={[s.scoreBadge, { backgroundColor: '#FFFFFF' }]}>
                <Text style={[s.scoreText, { color: theme.primaryDark }]}>🍃 {score}</Text>
              </View>
            )}
          </View>

          {/* Chỉ số sinh hiệu */}
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: theme.text }]}>Chỉ số sinh hiệu</Text>
            <Text style={[s.live, { color: theme.primaryDark }]}>● Trực tiếp</Text>
          </View>

          {sharingOff ? (
            <Text style={[s.notice, { color: theme.muted }]}>
              Thành viên này đã tắt chia sẻ sức khỏe với gia đình.
            </Text>
          ) : !metric ? (
            <Text style={[s.notice, { color: theme.muted }]}>
              Thành viên chưa ghi nhận chỉ số nào.
            </Text>
          ) : (
            <View style={s.grid}>
              {showHr && (
                <View style={[s.vitalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={s.vitalIcon}>❤️</Text>
                  <Text style={[s.vitalLabel, { color: theme.muted }]}>LÚC NGHỈ</Text>
                  <Text style={[s.vitalValue, { color: theme.text }]}>{metric.heart_rate} <Text style={s.vitalUnit}>BPM</Text></Text>
                  <Text style={[s.vitalNote, { color: theme.primaryDark }]}>✓ {hrStatus}</Text>
                </View>
              )}
              {showSteps && (
                <View style={[s.vitalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={s.vitalIcon}>🏃</Text>
                  <Text style={[s.vitalValue, { color: theme.text }]}>
                    {metric.steps!.toLocaleString('vi-VN')}
                    <Text style={s.vitalUnit}> / {member.stepGoal.toLocaleString('vi-VN')}</Text>
                  </Text>
                  <Text style={[s.vitalNote, { color: theme.primaryDark }]}>
                    {Math.round((metric.steps! / member.stepGoal) * 100)}% • {stepsToKm(metric.steps!).toFixed(1)} km • {stepsToKcal(metric.steps!)} kcal
                  </Text>
                </View>
              )}
              {showSleep && (
                <View style={[s.vitalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={s.vitalIcon}>🌙</Text>
                  <Text style={[s.vitalValue, { color: theme.text }]}>{formatSleep(metric.sleep_hours)}</Text>
                  <Text style={[s.vitalNote, { color: theme.primaryDark }]}>
                    {Math.round((Number(metric.sleep_hours) / member.sleepGoalHours) * 100)}% mục tiêu giấc ngủ
                  </Text>
                </View>
              )}
              {showSpo2 && (
                <View style={[s.vitalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={s.vitalIcon}>🩸</Text>
                  <Text style={[s.vitalValue, { color: theme.text }]}>SpO2: {metric.spo2}%</Text>
                  <Text style={[s.vitalNote, { color: theme.primaryDark }]}>
                    {metric.spo2! >= 95 ? 'Oxy máu lý tưởng' : 'Oxy máu thấp, cần chú ý'}
                  </Text>
                </View>
              )}
              {showWeight && (
                <View style={[s.vitalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={s.vitalIcon}>⚖️</Text>
                  <Text style={[s.vitalValue, { color: theme.text }]}>{metric.weight_kg} <Text style={s.vitalUnit}>kg</Text></Text>
                  <Text style={[s.vitalNote, { color: theme.muted }]}>Cân nặng hôm nay</Text>
                </View>
              )}
            </View>
          )}

          {/* Lịch sử sự kiện hôm nay (suy ra từ dữ liệu thật) */}
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: theme.text }]}>Lịch sử sự kiện hôm nay</Text>
            <Text style={[s.sectionRight, { color: theme.muted }]}>{events.length} sự kiện</Text>
          </View>
          {events.length === 0 ? (
            <Text style={[s.notice, { color: theme.muted }]}>
              Hôm nay chưa có sự kiện (đạt mục tiêu bước chân, ngủ đủ giấc hoặc uống đủ nước sẽ hiện ở đây).
            </Text>
          ) : (
            events.map((e) => (
              <View key={e.id} style={[s.eventCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={[s.eventIcon, { backgroundColor: theme.cardAlt }]}>
                  <Text style={s.eventEmoji}>{e.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.eventTitle, { color: theme.primaryDark }]}>{e.title}</Text>
                  <Text style={[s.eventSub, { color: theme.text }]}>{e.subtitle}</Text>
                  <Text style={[s.eventBody, { color: theme.muted }]}>{e.body}</Text>
                </View>
                <Text style={[s.eventTime, { color: theme.muted }]}>Hôm nay</Text>
              </View>
            ))
          )}

          {/* Banner SOS — chỉ UI theo yêu cầu */}
          <View style={[s.sosCard, { backgroundColor: '#FFEBEE' }]}>
            <Text style={s.sosIcon}>🛡</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.sosTitle, { color: theme.text }]}>Bảo vệ khẩn cấp SOS 24/7</Text>
              <Text style={[s.sosBody, { color: theme.text }]}>
                Nếu phát hiện biến cố ngã té bất ngờ hoặc nhịp tim &gt; 130 BPM kéo dài khi nghỉ ngơi, AuraVital sẽ tự động gọi liên lạc ưu tiên, và chuyển vị trí trực tiếp của {name} đến bạn ngay lập tức.
              </Text>
              <View style={s.sosFooter}>
                <Text style={[s.sosStatus, { color: theme.muted }]}>Đang giám sát chủ động</Text>
                <TouchableOpacity onPress={onSosSettings}>
                  <Text style={[s.sosBtn, { color: theme.primaryDark }]}>⚙️ Cài đặt SOS</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
// 1. Thêm alignItems: 'center' để tất cả phần tử trong hàng căn giữa theo chiều dọc
  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  headerTitle: { 
    fontSize: 17, 
    fontWeight: '800', 
    flex: 1,
  },

  headerBtns: { flexDirection: 'row', gap: 14 },
  notFound: { fontSize: 15, marginTop: 20, lineHeight: 22 },
  profileCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 14, marginTop: 1, gap: 12 },
  initialCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 24, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  profileName: { fontSize: 17, fontWeight: '800', flexShrink: 1 },
  editNick: { fontSize: 16 },
  nickRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nickInput: { flex: 1, borderRadius: 8, padding: 8, fontSize: 15 },
  nickSave: { fontWeight: '800' },
  profileSub: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  profileSub2: { fontSize: 13, marginTop: 1 },
  scoreBadge: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  scoreText: { fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 0 },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  sectionRight: { fontSize: 13 },
  live: { fontSize: 13, fontWeight: '700' },
  notice: { fontSize: 14, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  vitalCard: { width: '48%', borderWidth: 1, borderRadius: 14, padding: 12 },
  vitalIcon: { fontSize: 20 },
  vitalLabel: { fontSize: 11, fontWeight: '800', marginTop: 6 },
  vitalValue: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  vitalUnit: { fontSize: 13, fontWeight: '600' },
  vitalNote: { fontSize: 12, marginTop: 4, lineHeight: 16 },
  eventCard: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8, gap: 10 },
  eventIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  eventEmoji: { fontSize: 20 },
  eventTitle: { fontSize: 12, fontWeight: '800' },
  eventSub: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  eventBody: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  eventTime: { fontSize: 12 },
  sosCard: { flexDirection: 'row', borderRadius: 16, padding: 14, marginTop: 24, gap: 10 },
  sosIcon: { fontSize: 26 },
  sosTitle: { fontSize: 16, fontWeight: '800' },
  sosBody: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  sosFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  sosStatus: { fontSize: 12 },
  sosBtn: { fontSize: 13, fontWeight: '800' },
});
