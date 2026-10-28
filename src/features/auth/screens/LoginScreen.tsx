import React, { useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { useAuth } from '../AuthContext';
import { getProfile } from '../../../lib/auravitalApi';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BG = '#F9F9FF';
const INPUT_BG = '#EEF1FF';
const BUTTON_GREEN = '#4E8A47';

// Ô nhập đúng kiểu trong ảnh: label in hoa, ô nền xanh nhạt, không viền.
type LoginFieldProps = {
  label: string;
  icon: ReactNode;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  right?: ReactNode;
  returnKeyType?: 'default' | 'next' | 'go' | 'done' | 'search' | 'send';
  onSubmitEditing?: () => void;
  blurOnSubmit?: boolean;
  inputRef?: React.RefObject<TextInput | null>;
};

function LoginField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  right,
  returnKeyType,
  onSubmitEditing,
  blurOnSubmit,
  inputRef,
}: LoginFieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputBox}>
        <View style={styles.iconWrap}>{icon}</View>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize='none'
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
        />
        {right}
      </View>
    </View>
  );
}

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const { login, signInWithProvider, biometricAvailable, loginWithBiometrics } =
    useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    if (submitting) return;
    if (!EMAIL_RE.test(email.trim())) {
      setError('Email chưa đúng định dạng.');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu phải từ 6 ký tự trở lên.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await login(email, password);
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

  const handleSocial = async (provider: 'google' | 'apple') => {
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

  const handleBiometric = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const avail: any = await biometricAvailable();
      const ok =
        typeof avail === 'boolean' ? avail : Boolean(avail?.available);
      if (!ok) {
        const reason =
          typeof avail === 'object' && avail?.reason
            ? String(avail.reason)
            : 'Thiết bị này không hỗ trợ sinh trắc học hoặc bạn chưa cài đặt Face ID / vân tay trên thiết bị.';
        Alert.alert('Chưa dùng được sinh trắc học', reason);
        return;
      }
      const res = await loginWithBiometrics();
      if (!res.ok) {
        Alert.alert(
          'Đăng nhập sinh trắc học thất bại',
          res.message ?? 'Đăng nhập thất bại.',
        );
        return;
      }
      if (!res.user) {
        Alert.alert(
          'Đăng nhập sinh trắc học thất bại',
          'Không lấy được tài khoản sau khi đăng nhập.',
        );
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
          style={{ flex: 1, backgroundColor: BG }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.root}>
            <Image
              source={require('../../../../assets/images/logo.jpg')}
              style={styles.logo}
              resizeMode='contain'
            />

            <Text style={styles.title}>Chào mừng trở lại</Text>
            <Text style={styles.sub}>
              Đăng nhập để tiếp tục hành trình phục hồi và cân bằng nhịp sinh
              học.
            </Text>

            {/* Thẻ form trắng, bo tròn lớn, shadow nhẹ */}
            <View style={styles.formCard}>
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <LoginField
                label='ĐỊA CHỈ EMAIL'
                icon={
                  <Ionicons name='mail-outline' size={20} color='#7A8A7A' />
                }
                value={email}
                onChangeText={setEmail}
                placeholder='name@gmail.com'
                keyboardType='email-address'
                returnKeyType='next'
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
              />
              <LoginField
                label='MẬT KHẨU'
                icon={
                  <Ionicons
                    name='lock-closed-outline'
                    size={20}
                    color='#7A8A7A'
                  />
                }
                value={password}
                onChangeText={setPassword}
                placeholder='Nhập mật khẩu'
                secureTextEntry={!showPass}
                inputRef={passwordRef}
                returnKeyType='go'
                onSubmitEditing={submit}
                blurOnSubmit
                right={
                  <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                    <Ionicons
                      name={showPass ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color='#7A8A7A'
                    />
                  </TouchableOpacity>
                }
              />

              <TouchableOpacity
                style={styles.forgot}
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={styles.forgotText}>Quên mật khẩu?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.loginBtn,
                  submitting ? { opacity: 0.6 } : null,
                ]}
                onPress={submit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                <Text style={styles.loginBtnText}>Đăng nhập ngay</Text>
                <Ionicons name='arrow-forward' size={18} color={colors.white} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.faceIdBtn,
                submitting ? { opacity: 0.6 } : null,
              ]}
              onPress={handleBiometric}
              disabled={submitting}
            >
              <Ionicons
                name='finger-print-outline'
                size={20}
                color={colors.sageDark}
              />
              <Text style={styles.faceIdText}>
                Đăng nhập nhanh bằng sinh trắc học
              </Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>HOẶC ĐĂNG NHẬP VỚI</Text>
              <View style={styles.line} />
            </View>

            <View style={styles.socialRow}>
              <TouchableOpacity
                style={[
                  styles.socialBtn,
                  submitting ? { opacity: 0.6 } : null,
                ]}
                onPress={() => handleSocial('google')}
                disabled={submitting}
              >
                <Text style={styles.googleG}>G</Text>
                <Text style={styles.socialText}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.socialBtn,
                  submitting ? { opacity: 0.6 } : null,
                ]}
                onPress={() => handleSocial('apple')}
                disabled={submitting}
              >
                <Ionicons name='logo-apple' size={20} color={colors.ink} />
                <Text style={styles.socialText}>Apple ID</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.proofRow}>
              <View style={styles.avatar}>
                <Ionicons name='leaf-outline' size={20} color='#2E7D32' />
              </View>
              <Text style={styles.proofText}>
                Hơn 84,000 thành viên đã đồng bộ nhịp sinh học sáng nay.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.footer}
              onPress={() => navigation.navigate('SignUp')}
            >
              <Text style={styles.footerText}>
                Chưa có tài khoản?{' '}
                <Text style={{ color: colors.sageDark, fontWeight: '700' }}>
                  Đăng ký ngay
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
  root: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 32,
    backgroundColor: BG,
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignSelf: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  title: {
    textAlign: 'center',
    fontSize: 32,
    fontWeight: '800',
    color: colors.ink,
    marginTop: 5,
  },
  sub: {
    textAlign: 'center',
    fontSize: 16,
    color: colors.muted,
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 28,
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
  iconWrap: { marginRight: 10, justifyContent: 'center' },
  input: { flex: 1, fontSize: 16, color: colors.ink, paddingVertical: 14 },
  error: {
    color: colors.danger,
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  forgot: { alignSelf: 'flex-end', marginTop: 2, marginBottom: 20 },
  forgotText: { color: '#E53935', fontSize: 14, fontWeight: '600' },
  loginBtn: {
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
  loginBtnText: { color: colors.white, fontSize: 17, fontWeight: '800' },
  faceIdBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingVertical: 14,
    marginTop: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  faceIdText: { fontSize: 15, fontWeight: '700', color: colors.sageDark },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 24,
  },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 13, color: colors.muted, fontWeight: '700' },
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
  proofRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 24,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DDE8D5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proofText: { flex: 1, fontSize: 14, color: colors.muted, lineHeight: 20 },
  footer: { alignItems: 'center', marginTop: 28 },
  footerText: { fontSize: 15, color: colors.muted },
});
