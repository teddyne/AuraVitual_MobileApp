import React, { useRef, useState } from 'react';
import {
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
import { AuthField } from '../components/AuthField';
import { focusInput } from '../utils/focusInput';
import { passwordScore } from '../utils/passwordScore';
import { EMAIL_RE, ICON_MUTED } from '../constants';
import { styles } from './SignUpScreen.styles';

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
