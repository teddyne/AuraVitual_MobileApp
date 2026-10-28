import React, { useRef, useState, type ReactNode } from 'react';
import {
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
import { useNavigation } from '@react-navigation/native';
import {
  CheckBox,
  PillButton,
  StrengthMeter,
} from '../../../components/ui/Ui';
import { colors } from '../../../theme/colors';
import { useAuth } from '../AuthContext';
import { getProfile } from '../../../lib/auravitalApi';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INPUT_BG = '#EEF1FF';
const ICON_MUTED = '#7A8A7A';

function passwordScore(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

type AuthFieldProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  right?: ReactNode;
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
  onSubmitEditing?: () => void;
  blurOnSubmit?: boolean;
  inputRef?: React.RefObject<TextInputInstance | null>;
};

function focusInput(inputRef: React.RefObject<TextInputInstance | null>) {
  setTimeout(() => inputRef.current?.focus(), 50);
}

function AuthField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  right,
  returnKeyType,
  onSubmitEditing,
  blurOnSubmit,
  inputRef,
}: AuthFieldProps) {
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputBox}>
        <Ionicons name={icon} size={20} color={ICON_MUTED} style={styles.icon} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
        />
        {right}
      </View>
    </View>
  );
}

export default function SignUpScreen() {
  const navigation = useNavigation<any>();
  const { register, signInWithProvider } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const nameRef = useRef<TextInputInstance>(null);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);

  const score = passwordScore(password);
  const confirmOk = confirm.length > 0 && confirm === password;

  const submit = async () => {
    if (submitting) return;
    if (!name.trim()) return setError('Hãy nhập họ và tên.');
    if (!EMAIL_RE.test(email.trim()))
      return setError('Email chưa đúng định dạng.');
    if (password.length < 8)
      return setError('Mật khẩu phải từ 8 ký tự trở lên.');
    if (!confirmOk) return setError('Xác nhận mật khẩu chưa khớp.');
    if (!agreed)
      return setError(
        'Hãy tick đồng ý Điều khoản & Bảo mật trước khi đăng ký.',
      );

    setSubmitting(true);
    try {
      const res = await register(name, email, password);
      if (!res.ok) return setError(res.message ?? 'Đăng ký thất bại.');
      if (res.needsConfirmation) {
        Alert.alert(
          'Cần xác nhận email',
          'Mở Mailpit ở cổng local, bấm link xác nhận rồi đăng nhập lại.',
        );
        navigation.navigate('Login');
        return;
      }
      if (!res.user)
        return setError('Không lấy được tài khoản sau khi đăng ký.');
      const profile = await getProfile(res.user.id);
      navigation.replace(profile ? 'Main' : 'ProfileSetup');
    } finally {
      setSubmitting(false);
    }
  };

  const signInSocial = async (provider: 'google' | 'apple') => {
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await signInWithProvider(provider);
      if (!res.ok) {
        setError(res.message ?? 'Đăng nhập thất bại.');
        return;
      }
      if (!res.user) {
        setError('Không lấy được tài khoản sau khi đăng nhập.');
        return;
      }
      const profile = await getProfile(res.user.id);
      navigation.replace(profile ? 'Main' : 'ProfileSetup');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9F9FF' }}>
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: colors.white }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.root}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={32} color={colors.ink} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Đăng ký</Text>
              <View style={styles.avatar}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={colors.sageDark}
                />
              </View>
            </View>

            <View style={styles.badge}>
              <Ionicons
                name="leaf-outline"
                size={12}
                color={colors.sageDark}
              />
              <Text style={styles.badgeText}>AURAVITAL HOLISTIC ID</Text>
            </View>
            <Text style={styles.title}>Tạo tài khoản mới</Text>
            <Text style={styles.sub}>
              Bắt đầu hành trình sống khỏe, cân bằng và tràn đầy năng lượng cùng
              AuraVital.
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <AuthField
              inputRef={nameRef}
              label="HỌ VÀ TÊN"
              icon="person-outline"
              value={name}
              onChangeText={setName}
              placeholder="Nguyễn Văn A"
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => focusInput(emailRef)}
              blurOnSubmit={false}
            />
            <AuthField
              inputRef={emailRef}
              label="ĐỊA CHỈ EMAIL"
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              placeholder="name@gmail.com"
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={() => focusInput(passwordRef)}
              blurOnSubmit={false}
            />
            <View style={styles.passLabelRow}>
              <Text style={styles.passLabel}>MẬT KHẨU</Text>
              <Text style={styles.passHint}>
                {score === 4 ? 'Mật khẩu an toàn' : ''}
              </Text>
            </View>
            <AuthField
              inputRef={passwordRef}
              label=""
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              placeholder="AuraVital#2025"
              secureTextEntry={!showPass}
              returnKeyType="next"
              onSubmitEditing={() => focusInput(confirmRef)}
              blurOnSubmit={false}
              right={
                <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                  <Ionicons
                    name={showPass ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={ICON_MUTED}
                  />
                </TouchableOpacity>
              }
            />
            <StrengthMeter score={score} />

            <AuthField
              inputRef={confirmRef}
              label="XÁC NHẬN MẬT KHẨU"
              icon="shield-checkmark-outline"
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Nhập lại mật khẩu"
              secureTextEntry
              returnKeyType="go"
              onSubmitEditing={submit}
              right={
                confirm.length > 0 ? (
                  <Ionicons
                    name={confirmOk ? 'checkmark' : 'close'}
                    size={18}
                    color={confirmOk ? colors.sage : colors.danger}
                  />
                ) : undefined
              }
            />

            <CheckBox checked={agreed} onPress={() => setAgreed(!agreed)}>
              <Text style={styles.terms}>
                Tôi đồng ý với{' '}
                <Text style={styles.termsLink}>Điều khoản dịch vụ</Text> và{' '}
                <Text style={styles.termsLink}>Chính sách bảo mật</Text> chuẩn y
                tế của AuraVital.
              </Text>
            </CheckBox>

            <PillButton
              title={submitting ? 'Đang đăng ký...' : 'Đăng ký ngay →'}
              onPress={submit}
              disabled={submitting}
            />

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>HOẶC ĐĂNG KÝ VỚI</Text>
              <View style={styles.line} />
            </View>

            <View style={styles.socialRow}>
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => signInSocial('google')}
              >
                <Text style={styles.googleG}>G</Text>
                <Text style={styles.socialText}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => signInSocial('apple')}
              >
                <Ionicons name="logo-apple" size={20} color={colors.ink} />
                <Text style={styles.socialText}>Apple ID</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.footer}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.footerText}>
                Đã có tài khoản?{' '}
                <Text style={{ color: colors.sageDark, fontWeight: '700' }}>
                  Đăng nhập ngay
                </Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { padding: 24 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.ink },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.sageDark },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  sub: {
    fontSize: 15,
    color: colors.muted,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 24,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
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
  passLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  passLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.5,
  },
  passHint: { fontSize: 12, color: colors.sageDark, fontWeight: '600' },
  terms: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  termsLink: { color: colors.sageDark, fontWeight: '700' },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 24,
  },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 12, color: colors.muted, fontWeight: '700' },
  socialRow: { flexDirection: 'row', gap: 12 },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingVertical: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  googleG: { fontSize: 20, fontWeight: '900', color: '#4285F4' },
  socialText: { fontSize: 16, fontWeight: '700', color: colors.ink },
  footer: { alignItems: 'center', marginTop: 20 },
  footerText: { fontSize: 14, color: colors.muted },
});
