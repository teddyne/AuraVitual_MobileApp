import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSettings, type ThemePalette } from '../../context/SettingsContext';
import { AppIcon } from '../ui/AppIcon';

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
  const { t } = useSettings();
  return (
    <View style={[styles.sosCard, { backgroundColor: '#FFEBEE' }]}>
      <AppIcon name='shield-outline' size={26} tone='danger' />
      <View style={{ flex: 1 }}>
        <Text style={[styles.sosTitle, { color: theme.text }]}>{t('family.sosTitle')}</Text>
        <Text style={[styles.sosBody, { color: theme.text }]}>
          {t('family.sosBody', { name })}
        </Text>
        <View style={styles.sosFooter}>
          <Text style={[styles.sosStatus, { color: theme.muted }]}>{t('family.sosMonitoring')}</Text>
          <TouchableOpacity onPress={onSettings}>
            <Text style={[styles.sosBtn, { color: theme.primaryDark }]}>{t('family.sosSettings')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sosCard: { flexDirection: 'row', borderRadius: 16, padding: 14, marginTop: 16, gap: 10 },
  sosTitle: { fontSize: 16, fontWeight: '800' },
  sosBody: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  sosFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  sosStatus: { fontSize: 12 },
  sosBtn: { fontSize: 13, fontWeight: '800' },
});
