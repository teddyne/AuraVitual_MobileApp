import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { supabase } from '../../../lib/supabase';
import { getProfile } from '../../../lib/auravitalApi';
import {
  getPendingDeepLink,
  clearPendingDeepLink,
} from '../../../lib/pendingDeepLink';

const BG = '#F9F9FF';
const INPUT_BG = '#EEF1FF';
const BUTTON_GREEN = '#4E8A47';

type Status = 'checking' | 'ready' | 'invalid';

// Ô nhập đúng kiểu màn Login: label in hoa, ô nền xanh nhạt, không viền.
function ResetField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  returnKeyType,
  onSubmitEditing,
  blurOnSubmit,
  inputRef,
  right,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  returnKeyType?: 'done' | 'go' | 'next';
  onSubmitEditing?: () => void;
  blurOnSubmit?: boolean;
  inputRef?: React.RefObject<TextInputInstance | null>;
  right?: ReactNode;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputBox}>
        <Ionicons name={icon} size={20} color="#7A8A7A" style={styles.icon} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          secureTextEntry={secureTextEntry}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
        />
        {right}
      </View>
    </View>
  );
}

export default function ResetPasswordScreen() {
  const navigation = useNavigation<any>();
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
      setError('Mật khẩu phải từ 8 ký tự trở lên.');
      return;
    }
    if (confirm !== password) {
      setError('Xác nhận mật khẩu chưa khớp.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await updatePassword(password);
      if (!res.ok) {
        setError(res.message ?? 'Đổi mật khẩu thất bại.');
        return;
      }
      Alert.alert('Đổi mật khẩu thành công', 'Hãy đăng nhập lại bằng mật khẩu mới nếu app yêu cầu.', [
        {
          text: 'Tiếp tục',
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
                accessibilityLabel="Quay lại"
              >
                <Ionicons name="chevron-back" size={30} color={colors.ink} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Đặt lại mật khẩu</Text>
              <View style={styles.headerSpacer} />
            </View>

            {status === 'checking' ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={colors.sageDark} />
                <Text style={styles.centerText}>Đang kiểm tra link...</Text>
              </View>
            ) : status === 'invalid' ? (
              <View style={styles.centerBox}>
                <Ionicons
                  name="alert-circle-outline"
                  size={64}
                  color={colors.danger}
                />
                <Text style={styles.invalidTitle}>
                  Link không hợp lệ hoặc đã hết hạn
                </Text>
                <Text style={styles.invalidText}>
                  Link đặt lại mật khẩu chỉ dùng được một lần và có thời hạn.
                  Hãy gửi lại link mới rồi mở link trong email để tiếp tục.
                </Text>
                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={() => navigation.navigate('ForgotPassword')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.submitBtnText}>Gửi lại link</Text>
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
                  <Text style={styles.textBtnText}>Về đăng nhập</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.title}>Tạo mật khẩu mới</Text>
                <Text style={styles.sub}>
                  Nhập mật khẩu mới từ 8 ký tự trở lên, rồi xác nhận lại để
                  hoàn tất.
                </Text>

                <View style={styles.formCard}>
                  {error ? <Text style={styles.error}>{error}</Text> : null}

                  <ResetField
                    label="MẬT KHẨU MỚI"
                    icon="lock-closed-outline"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Nhập mật khẩu mới"
                    secureTextEntry={!showPass}
                    returnKeyType="next"
                    onSubmitEditing={focusConfirm}
                    blurOnSubmit={false}
                    right={
                      <TouchableOpacity
                        onPress={() => setShowPass(!showPass)}
                        hitSlop={8}
                        accessibilityLabel={
                          showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'
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

                  <ResetField
                    label="XÁC NHẬN MẬT KHẨU"
                    icon="shield-checkmark-outline"
                    value={confirm}
                    onChangeText={setConfirm}
                    placeholder="Nhập lại mật khẩu mới"
                    secureTextEntry={!showConfirm}
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
                              ? 'Ẩn xác nhận mật khẩu'
                              : 'Hiện xác nhận mật khẩu'
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
                      {submitting ? 'Đang lưu...' : 'Đổi mật khẩu'}
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

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 32,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.ink },
  headerSpacer: { width: 30 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  sub: {
    fontSize: 15,
    color: colors.muted,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 24,
  },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: 28,
    padding: 20,
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  fieldWrap: { marginBottom: 18 },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INPUT_BG,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: colors.ink, paddingVertical: 14 },
  checkIcon: { marginRight: 10 },
  error: {
    color: colors.danger,
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  submitBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: BUTTON_GREEN,
    borderRadius: 999,
    paddingVertical: 16,
    shadowColor: BUTTON_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: colors.white, fontSize: 17, fontWeight: '800' },
  centerBox: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 8 },
  centerText: { marginTop: 16, fontSize: 15, color: colors.muted },
  invalidTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
  },
  invalidText: {
    marginTop: 10,
    marginBottom: 24,
    fontSize: 15,
    color: colors.muted,
    lineHeight: 21,
    textAlign: 'center',
  },
  textBtn: { marginTop: 20, paddingVertical: 8 },
  textBtnText: { fontSize: 15, fontWeight: '700', color: colors.sageDark },
});
