import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSettings, type ThemePalette } from '../../context/SettingsContext';

// Hop dat biet danh ngay sau khi Dong y loi moi (doi nguyen van tu SharingScreen).
export function SharingNicknameBox({
  name,
  value,
  theme,
  onChangeText,
  onSave,
  onDismiss,
}: {
  name: string;
  value: string;
  theme: ThemePalette;
  onChangeText: (v: string) => void;
  onSave: () => void;
  onDismiss: () => void;
}) {
  const { t } = useSettings();
  return (
    <View style={[styles.nickBox, { backgroundColor: '#E8F5E9', borderColor: theme.primaryDark }]}>
      <Text style={[styles.nickTitle, { color: theme.text }]}>
        {t('family.nickConnected', { name })}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={t('family.nickExample')}
        placeholderTextColor={theme.muted}
        maxLength={30}
        style={[styles.nickInput, { backgroundColor: '#FFFFFF', color: theme.text }]}
      />
      <View style={styles.reqBtns}>
        <TouchableOpacity
          onPress={onSave}
          style={[styles.acceptBtn, { backgroundColor: theme.primaryDark }]}
        >
          <Text style={styles.acceptText}>{t('family.saveNick')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDismiss}>
          <Text style={[styles.declineText, { color: theme.muted }]}>{t('family.later')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nickBox: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
  nickTitle: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  nickInput: { borderRadius: 10, padding: 10, marginTop: 10, fontSize: 15 },
  reqBtns: { flexDirection: 'row', gap: 10, marginTop: 10 },
  acceptBtn: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18 },
  acceptText: { color: '#FFFFFF', fontWeight: '800' },
  declineText: { fontWeight: '700' },
});
