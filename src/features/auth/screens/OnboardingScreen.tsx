import React, { useState } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { PillButton } from '../../../components/ui/Ui';
import { colors } from '../../../theme/colors';
import { styles } from './OnboardingScreen.styles';

const STEPS = [
  {
    title: 'Khởi đầu hành trình sống khỏe',
    desc: 'Theo dõi nhịp sinh học, lắng nghe nhịp tim và xây dựng giấc ngủ sâu phục hồi trọn vẹn mỗi ngày.',
    tag: '1. Vòng lặp vận động',
  },
  {
    title: 'Dinh dưỡng cân bằng',
    desc: 'Ghi lại bữa ăn, theo dõi calo và chất dinh dưỡng để mỗi ngày ăn uống đều có chủ đích.',
    tag: '2. Dinh dưỡng',
  },
  {
    title: 'Rèn luyện mỗi ngày',
    desc: 'Video bài tập theo từng cấp độ, từ giãn cơ buổi sáng đến yoga nhẹ nhàng trước khi ngủ.',
    tag: '3. Rèn luyện',
  },
];

export default function OnboardingScreen() {
  const navigation = useNavigation<any>();
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
            <Text style={styles.badgeText}>🌿 HỆ SINH THÁI SỨC KHỎE</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.skip}>Bỏ qua</Text>
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
            <Text style={styles.subBadgeText}>CHỈ SỐ SINH HỌC THÔNG MINH</Text>
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
            title={isLast ? 'Bắt đầu ngay →' : 'Tiếp tục khám phá →'}
            onPress={next}
          />

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginText}>
              Đã có tài khoản AuraVital?{' '}
              <Text style={{ color: colors.sageDark, fontWeight: '700' }}>
                Đăng nhập ngay
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
