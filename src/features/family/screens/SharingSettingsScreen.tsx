import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSettings } from '../../../context/SettingsContext';
import { useSubscription } from '../../../context/SubscriptionContext';
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
} from '../../../api/familyApi';
import { CONTENT_ROWS } from '../constants';
import { SharingMemberRow } from '../../../components/family/SharingMemberRow';
import { AppIcon } from '../../../components/ui/AppIcon';
import { IconBadge } from '../../../components/ui/IconBadge';
import { s } from './SharingSettingsScreen.styles';

export default function SharingSettingsScreen({ navigation }: any) {
  const { theme, t } = useSettings();
  // Cài đặt chia sẻ chỉ mở với gói Family; Free/Pro thấy màn khóa.
  const { canShare } = useSubscription();
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
      Alert.alert(t('family.errorTitle'), t('family.settingsSaveFailed'));
      void load();
    }
  };

  const onRevoke = (m: FamilyMember) => {
    Alert.alert(
      t('family.revoke'),
      t('family.revokeBody', { name: displayNameOf(m) }),
      [
        { text: t('family.keep'), style: 'cancel' },
        {
          text: t('family.revoke'),
          style: 'destructive',
          onPress: async () => {
            const ok = await revokeLink(m.ownerId);
            if (!ok) Alert.alert(t('family.errorTitle'), t('family.revokeFailed'));
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

  // Chưa phải gói Family: chỉ hiện màn khóa, giữ nguyên mọi hàm bên dưới
  // (load, toggle, onRevoke).
  if (!canShare) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
          <View style={[s.lockWrap, { padding: 16 }]}>
            <View style={[s.lockCard, { backgroundColor: theme.card }]}>
              <Ionicons name='lock-closed' size={48} color={theme.primaryDark} />
              <Text style={[s.lockTitle, { color: theme.text }]}>
                {t('family.shareLockedTitle')}
              </Text>
              <Text style={[s.lockBody, { color: theme.muted }]}>
                {t('family.shareLockedBody')}
              </Text>
              <TouchableOpacity
                style={[s.lockBtn, { backgroundColor: theme.primaryDark }]}
                onPress={() => navigation.navigate('Plans')}
              >
                <Text style={s.lockBtnText}>{t('subscription.viewPlans')}</Text>
              </TouchableOpacity>
            </View>
          </View>
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
              {t('family.settingsTitle')}
            </Text>
          </View>

          <View style={[s.card, { backgroundColor: theme.card }]}>
            <View style={s.row}>
              <IconBadge name='people-outline' />
              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, { color: theme.text }]}>{t('family.shareHealth')}</Text>
                <Text style={[s.muted, { color: theme.muted }]}>
                  {t('family.shareHealthDesc')}
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
            {t('family.sharedContent')}
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
                <AppIcon name={row.icon as any} size='md' tone='primaryDark' />
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowTitle, { color: theme.text }]}>{t(row.titleKey)}</Text>
                  <Text style={[s.muted, { color: theme.muted }]}>{t(row.descKey)}</Text>
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

          <Text style={[s.sectionTitle, { color: theme.text }]}>{t('family.connectedMembers')}</Text>
          {members.length === 0 ? (
            <Text style={[s.muted, { color: theme.muted }]}>
              {t('family.noMembersYet')}
            </Text>
          ) : (
            members.map((m) => (
              <SharingMemberRow
                key={m.ownerId}
                member={m}
                theme={theme}
                onRevoke={() => onRevoke(m)}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
