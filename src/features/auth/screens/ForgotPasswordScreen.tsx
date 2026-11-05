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
import { useSettings } from '../../../context/SettingsContext';
import { styles } from './ForgotPasswordScreen.styles';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<any>();
  const { t } = useSettings();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    if (!EMAIL_RE.test(email.trim())) {
      setError(t('auth.validation.invalidEmail'));
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await requestPasswordReset(email.trim().toLowerCase());
      if (!res.ok) {
        setError(res.message ?? t('auth.forgot.sendFailed'));
        return;
      }
      Alert.alert(t('auth.forgot.sentTitle'), t('auth.forgot.sentBody'), [
        { text: t('auth.backToLogin'), onPress: () => navigation.navigate('Login') },
      ]);
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
                accessibilityLabel={t('common.back')}
              >
                <Ionicons name='chevron-back' size={30} color={colors.ink} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>
                {t('auth.forgot.title')}
              </Text>
              <View style={styles.headerSpacer} />
            </View>

            <Text style={styles.title}>{t('auth.reset.title')}</Text>
            <Text style={styles.sub}>{t('auth.forgot.subtitle')}</Text>

            <View style={styles.formCard}>
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <AuthField
                label={t('auth.fields.email')}
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
                  {submitting
                    ? t('auth.forgot.sending')
                    : t('auth.forgot.submit')}
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
                {t('auth.forgot.remembered')}{' '}
                <Text style={{ color: colors.sageDark, fontWeight: '700' }}>
                  {t('auth.login.submit')}
                </Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
