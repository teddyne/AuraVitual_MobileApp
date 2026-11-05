import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ThemePalette } from '../../../context/SettingsContext';

// Banner SOS — chi UI theo yeu cau — trong FamilyDetailScreen (doi nguyen van).
export function FamilySosBanner({
  name,
  theme,
  onSettings,
}: {
  name: string;
  theme: ThemePalette;
  onSettings: () => void;
}) {
  return (
    <View style={[styles.sosCard, { backgroundColor: '#FFEBEE' }]}>
      <Text style={styles.sosIcon}>🛡</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.sosTitle, { color: theme.text }]}>Bảo vệ khẩn cấp SOS 24/7</Text>
        <Text style={[styles.sosBody, { color: theme.text }]}>
          Nếu phát hiện biến cố ngã té bất ngờ hoặc nhịp tim &gt; 130 BPM kéo dài khi nghỉ ngơi, AuraVital sẽ tự động gọi liên lạc ưu tiên, và chuyển vị trí trực tiếp của {name} đến bạn ngay lập tức.
        </Text>
        <View style={styles.sosFooter}>
          <Text style={[styles.sosStatus, { color: theme.muted }]}>Đang giám sát chủ động</Text>
          <TouchableOpacity onPress={onSettings}>
            <Text style={[styles.sosBtn, { color: theme.primaryDark }]}>⚙️ Cài đặt SOS</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sosCard: { flexDirection: 'row', borderRadius: 16, padding: 14, marginTop: 24, gap: 10 },
  sosIcon: { fontSize: 26 },
  sosTitle: { fontSize: 16, fontWeight: '800' },
  sosBody: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  sosFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  sosStatus: { fontSize: 12 },
  sosBtn: { fontSize: 13, fontWeight: '800' },
});
