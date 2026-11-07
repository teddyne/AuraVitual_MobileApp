import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type TextInputInstance,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../theme/colors';
import { useAuth } from '../AuthContext';
import { supabase } from '../../../api/supabase';
import { getProfile } from '../../../api/auravitalApi';
import {
  getPendingDeepLink,
  clearPendingDeepLink,
} from '../../../navigation/pendingDeepLink';
import { AuthField } from '../../../components/auth/AuthField';
import { BG } from '../constants';
import { useSettings } from '../../../context/SettingsContext';
import { styles } from './ResetPasswordScreen.styles';

type Status = 'checking' | 'ready' | 'invalid';

export default function ResetPasswordScreen() {
  const navigation = useNavigation<any>();
  const { t } = useSettings();
  const { updatePassword } = useAuth();
  const [status, setStatus] = useState<Status>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const confirmRef = useRef<TextInputInstance>(null);
  // Focus trễ 1 nhịp: tránh bị nuốt focus trên Android khi gọi ngay
  // trong onSubmitEditing của ô mật khẩu.
  const focusConfirm = () => {
    setTimeout(() => {
      confirmRef.current?.focus();
    }, 50);
  };
  const exchangedCodeRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Đổi code trong deep link lấy session khôi phục. Trả về true nếu
    // đã xử lý xong một code (thành công hay thất bại), false nếu URL
    // không chứa code.
    const handleUrl = async (url: string): Promise<boolean> => {
      const { queryParams } = Linking.parse(url);
      const code = queryParams?.code;
      if (typeof code !== 'string' || code.length === 0) return false;
      if (exchangedCodeRef.current === code) return true;
      exchangedCodeRef.current = code;
      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);
      if (!mountedRef.current) return true;
      if (exchangeError) {
        setStatus('invalid');
        return true;
      }
      setStatus('ready');
      return true;
    };

    const init = async () => {
      try {
        // Ưu tiên link mà App.tsx đã lưu sẵn (trường hợp app đang chạy nền:
        // getInitialURL() trả null và listener gắn sau sẽ bỏ lỡ sự kiện).
        // Chỉ nhận link đặt lại mật khẩu, không nhận link OAuth auth/callback.
        const pendingUrl = getPendingDeepLink();
        if (pendingUrl && pendingUrl.includes('ResetPassword')) {
          clearPendingDeepLink();
          if (await handleUrl(pendingUrl)) return;
        }
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && (await handleUrl(initialUrl))) return;
        const { data } = await supabase.auth.getSession();
        if (!mountedRef.current) return;
        // Mở màn khi đã có session (ví dụ Supabase đã đổi link thành
        // session trước đó) thì coi là sẵn sàng, không cần code nữa.
        setStatus(data.session ? 'ready' : 'invalid');
      } catch {
        if (mountedRef.current) setStatus('invalid');
      }
    };

    init();
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });
    return () => {
      mountedRef.current = false;
      subscription.remove();
    };
  }, []);

  const submit = async () => {
    if (submitting || status !== 'ready') return;
    if (password.length < 8) {
      setError(t('auth.validation.passwordMin8'));
      return;
    }
    if (confirm !== password) {
      setError(t('auth.validation.confirmMismatch'));
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await updatePassword(password);
      if (!res.ok) {
        setError(res.message ?? t('auth.reset.failed'));
        return;
      }
      Alert.alert(t('auth.reset.successTitle'), t('auth.reset.successBody'), [
        {
          text: t('auth.reset.continue'),
          onPress: async () => {
            const { data } = await supabase.auth.getSession();
            const userId = data.session?.user?.id;
            if (!userId) {
              navigation.replace('Login');
              return;
            }
            const profile = await getProfile(userId);
            navigation.replace(profile ? 'Main' : 'ProfileSetup');
          },
        },
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmOk = confirm.length > 0 && confirm === password;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: BG }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.root}>
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                hitSlop={8}
                accessibilityLabel={t('common.back')}
              >
                <Ionicons name="chevron-back" size={30} color={colors.ink} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>
                {t('auth.reset.title')}
              </Text>
              <View style={styles.headerSpacer} />
            </View>

            {status === 'checking' ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={colors.sageDark} />
                <Text style={styles.centerText}>
                  {t('auth.reset.checkingLink')}
                </Text>
              </View>
            ) : status === 'invalid' ? (
              <View style={styles.centerBox}>
                <Ionicons
                  name="alert-circle-outline"
                  size={64}
                  color={colors.danger}
                />
                <Text style={styles.invalidTitle}>
                  {t('auth.reset.invalidTitle')}
                </Text>
                <Text style={styles.invalidText}>
                  {t('auth.reset.invalidBody')}
                </Text>
                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={() => navigation.navigate('ForgotPassword')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.submitBtnText}>
                    {t('auth.reset.resendLink')}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color={colors.white}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.textBtn}
                  onPress={() => navigation.navigate('Login')}
                >
                  <Text style={styles.textBtnText}>
                    {t('auth.backToLogin')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.title}>
                  {t('auth.reset.heading')}
                </Text>
                <Text style={styles.sub}>{t('auth.reset.subtitle')}</Text>

                <View style={styles.formCard}>
                  {error ? <Text style={styles.error}>{error}</Text> : null}

                  <AuthField
                    label={t('auth.fields.newPassword')}
                    icon="lock-closed-outline"
                    value={password}
                    onChangeText={setPassword}
                    placeholder={t('auth.fields.newPasswordPlaceholder')}
                    secureTextEntry={!showPass}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={focusConfirm}
                    blurOnSubmit={false}
                    right={
                      <TouchableOpacity
                        onPress={() => setShowPass(!showPass)}
                        hitSlop={8}
                        accessibilityLabel={
                          showPass
                            ? t('auth.fields.hidePassword')
                            : t('auth.fields.showPassword')
                        }
                      >
                        <Ionicons
                          name={showPass ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color="#7A8A7A"
                        />
                      </TouchableOpacity>
                    }
                  />

                  <AuthField
                    label={t('auth.fields.confirmPassword')}
                    icon="shield-checkmark-outline"
                    value={confirm}
                    onChangeText={setConfirm}
                    placeholder={t('auth.fields.confirmNewPasswordPlaceholder')}
                    secureTextEntry={!showConfirm}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={submit}
                    blurOnSubmit
                    inputRef={confirmRef}
                    right={
                      <>
                        {confirm.length > 0 ? (
                          <Ionicons
                            name={confirmOk ? 'checkmark' : 'close'}
                            size={20}
                            color={confirmOk ? colors.sage : colors.danger}
                            style={styles.checkIcon}
                          />
                        ) : null}
                        <TouchableOpacity
                          onPress={() => setShowConfirm(!showConfirm)}
                          hitSlop={8}
                          accessibilityLabel={
                            showConfirm
                              ? t('auth.fields.hideConfirmPassword')
                              : t('auth.fields.showConfirmPassword')
                          }
                        >
                          <Ionicons
                            name={
                              showConfirm ? 'eye-off-outline' : 'eye-outline'
                            }
                            size={20}
                            color="#7A8A7A"
                          />
                        </TouchableOpacity>
                      </>
                    }
                  />

                  <TouchableOpacity
                    style={[
                      styles.submitBtn,
                      submitting && styles.submitBtnDisabled,
                    ]}
                    onPress={submit}
                    disabled={submitting}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.submitBtnText}>
                      {submitting
                        ? t('auth.reset.saving')
                        : t('auth.reset.submit')}
                    </Text>
                    {!submitting ? (
                      <Ionicons
                        name="arrow-forward"
                        size={18}
                        color={colors.white}
                      />
                    ) : null}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
