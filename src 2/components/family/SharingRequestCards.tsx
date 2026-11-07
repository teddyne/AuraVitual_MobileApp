import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSettings, type ThemePalette } from '../../context/SettingsContext';
import type { FamilyRequest } from '../../api/familyApi';

// The loi moi nhan / da gui trong SharingScreen (doi nguyen van).
export function ReceivedRequestCard({
  request: r,
  theme,
  onAccept,
  onDecline,
}: {
  request: FamilyRequest;
  theme: ThemePalette;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { t } = useSettings();
  return (
    <View style={[styles.reqCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.reqText, { color: theme.text }]}>
        <Text style={{ fontWeight: '800' }}>{r.fromName}</Text> {t('family.requestReceivedSuffix')}
      </Text>
      <View style={styles.reqBtns}>
        <TouchableOpacity
          onPress={onAccept}
          style={[styles.acceptBtn, { backgroundColor: theme.primaryDark }]}
        >
          <Text style={styles.acceptText}>{t('family.accept')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDecline}
          style={[styles.declineBtn, { borderColor: theme.border }]}
        >
          <Text style={[styles.declineText, { color: theme.text }]}>{t('family.decline')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function SentRequestCard({
  request: r,
  theme,
  onDismiss,
}: {
  request: FamilyRequest;
  theme: ThemePalette;
  onDismiss: () => void;
}) {
  const { t } = useSettings();
  return (
    <View style={[styles.reqCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.reqText, { color: theme.text }]}>
        {r.status === 'declined' ? (
          <>
            <Text style={{ fontWeight: '800' }}>{r.toName ?? t('family.recipientFallback')}</Text> {t('family.requestDeclinedSuffix')}
          </>
        ) : (
          <>
            {t('family.requestPendingPrefix')} <Text style={{ fontWeight: '800' }}>{r.toName ?? t('family.recipientFallbackLower')}</Text> {t('family.requestPendingSuffix')}
          </>
        )}
      </Text>
      {r.status === 'declined' && (
        <TouchableOpacity onPress={onDismiss}>
          <Text style={[styles.dismiss, { color: theme.primaryDark }]}>{t('family.hide')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  reqCard: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
  reqText: { fontSize: 14, lineHeight: 20 },
  reqBtns: { flexDirection: 'row', gap: 10, marginTop: 10 },
  acceptBtn: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18 },
  acceptText: { color: '#FFFFFF', fontWeight: '800' },
  declineBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18 },
  declineText: { fontWeight: '700' },
  dismiss: { fontWeight: '700', marginTop: 8 },
});
