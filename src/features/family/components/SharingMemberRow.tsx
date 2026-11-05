import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSettings, type ThemePalette } from '../../../context/SettingsContext';
import { displayNameOf, type FamilyMember } from '../../../lib/familyApi';

// Hang thanh vien da ket noi trong SharingSettingsScreen (doi nguyen van).
export function SharingMemberRow({
  member: m,
  theme,
  onRevoke,
}: {
  member: FamilyMember;
  theme: ThemePalette;
  onRevoke: () => void;
}) {
  const { t } = useSettings();
  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <View style={styles.row}>
        <View style={[styles.initialCircle, { backgroundColor: theme.cardAlt }]}>
          <Text style={[styles.initial, { color: theme.primaryDark }]}>
            {displayNameOf(m).charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: theme.text }]}>{displayNameOf(m)}</Text>
          {m.nickname && m.nickname !== m.displayName && (
            <Text style={[styles.muted, { color: theme.muted }]}>{m.displayName}</Text>
          )}
        </View>
        <TouchableOpacity onPress={onRevoke}>
          <Text style={[styles.revoke, { color: '#C62828' }]}>{t('family.revoke')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: 12, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  muted: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  initialCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 18, fontWeight: '800' },
  revoke: { fontWeight: '700' },
});
