import React, { useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type TextInputInstance,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { useAuth } from '../AuthContext';
import { getProfile } from '../../../lib/auravitalApi';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthField } from '../components/AuthField';
import { focusInput } from '../utils/focusInput';
import { BG, EMAIL_RE } from '../constants';
import { styles } from './LoginScreen.styles';

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const { login, signInWithProvider, biometricAvailable, loginWithBiometrics } =
    useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

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
      const ok = typeof avail === 'boolean' ? avail : Boolean(avail?.available);
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
          <ScrollView
            contentContainerStyle={styles.root}
            keyboardShouldPersistTaps='handled'
          >
            <Image
              source={require('../../../../assets/images/logo.png')}
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

              <AuthField
                label='ĐỊA CHỈ EMAIL'
                icon={
                  <Ionicons name='mail-outline' size={20} color='#7A8A7A' />
                }
                value={email}
                onChangeText={setEmail}
                placeholder='name@gmail.com'
                keyboardType='email-address'
                autoCapitalize='none'
                returnKeyType='next'
                onSubmitEditing={() => focusInput(passwordRef)}
                blurOnSubmit={false}
              />
              <AuthField
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
                autoCapitalize='none'
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
                style={[styles.loginBtn, submitting ? { opacity: 0.6 } : null]}
                onPress={submit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                <Text style={styles.loginBtnText}>Đăng nhập ngay</Text>
                <Ionicons name='arrow-forward' size={18} color={colors.white} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.faceIdBtn, submitting ? { opacity: 0.6 } : null]}
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
                style={[styles.socialBtn, submitting ? { opacity: 0.6 } : null]}
                onPress={() => handleSocial('google')}
                disabled={submitting}
              >
                <Text style={styles.googleG}>G</Text>
                <Text style={styles.socialText}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.socialBtn, submitting ? { opacity: 0.6 } : null]}
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
