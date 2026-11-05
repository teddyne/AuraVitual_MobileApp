import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { IconBadge } from '../../../components/ui/IconBadge';
import { formatSyncTime } from '../utils/stepsFormat';
import { useSettings } from '../../../context/SettingsContext';
import { styles } from '../screens/StepsDetailScreen.styles';

export type SensorStatus =
  'checking' | 'available' | 'denied' | 'unsupported' | 'manual' | 'error';

// The dong bo cam bien. Doi nguyen van tu StepsDetailScreen; chi nhan
// du lieu qua props, khong giu state.
export function StepsSyncCard({
  statusText,
  lastSyncAt,
  sensorNote,
  platformNote,
  sensorStatus,
  syncing,
  manualToday,
  onSync,
}: {
  statusText: string;
  lastSyncAt: string | null;
  sensorNote: string | null;
  platformNote: string;
  sensorStatus: SensorStatus;
  syncing: boolean;
  manualToday: boolean;
  onSync: (force: boolean) => void;
}) {
  const { t } = useSettings();
  return (
    <View style={styles.syncCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconBadge name='walk-outline' />
        <Text style={[styles.syncTitle, { flex: 1 }]}>{statusText}</Text>
      </View>
      <Text style={styles.syncText}>
        {lastSyncAt
          ? t('steps.lastSync', { time: formatSyncTime(lastSyncAt) })
          : t('steps.neverSynced')}
      </Text>
      {sensorNote ? <Text style={styles.syncText}>{sensorNote}</Text> : null}
      {sensorStatus === 'available' && platformNote ? (
        <Text style={styles.syncText}>{platformNote}</Text>
      ) : null}
      <View style={styles.syncRow}>
        <TouchableOpacity
          style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
          onPress={() => onSync(false)}
          disabled={syncing}
        >
          <Text style={styles.syncBtnText}>
            {syncing ? t('steps.syncing') : t('steps.syncAgain')}
          </Text>
        </TouchableOpacity>
        {sensorStatus === 'denied' ? (
          <TouchableOpacity
            style={styles.syncBtn}
            onPress={() => onSync(false)}
          >
            <Text style={styles.syncBtnText}>{t('steps.grantAgain')}</Text>
          </TouchableOpacity>
        ) : null}
        {manualToday ? (
          <TouchableOpacity
            style={styles.syncBtn}
            onPress={() => onSync(true)}
          >
            <Text style={styles.syncBtnText}>{t('steps.useAutoAgain')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
