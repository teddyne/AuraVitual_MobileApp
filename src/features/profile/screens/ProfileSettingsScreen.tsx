import React, { useEffect, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import { useSettings } from '../../../context/SettingsContext';
import {
  formatNumber,
  getProfile,
  type Profile,
} from '../../../lib/auravitalApi';

// Icon kiểu ảnh bạn gửi: vòng tròn nhạt + icon xanh đậm.
// solid = true thì vòng xanh đặc + icon trắng (dùng cho hàng Chat).
function Row({ icon, solid, title, sub, right, onPress, theme, dark }: any) {
  const iconBg = solid ? '#2E7D32' : dark ? theme.cardAlt : '#EAF0FF';
  const iconColor = solid ? '#fff' : '#2E7D32';
  return (
    <TouchableOpacity
      style={[s.row, { backgroundColor: theme.card }]}
      onPress={
        onPress ||
        (() =>
          Alert.alert(
            'Chưa làm',
            'Mục này chưa nối dữ liệu thật, chỉ là hàng giao diện.',
          ))
      }
    >
      <View style={[s.iconBadge, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowTitle, { color: theme.text }]}>{title}</Text>
        {sub && <Text style={[s.muted, { color: theme.muted }]}>{sub}</Text>}
      </View>
      {right ? (
        <Text style={[s.rowRight, { color: theme.primaryDark }]}>{right}</Text>
      ) : (
        <Ionicons name='chevron-forward' size={20} color={theme.muted} />
      )}
    </TouchableOpacity>
  );
}

export default function ProfileSettingsScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const { theme, themeMode, setThemeMode, locale, setLocale, t, isDark } =
    useSettings();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Lấy navigator gốc (Stack) để navigate tới ProfileSetup /
  // Recommendation / Reminders cho đúng, không bị kẹt ở Tab.
  const getRootNav = () => {
    let root: any = navigation;
    while (root.getParent && root.getParent()) root = root.getParent();
    return root;
  };

  useEffect(() => {
    if (!user) return;
    getProfile(user.id)
      .then(setProfile)
      .catch((e) => Alert.alert(t('common.errorTitle'), e.message))
      .finally(() => setLoading(false));
  }, [user]);

  const onRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const p = await getProfile(user.id);
      setProfile(p);
    } catch (e: any) {
      Alert.alert(t('common.errorTitle'), e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const onLogout = async () => {
    await logout();
    getRootNav().replace('Login');
  };
  const goSetup = () => getRootNav().navigate('ProfileSetup');
  // Mở trang Recommend không kèm params để nó load từ DB
  const goRecommend = () => getRootNav().navigate('Recommendation');
  // Mở trang nhắc nhở riêng, không code chung trong Settings
  const goReminders = () => getRootNav().navigate('Reminders');

  if (loading)
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
          <View style={s.center}>
            <Text style={{ color: theme.text }}>
              {t('settings.loadingProfile')}
            </Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  if (!profile) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
          <View style={s.center}>
            <Text style={[s.name, { color: theme.text }]}>
              {t('settings.noProfile')}
            </Text>
            <TouchableOpacity
              style={[s.logout, { backgroundColor: theme.cardAlt }]}
              onPress={goSetup}
            >
              <Text style={[s.logoutText, { color: theme.primaryDark }]}>
                {t('settings.setupProfile')}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const initials = profile.display_name
    .trim()
    .split(' ')
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();
  const createdAt = (profile as any).created_at as string | undefined;
  const memberSince = createdAt
    ? new Date(createdAt).toLocaleDateString(
        locale === 'vi' ? 'vi-VN' : 'en-US',
        { month: 'long', year: 'numeric' },
      )
    : '';

  // Chỉ Sáng / Tối, bỏ Theo hệ thống khỏi giao diện
  const themeOptions = [
    {
      id: 'light' as const,
      label: t('settings.themeLight'),
      icon: 'sunny-outline',
    },
    {
      id: 'dark' as const,
      label: t('settings.themeDark'),
      icon: 'moon-outline',
    },
  ];
  const languageOptions = [
    { id: 'vi' as const, label: t('settings.languageVi') },
    { id: 'en' as const, label: t('settings.languageEn') },
  ];

  // BMI tính trực tiếp, không lưu trong DB
  const bmi =
    profile.height_cm && profile.weight_kg
      ? (profile.weight_kg / (profile.height_cm / 100) ** 2).toFixed(1)
      : null;

  // Ngày sinh: tách YYYY-MM-DD thủ công để khỏi lệch ngày do múi giờ
  const dobRaw = (profile as any).date_of_birth as string | null | undefined;
  let birthDisplay = '';
  let age: number | null = null;
  if (dobRaw) {
    const [y, m, d] = dobRaw.split('-').map(Number);
    if (y && m && d) {
      birthDisplay = locale === 'vi' ? `${d}/${m}/${y}` : `${m}/${d}/${y}`;
      const today = new Date();
      age = today.getFullYear() - y;
      if (
        today.getMonth() + 1 < m ||
        (today.getMonth() + 1 === m && today.getDate() < d)
      ) {
        age -= 1;
      }
      if (age < 0) age = null;
    }
  }
  const notSet = t('settings.notSet');

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
        <ScrollView
          style={[s.wrap, { backgroundColor: theme.background }]}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#4E8A47']}
              tintColor={theme.primaryDark}
            />
          }
        >
          <View style={[s.header, { backgroundColor: theme.cardAlt }]}>
            <View style={[s.avatar, { backgroundColor: theme.primary }]}>
              <Text style={s.avatarText}>{initials}</Text>
            </View>
            <Text style={[s.name, { color: theme.text }]}>
              {profile.display_name}
            </Text>
            <Text style={{ color: theme.muted }}>{user?.email ?? ''}</Text>
            {memberSince ? (
              <Text style={{ color: theme.muted }}>
                {t('settings.memberSince')} {memberSince}
              </Text>
            ) : null}
            <View style={s.goldPill}>
              <Ionicons name='star' size={14} color='#B8860B' />
              <Text style={[s.gold, { color: theme.gold }]}>
                AuraVital Gold
              </Text>
            </View>
          </View>

          {/* Mục tiêu: tiêu đề trái, link Cập nhật mục tiêu phải -> Recommend */}
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: theme.muted }]}>
              {t('settings.goalsSection')}
            </Text>
            <TouchableOpacity onPress={goRecommend}>
              <Text style={[s.updateLink, { color: theme.primaryDark }]}>
                {t('settings.update')}
              </Text>
            </TouchableOpacity>
          </View>
          <Row
            theme={theme}
            dark={isDark}
            icon='flame-outline'
            title={t('settings.kcalPerDay')}
            right={
              profile.calorie_goal == null
                ? notSet
                : `${formatNumber(profile.calorie_goal)} kcal`
            }
            onPress={goRecommend}
          />
          <Row
            theme={theme}
            dark={isDark}
            icon='footsteps-outline'
            title={t('settings.stepsPerDay')}
            right={
              profile.step_goal == null
                ? notSet
                : formatNumber(profile.step_goal)
            }
            onPress={goRecommend}
          />
          <Row
            theme={theme}
            dark={isDark}
            icon='water-outline'
            title={t('settings.waterPerDay')}
            right={
              profile.water_goal_ml == null
                ? notSet
                : `${formatNumber(profile.water_goal_ml)} ml`
            }
            onPress={goRecommend}
          />
          <Row
            theme={theme}
            dark={isDark}
            icon='moon-outline'
            title={t('settings.sleepPerDay')}
            right={
              profile.sleep_goal_hours == null
                ? notSet
                : `${profile.sleep_goal_hours}h`
            }
            onPress={goRecommend}
          />

          <Text style={[s.section, { color: theme.muted }]}>
            {t('settings.metricsSection')}
          </Text>
          <Row
            theme={theme}
            dark={isDark}
            icon='expand-outline'
            title={t('settings.height')}
            right={
              profile.height_cm == null ? notSet : `${profile.height_cm} cm`
            }
            onPress={goSetup}
          />
          <Row
            theme={theme}
            dark={isDark}
            icon='barbell-outline'
            title={t('settings.weight')}
            right={
              profile.weight_kg == null ? notSet : `${profile.weight_kg} kg`
            }
            onPress={goSetup}
          />
          <Row
            theme={theme}
            dark={isDark}
            icon='calculator-outline'
            title={t('settings.bmi')}
            right={bmi ?? notSet}
            onPress={goSetup}
          />
          <Row
            theme={theme}
            dark={isDark}
            icon='calendar-outline'
            title={t('settings.birthDate')}
            sub={
              age == null
                ? undefined
                : locale === 'vi'
                  ? `${age} tuổi`
                  : `${age} years old`
            }
            right={birthDisplay || notSet}
            onPress={goSetup}
          />

          <Text style={[s.section, { color: theme.muted }]}>
            {t('settings.deviceSection')}
          </Text>
          <Row
            theme={theme}
            dark={isDark}
            icon='watch-outline'
            title={t('settings.device')}
            sub={t('settings.deviceDesc')}
          />

          <Text style={[s.section, { color: theme.muted }]}>
            {t('settings.lifestyleSection')}
          </Text>
          <Row
            theme={theme}
            dark={isDark}
            icon='notifications-outline'
            title={t('settings.notifications')}
            sub={t('settings.notificationsDesc')}
            onPress={goReminders}
          />
          <Row
            theme={theme}
            dark={isDark}
            icon='shield-checkmark-outline'
            title={t('settings.privacy')}
            sub={t('settings.privacyDesc')}
          />

          <Text style={[s.section, { color: theme.muted }]}>
            {t('settings.interfaceSection')}
          </Text>
          <View style={[s.themeRow, { backgroundColor: theme.card }]}>
            <View style={s.themeRowLeft}>
              <View
                style={[
                  s.iconBadge,
                  { backgroundColor: isDark ? theme.cardAlt : '#EAF0FF' },
                ]}
              >
                <Ionicons name='contrast-outline' size={22} color='#2E7D32' />
              </View>
              <Text style={[s.rowTitle, { color: theme.text }]}>
                {t('settings.theme')}
              </Text>
            </View>
            <View style={s.themeBtns}>
              {themeOptions.map((o) => (
                <TouchableOpacity
                  key={o.id}
                  style={[
                    s.themeBtn,
                    { backgroundColor: theme.cardAlt },
                    themeMode === o.id && {
                      backgroundColor: theme.primaryDark,
                    },
                  ]}
                  onPress={() => setThemeMode(o.id)}
                >
                  <Ionicons
                    name={o.icon as any}
                    size={16}
                    color={themeMode === o.id ? '#fff' : theme.text}
                  />
                  <Text
                    style={[
                      s.themeText,
                      { color: theme.text },
                      themeMode === o.id && { color: '#fff' },
                    ]}
                  >
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Row
            theme={theme}
            dark={isDark}
            icon='globe-outline'
            title={t('settings.language')}
            sub={t('settings.languageDesc')}
            right={
              locale === 'vi'
                ? t('settings.languageVi')
                : t('settings.languageEn')
            }
          />
          {languageOptions.map((o) => (
            <TouchableOpacity
              key={o.id}
              style={[s.row, { backgroundColor: theme.card }]}
              onPress={() => setLocale(o.id)}
            >
              <Text style={[s.rowTitle, { color: theme.text, flex: 1 }]}>
                {o.label}
              </Text>
              {locale === o.id && (
                <Ionicons
                  name='checkmark'
                  size={20}
                  color={theme.primaryDark}
                />
              )}
            </TouchableOpacity>
          ))}

          <Text style={[s.section, { color: theme.muted }]}>
            {t('settings.supportSection')}
          </Text>
          <Row
            theme={theme}
            dark={isDark}
            icon='help-circle-outline'
            title={t('settings.support')}
            sub={t('settings.supportDesc')}
          />
          <Row
            theme={theme}
            dark={isDark}
            icon='headset-outline'
            solid
            title={t('settings.chat')}
            sub={t('settings.chatDesc')}
          />

          <TouchableOpacity
            style={[s.logout, { backgroundColor: theme.card }]}
            onPress={onLogout}
          >
            <View style={s.logoutContent}>
              <Ionicons name='log-out-outline' size={20} color={theme.danger} />
              <Text style={[s.logoutText, { color: theme.danger }]}>
                {t('settings.logout')}
              </Text>
            </View>
          </TouchableOpacity>
          <Text style={[s.footer, { color: theme.muted }]}>
            AuraVital Wellness v2.4.1 (Build 164)
          </Text>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  wrap: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: { alignItems: 'center', borderRadius: 24, padding: 20 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 24 },
  name: { fontSize: 20, fontWeight: '800', marginTop: 10 },
  muted: { lineHeight: 18, marginTop: 2 },
  goldPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF8E1',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 10,
  },
  gold: { fontWeight: '800' },
  section: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  updateLink: { fontWeight: '800', fontSize: 13 },
  row: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 12,
    marginTop: 8,
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontWeight: '800', fontSize: 15 },
  rowRight: { fontWeight: '700' },
  themeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    marginTop: 8,
  },
  themeRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  themeBtns: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  themeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  themeText: { fontWeight: '700' },
  logout: {
    borderRadius: 999,
    padding: 14,
    marginTop: 24,
    alignItems: 'center',
  },
  logoutContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoutText: { fontWeight: '800' },
  footer: { textAlign: 'center', fontSize: 12, marginTop: 12, lineHeight: 17 },
});
