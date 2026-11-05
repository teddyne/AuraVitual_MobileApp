import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../../context/SettingsContext';
import { healthScore } from '../../../lib/auravitalApi';
import {
  DEFAULT_SHARING,
  deriveEvents,
  displayNameOf,
  getMemberDetail,
  healthBadge,
  setNickname,
  timeAgo,
  type FamilyMember,
} from '../../../lib/familyApi';
import { FamilyVitalGrid } from '../components/FamilyVitalGrid';
import { FamilyEventList } from '../components/FamilyEventList';
import { FamilySosBanner } from '../components/FamilySosBanner';
import { s } from './FamilyDetailScreen.styles';

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
  const score = metric ? healthScore(metric, {
    step_goal: member.stepGoal,
    water_goal_ml: member.waterGoalMl,
    sleep_goal_hours: member.sleepGoalHours,
  } as any) : null;
  const badge = healthBadge(score);
  const events = deriveEvents(member);

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

          <FamilyVitalGrid member={member} metric={metric} settings={settings} theme={theme} />

          {/* Lịch sử sự kiện hôm nay (suy ra từ dữ liệu thật) */}
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: theme.text }]}>Lịch sử sự kiện hôm nay</Text>
            <Text style={[s.sectionRight, { color: theme.muted }]}>{events.length} sự kiện</Text>
          </View>
          <FamilyEventList events={events} theme={theme} />

          {/* Banner SOS — chỉ UI theo yêu cầu */}
          <FamilySosBanner name={name} theme={theme} onSettings={onSosSettings} />
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
