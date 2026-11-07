import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../auth/AuthContext';
import { useSettings } from '../../../context/SettingsContext';
import { s } from './ProfileSettingsScreen.styles';
import { Row } from '../../../components/profile/SettingsRow';
import { supabase } from '../../../api/supabase';
import { useSubscription } from '../../../context/SubscriptionContext';
import { getPlanById } from '../../subscription/plans';
import {
  formatNumber,
  getProfile,
  type Profile,
  updateAvatarUrl,
} from '../../../api/auravitalApi';

// Bucket 'avatars' chưa tồn tại thì Storage trả 404 / NoSuchBucket.
// Nhận diện để hiện câu ngắn hướng dẫn tạo bucket, không dump JSON
// thô ({"statusCode":"404",...}) ra Alert.
const AVATAR_BUCKET_MISSING =
  /NoSuchBucket|Bucket not found|"statusCode"\s*:\s*404/i;

export default function ProfileSettingsScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const { theme, themeMode, setThemeMode, locale, setLocale, t, isDark } =
    useSettings();
  const { planId, refresh: refreshSubscription } = useSubscription();
  const currentPlan = getPlanById(planId);
  // Màu pill theo gói thật: Free = xanh lá (theme.primary), Pro = vàng
  // (theme.gold), Family = hồng. Nền/viền/chữ/icon đổi theo cả 3 nhánh
  // và theo sáng/tối (isDark) để không vỡ dark mode; không hard-code nền trắng.
  const planPill =
    currentPlan.id === 'pro'
      ? {
          accent: theme.gold,
          backgroundColor: isDark ? '#332D17' : '#FFF8E1',
          borderColor: theme.gold,
        }
      : currentPlan.id === 'family'
        ? {
            accent: isDark ? '#F48FB1' : '#C2185B',
            backgroundColor: isDark ? '#331E28' : '#FCE4EC',
            borderColor: isDark ? '#F48FB1' : '#C2185B',
          }
        : {
            accent: theme.primaryDark,
            backgroundColor: isDark ? theme.cardAlt : '#E8F5E9',
            borderColor: theme.primary,
          };
  const [profile, setProfile] = useState<Profile | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [avatarTick, setAvatarTick] = useState(0);

  // Đổi tài khoản / tải lại hồ sơ thì cho ảnh một cơ hội tải lại.
  useEffect(() => {
    setAvatarBroken(false);
  }, [profile?.avatar_url]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

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

  // Quay lại màn này sau khi thanh toán thì gói hiển thị phải là gói
  // mới: refresh lại subscription mỗi lần màn hình được focus.
  useFocusEffect(
    useCallback(() => {
      refreshSubscription().catch(() => {});
    }, [refreshSubscription]),
  );

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

  const changeAvatar = async () => {
    if (!user?.id) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        t('settings.avatarPermissionTitle'),
        t('settings.avatarPermissionDesc'),
      );
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (res.canceled || !res.assets?.[0]) return;
    try {
      setUploadingAvatar(true);
      const filePath = `${user.id}.jpg`;
      try {
        await supabase.storage.from('avatars').remove([filePath]);
      } catch {
        // bỏ qua
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error(t('settings.avatarSessionExpired'));
      }
      const uploadUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/avatars/${filePath}`;
      const up = await FileSystem.uploadAsync(
        uploadUrl,
        res.assets[0].uri,
        {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
            'Content-Type': 'image/jpeg',
            'x-upsert': 'true',
          },
        },
      );
      if (up.status !== 200) {
        if (up.status === 404 || AVATAR_BUCKET_MISSING.test(up.body ?? '')) {
          throw new Error(t('settings.avatarBucketMissing'));
        }
        throw new Error(
          t('settings.avatarServerError', {
            status: up.status,
            body: up.body ? ' — ' + up.body.slice(0, 300) : '',
          }),
        );
      }
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(`${user.id}.jpg`);
      await updateAvatarUrl(user.id, data.publicUrl);
      setProfile((p) => (p ? { ...p, avatar_url: data.publicUrl } : p));
      setAvatarBroken(false);
      setAvatarTick((t) => t + 1);
    } catch (e: any) {
      const raw = e?.message ?? '';
      Alert.alert(
        t('settings.avatarChangeFailed'),
        AVATAR_BUCKET_MISSING.test(raw)
          ? t('settings.avatarBucketMissing')
          : raw || t('settings.avatarTryLater'),
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const onLogout = () => {
    Alert.alert(t('settings.logoutConfirmTitle'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.logout'),
        style: 'destructive',
        onPress: async () => {
          await logout();
          getRootNav().replace('Login');
        },
      },
    ]);
  };
  const goSetup = () => getRootNav().navigate('ProfileSetup');
  // Mở trang Recommend không kèm params để nó load từ DB
  const goRecommend = () => getRootNav().navigate('Recommendation');
  // Mở trang nhắc nhở riêng, không code chung trong Settings
  const goReminders = () => getRootNav().navigate('Reminders');
  const goPlans = () => getRootNav().navigate('Plans');
  const goAiChat = () => getRootNav().navigate('AiChat');

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
            <TouchableOpacity onPress={changeAvatar} disabled={uploadingAvatar}>
              {profile.avatar_url && !avatarBroken ? (
                <View style={[s.avatar, { overflow: 'hidden' }]}>
                  <Image
                    source={{
                      uri: `${profile.avatar_url}${
                        profile.avatar_url.includes('?') ? '&' : '?'
                      }v=${avatarTick}`,
                    }}
                    style={{ width: 84, height: 84 }}
                    onError={() => setAvatarBroken(true)}
                  />
                </View>
              ) : (
                <View style={[s.avatar, { backgroundColor: theme.primary }]}>
                  <Text style={s.avatarText}>{initials}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={changeAvatar} disabled={uploadingAvatar}>
              <Text
                style={{
                  color: theme.primaryDark,
                  fontWeight: '700',
                  marginTop: 8,
                }}
              >
                {uploadingAvatar
                  ? t('settings.avatarUploading')
                  : t('settings.changeAvatar')}
              </Text>
            </TouchableOpacity>
            <Text style={[s.name, { color: theme.text }]}>
              {profile.display_name}
            </Text>
            <Text style={{ color: theme.muted }}>{user?.email ?? ''}</Text>
            {memberSince ? (
              <Text style={{ color: theme.muted }}>
                {t('settings.memberSince')} {memberSince}
              </Text>
            ) : null}
            <TouchableOpacity
              style={[
                s.goldPill,
                {
                  backgroundColor: planPill.backgroundColor,
                  borderColor: planPill.borderColor,
                  borderWidth: 1,
                },
              ]}
              onPress={goPlans}
              accessibilityRole='button'
            >
              <Ionicons name='star' size={14} color={planPill.accent} />
              <Text style={[s.gold, { color: planPill.accent }]}>
                {currentPlan.name}
              </Text>
              <Text style={[s.planSub, { color: planPill.accent }]}>
                {currentPlan.id === 'free'
                  ? t('subscription.viewPlans')
                  : t('subscription.currentPlan')}
              </Text>
              <Ionicons
                name='chevron-forward'
                size={16}
                color={planPill.accent}
              />
            </TouchableOpacity>
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
            sub={age == null ? undefined : t('settings.ageYears', { age })}
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
            onPress={() => setLangOpen((v) => !v)}
          />
          {langOpen &&
            languageOptions.map((o) => (
              <TouchableOpacity
                key={o.id}
                style={[s.row, { backgroundColor: theme.card }]}
                onPress={() => {
                  setLocale(o.id);
                  setLangOpen(false);
                }}
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
            onPress={goAiChat}
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

