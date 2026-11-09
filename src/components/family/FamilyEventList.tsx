import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSettings, type ThemePalette } from '../../context/SettingsContext';
import { AppIcon } from '../ui/AppIcon';
import type { MemberEvent } from '../../api/familyApi';

// Cum Lich su su kien hom nay trong FamilyDetailScreen (doi nguyen van).
export function FamilyEventList({
  events,
  theme,
}: {
  events: MemberEvent[];
  theme: ThemePalette;
}) {
  const { t } = useSettings();
  if (events.length === 0) {
    return (
      <Text style={[styles.notice, { color: theme.muted }]}>
        {t('family.eventsEmpty')}
      </Text>
    );
  }
  return (
    <>
      {events.map((e) => (
        <View key={e.id} style={[styles.eventCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.eventIcon, { backgroundColor: theme.cardAlt }]}>
            <AppIcon name={e.icon} size={22} tone='primaryDark' />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eventTitle, { color: theme.primaryDark }]}>{e.title}</Text>
            <Text style={[styles.eventSub, { color: theme.text }]}>{e.subtitle}</Text>
            <Text style={[styles.eventBody, { color: theme.muted }]}>{e.body}</Text>
          </View>
          <Text style={[styles.eventTime, { color: theme.muted }]}>{t('home.today')}</Text>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  notice: { fontSize: 14, lineHeight: 20 },
  eventCard: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8, gap: 10 },
  eventIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  eventTitle: { fontSize: 12, fontWeight: '800' },
  eventSub: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  eventBody: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  eventTime: { fontSize: 12 },
});
