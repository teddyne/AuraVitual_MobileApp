import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSettings } from '../../../context/SettingsContext';
import { Ionicons } from '@expo/vector-icons';
import {
  DEFAULT_SHARING,
  displayNameOf,
  getMembers,
  getMySharingSettings,
  revokeLink,
  saveMySharingSettings,
  type FamilyMember,
  type SharingSettings,
} from '../../../lib/familyApi';

const CONTENT_ROWS: {
  key: keyof Omit<SharingSettings, 'share_enabled'>;
  title: string;
  desc: string;
}[] = [
  { key: 'share_steps', title: 'Bước chân', desc: 'Số bước, quãng đường, kcal ước lượng' },
  { key: 'share_sleep', title: 'Giấc ngủ', desc: 'Thời lượng ngủ và mục tiêu giấc ngủ' },
  { key: 'share_heart_rate', title: 'Nhịp tim', desc: 'Nhịp tim lúc nghỉ' },
  { key: 'share_spo2', title: 'SpO2', desc: 'Độ bão hòa oxy trong máu' },
  { key: 'share_water', title: 'Nước', desc: 'Lượng nước đã uống trong ngày' },
  { key: 'share_weight', title: 'Cân nặng', desc: 'Cân nặng ghi nhận hôm nay' },
];

export default function SharingSettingsScreen({ navigation }: any) {
  const { theme } = useSettings();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SharingSettings>(DEFAULT_SHARING);
  const [members, setMembers] = useState<FamilyMember[]>([]);

  const load = useCallback(async () => {
    const [s, m] = await Promise.all([
      getMySharingSettings().catch(() => DEFAULT_SHARING),
      getMembers().catch(() => []),
    ]);
    setSettings(s);
    setMembers(m);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const toggle = async (patch: Partial<SharingSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    const ok = await saveMySharingSettings(patch);
    if (!ok) {
      Alert.alert('Lỗi', 'Không lưu được cài đặt.');
      void load();
    }
  };

  const onRevoke = (m: FamilyMember) => {
    Alert.alert(
      'Hủy kết nối',
      `Ngừng chia sẻ với ${displayNameOf(m)}? Cả hai bên sẽ không còn xem được nhau.`,
      [
        { text: 'Giữ lại', style: 'cancel' },
        {
          text: 'Hủy kết nối',
          style: 'destructive',
          onPress: async () => {
            const ok = await revokeLink(m.ownerId);
            if (!ok) Alert.alert('Lỗi', 'Không hủy được kết nối.');
            void load();
          },
        },
      ],
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

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          {/* Header: quay lại + tiêu đề */}
          <View style={s.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 12, paddingVertical: 4 }}>
              <Ionicons name="chevron-back" size={28}/>
            </TouchableOpacity>
            
            <Text style={[s.headerTitle, { color: theme.text }]} numberOfLines={1}>
              Cài đặt & Phân quyền chia sẻ
            </Text>
          </View>

          <View style={[s.card, { backgroundColor: theme.card }]}>
            <View style={s.row}>
              <Text style={s.icon}>👨‍👩‍👧</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, { color: theme.text }]}>Chia sẻ sức khỏe</Text>
                <Text style={[s.muted, { color: theme.muted }]}>
                  Khi tắt, người được chia sẻ vẫn thấy tên bạn nhưng không xem được chỉ số.
                </Text>
              </View>
              <Switch
                value={settings.share_enabled}
                onValueChange={(v) => toggle({ share_enabled: v })}
                trackColor={{ false: '#CCCCCC', true: theme.primaryDark }}
                thumbColor='#FFFFFF'
              />
            </View>
          </View>

          <Text style={[s.sectionTitle, { color: theme.text }]}>
            Nội dung được chia sẻ
          </Text>
          <View
            style={[
              s.card,
              { backgroundColor: theme.card },
              !settings.share_enabled && { opacity: 0.5 },
            ]}
          >
            {CONTENT_ROWS.map((row) => (
              <View key={row.key} style={s.row}>
                <Text style={s.icon}></Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowTitle, { color: theme.text }]}>{row.title}</Text>
                  <Text style={[s.muted, { color: theme.muted }]}>{row.desc}</Text>
                </View>
                <Switch
                  disabled={!settings.share_enabled}
                  value={settings[row.key]}
                  onValueChange={(v) => toggle({ [row.key]: v } as Partial<SharingSettings>)}
                  trackColor={{ false: '#CCCCCC', true: theme.primaryDark }}
                  thumbColor='#FFFFFF'
                />
              </View>
            ))}
          </View>

          <Text style={[s.sectionTitle, { color: theme.text }]}>Thành viên đã kết nối</Text>
          {members.length === 0 ? (
            <Text style={[s.muted, { color: theme.muted }]}>
              Chưa có thành viên nào.
            </Text>
          ) : (
            members.map((m) => (
              <View key={m.ownerId} style={[s.card, { backgroundColor: theme.card }]}>
                <View style={s.row}>
                  <View style={[s.initialCircle, { backgroundColor: theme.cardAlt }]}>
                    <Text style={[s.initial, { color: theme.primaryDark }]}>
                      {displayNameOf(m).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.rowTitle, { color: theme.text }]}>{displayNameOf(m)}</Text>
                    {m.nickname && m.nickname !== m.displayName && (
                      <Text style={[s.muted, { color: theme.muted }]}>{m.displayName}</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => onRevoke(m)}>
                    <Text style={[s.revoke, { color: '#C62828' }]}>Hủy kết nối</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  // Căn giữa theo chiều dọc và tạo khoảng cách hợp lý
  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: {
    paddingRight: 2,
    paddingVertical: 4,
  },
  back: { 
    fontSize: 28, 
    fontWeight: '300',
    lineHeight: 32,
  },
  headerTitle: { 
    fontSize: 16, 
    fontWeight: '800', 
    flex: 1
  },
  card: { borderRadius: 14, padding: 12, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  icon: { fontSize: 36 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  muted: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginTop: 16, marginBottom: 10 },
  initialCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 18, fontWeight: '800' },
  revoke: { fontWeight: '700' },
});
