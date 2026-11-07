import React, { useState } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { PillButton } from '../../../components/ui/Ui';
import { colors } from '../../../theme/colors';
import { useSettings } from '../../../context/SettingsContext';
import { styles } from './OnboardingScreen.styles';

export default function OnboardingScreen() {
  const navigation = useNavigation<any>();
  const { t } = useSettings();
  // STEPS nam trong component de dung t(): cac chuoi tieu de/mo ta/tag
  // doi theo locale; noi dung va thu tu giu nguyen.
  const STEPS = [
    {
      title: t('auth.onboarding.step1.title'),
      desc: t('auth.onboarding.step1.desc'),
      tag: t('auth.onboarding.step1.tag'),
    },
    {
      title: t('auth.onboarding.step2.title'),
      desc: t('auth.onboarding.step2.desc'),
      tag: t('auth.onboarding.step2.tag'),
    },
    {
      title: t('auth.onboarding.step3.title'),
      desc: t('auth.onboarding.step3.desc'),
      tag: t('auth.onboarding.step3.tag'),
    },
  ];
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const next = () => {
    if (isLast) navigation.navigate('Login');
    else setStep(step + 1);
  };

  return (
    <View style={styles.root}>
      <Image
        source={require('../../../../assets/images/onboarding.png')}
        style={styles.background}
        resizeMode='cover'
      />
      {/* Lớp phủ trắng mờ để chữ trên ảnh vẫn đọc được */}
      <View style={styles.overlay} />

      <View style={styles.content}>
        <View style={styles.top}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {t('auth.onboarding.badge')}
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.skip}>{t('auth.onboarding.skip')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.brand}>
          <Image
            source={require('../../../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode='contain'
          />
          <Text style={styles.brandName}>
            Aura<Text style={{ color: colors.sage }}>Vital</Text>
          </Text>
          <View style={styles.subBadge}>
            <Text style={styles.subBadgeText}>
              {t('auth.onboarding.subBadge')}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTag}>{current.tag}</Text>
          <Text style={styles.cardTitle}>{current.title}</Text>
          <Text style={styles.cardDesc}>{current.desc}</Text>

          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <TouchableOpacity key={i} onPress={() => setStep(i)}>
                <View style={[styles.dot, i === step && styles.dotActive]} />
              </TouchableOpacity>
            ))}
          </View>

          <PillButton
            title={
              isLast ? t('auth.onboarding.start') : t('auth.onboarding.next')
            }
            onPress={next}
          />

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginText}>
              {t('auth.onboarding.hasAccount')}{' '}
              <Text style={{ color: colors.sageDark, fontWeight: '700' }}>
                {t('auth.login.submit')}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
