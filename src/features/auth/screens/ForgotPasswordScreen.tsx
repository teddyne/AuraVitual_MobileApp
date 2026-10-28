import React, { useState, type ReactNode } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../theme/colors';
import { useAuth } from '../AuthContext';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BG = '#F9F9FF';
const INPUT_BG = '#EEF1FF';
const BUTTON_GREEN = '#4E8A47';

// Ô nhập đúng kiểu màn Login: label in hoa, ô nền xanh nhạt, không viền.
function ForgotField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  returnKeyType,
  onSubmitEditing,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address';
  returnKeyType?: 'send' | 'done' | 'go' | 'next';
  onSubmitEditing?: () => void;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputBox}>
        <Ionicons name={icon} size={20} color='#7A8A7A' style={styles.icon} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          keyboardType={keyboardType}
          autoCapitalize='none'
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit
        />
      </View>
    </View>
  );
}

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

              <ForgotField
                label='ĐỊA CHỈ EMAIL'
                icon='mail-outline'
                value={email}
                onChangeText={setEmail}
                placeholder='name@gmail.com'
                keyboardType='email-address'
                returnKeyType='send'
                onSubmitEditing={submit}
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
  footer: { alignItems: 'center', marginTop: 28 },
  footerText: { fontSize: 15, color: colors.muted },
});
