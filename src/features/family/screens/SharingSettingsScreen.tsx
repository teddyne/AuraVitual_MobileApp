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

// =====================================================================
// Cài đặt & Phân quyền chia sẻ:
// - Công tắc tổng "Chia sẻ sức khỏe với gia đình".
// - Chọn nội dung được chia sẻ (bước chân, giấc ngủ, nhịp tim, SpO2,
//   nước, cân nặng). Áp dụng CHUNG cho mọi người thân đã kết nối
//   (không phân quyền từng người, theo yêu cầu).
// - Hủy kết nối từng thành viên (xóa cả 2 chiều).
// Lưu ngay mỗi lần gạt công tắc (kiểu màn Cài đặt nhắc nhở).
// =====================================================================

const CONTENT_ROWS: {
  key: keyof Omit<SharingSettings, 'share_enabled'>;
  icon: string;
  title: string;
  desc: string;
}[] = [
  { key: 'share_steps', icon: '🏃', title: 'Bước chân', desc: 'Số bước, quãng đường, kcal ước lượng' },
  { key: 'share_sleep', icon: '🌙', title: 'Giấc ngủ', desc: 'Thời lượng ngủ và mục tiêu giấc ngủ' },
  { key: 'share_heart_rate', icon: '❤️', title: 'Nhịp tim', desc: 'Nhịp tim lúc nghỉ' },
  { key: 'share_spo2', icon: '🩸', title: 'SpO2', desc: 'Độ bão hòa oxy trong máu' },
  { key: 'share_water', icon: '💧', title: 'Nước', desc: 'Lượng nước đã uống trong ngày' },
  { key: 'share_weight', icon: '⚖️', title: 'Cân nặng', desc: 'Cân nặng ghi nhận hôm nay' },
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
      load();
    }, [load]),
  );

  const toggle = async (patch: Partial<SharingSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    const ok = await saveMySharingSettings(patch);
    if (!ok) {
      Alert.alert('Lỗi', 'Không lưu được cài đặt.');
      load();
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
            load();
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
          <View style={s.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={[s.back, { color: theme.primaryDark }]}>‹</Text>
            </TouchableOpacity>
            <Text style={[s.headerTitle, { color: theme.text }]}>Cài đặt & Phân quyền chia sẻ</Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={[s.card, { backgroundColor: theme.card }]}>
            <View style={s.row}>
              <Text style={s.icon}>👨‍👩‍👧</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, { color: theme.text }]}>Chia sẻ sức khỏe với gia đình</Text>
                <Text style={[s.muted, { color: theme.muted }]}>
                  Khi tắt, người thân vẫn thấy tên bạn nhưng không xem được chỉ số.
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
            Nội dung được chia sẻ (áp dụng chung cho mọi người thân)
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
                <Text style={s.icon}>{row.icon}</Text>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 28, fontWeight: '800' },
  headerTitle: { fontSize: 16, fontWeight: '800', flex: 1, textAlign: 'center' },
  card: { borderRadius: 14, padding: 12, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  icon: { fontSize: 22 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  muted: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginTop: 16, marginBottom: 10 },
  initialCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 18, fontWeight: '800' },
  revoke: { fontWeight: '700' },
});
