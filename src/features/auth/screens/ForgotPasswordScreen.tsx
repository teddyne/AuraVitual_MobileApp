import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../theme/colors';
import { useAuth } from '../AuthContext';
import { AuthField } from '../components/AuthField';
import { BG, EMAIL_RE } from '../constants';
import { styles } from './ForgotPasswordScreen.styles';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<any>();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    if (!EMAIL_RE.test(email.trim())) {
      setError('Email chưa đúng định dạng.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await requestPasswordReset(email.trim().toLowerCase());
      if (!res.ok) {
        setError(res.message ?? 'Không gửi được link đặt lại mật khẩu.');
        return;
      }
      Alert.alert(
        'Đã gửi link đặt lại',
        'Hãy mở hộp thư của bạn và bấm vào link trong email để đặt lại mật khẩu. Nếu đang chạy bản local, hãy mở Mailpit ở cổng local để lấy link.',
        [{ text: 'Về đăng nhập', onPress: () => navigation.navigate('Login') }],
      );
    } finally {
      setSubmitting(false);
    }
  };

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
                accessibilityLabel='Quay lại'
              >
                <Ionicons name='chevron-back' size={30} color={colors.ink} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Quên mật khẩu</Text>
              <View style={styles.headerSpacer} />
            </View>

            <Text style={styles.title}>Đặt lại mật khẩu</Text>
            <Text style={styles.sub}>
              Nhập email bạn đã dùng để đăng ký. AuraVital sẽ gửi link đặt lại
              mật khẩu tới hộp thư đó — nếu đang chạy bản local, hãy mở Mailpit
              để lấy link.
            </Text>

            <View style={styles.formCard}>
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <AuthField
                label='ĐỊA CHỈ EMAIL'
                icon='mail-outline'
                value={email}
                onChangeText={setEmail}
                placeholder='name@gmail.com'
                keyboardType='email-address'
                autoCapitalize='none'
                autoCorrect={false}
                returnKeyType='send'
                onSubmitEditing={submit}
                blurOnSubmit
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
                  {submitting ? 'Đang gửi...' : 'Gửi link đặt lại'}
                </Text>
                {!submitting ? (
                  <Ionicons
                    name='arrow-forward'
                    size={18}
                    color={colors.white}
                  />
                ) : null}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.footer}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.footerText}>
                Nhớ mật khẩu rồi?{' '}
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
