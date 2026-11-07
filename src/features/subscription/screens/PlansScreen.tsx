// Màn AuraVital Gold — mở khi bấm pill Gold ở Cài đặt.
// Gói Free bấm là kích hoạt ngay (0đ, không qua thanh toán).
// Gói trả phí bấm là sang màn thanh toán demo.

import React, { useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../../context/SettingsContext';
import { useSubscription } from '../../../context/SubscriptionContext';
import { getPlanById, PLANS } from '../plans';
import { PlanCard } from '../../../components/subscription/PlanCard';
import { s } from './PlansScreen.styles';

export default function PlansScreen({ navigation }: any) {
  const { theme, t } = useSettings();
  const { planId, setActivePlan, refresh, cancelPlan } = useSubscription();
  const [cancelling, setCancelling] = useState(false);

  const onSelect = async (id: string) => {
    if (id === planId) return;
    if (id === 'free') {
      await setActivePlan('free');
      await refresh();
      Alert.alert(t('subscription.title'), t('subscription.freeActivated'));
      return;
    }
    navigation.navigate('SubscriptionCheckout', { planId: id });
  };

  // Hủy gói đang dùng: xác nhận rồi về gói Free. Chỉ có ở gói trả phí
  // đang dùng; gói Free không có nút hủy.
  const onCancel = () => {
    if (planId === 'free' || cancelling) return;
    Alert.alert(
      t('subscription.cancelConfirmTitle'),
      t('subscription.cancelConfirmBody', {
        plan: getPlanById(planId).name,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('subscription.cancelPlan'),
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await cancelPlan();
              await refresh();
              Alert.alert(
                t('subscription.title'),
                t('subscription.cancelled'),
              );
            } catch {
              Alert.alert(
                t('common.errorTitle'),
                t('checkout.submitFailed'),
              );
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
        <View style={s.wrap}>
          <View style={s.header}>
            <TouchableOpacity
              style={s.backBtn}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name='chevron-back' size={26} color={theme.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[s.headerTitle, { color: theme.text }]}>
                AuraVital Gold
              </Text>
              <Text style={[s.headerSub, { color: theme.muted }]}>
                {t('subscription.subtitle')}
              </Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={s.content}>
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isCurrent={plan.id === planId}
                onSelect={() => onSelect(plan.id)}
                theme={theme}
                t={t}
              />
            ))}
            {planId === 'free' ? (
              <Text style={[s.freeNote, { color: theme.muted }]}>
                {t('subscription.freeInUse')}
              </Text>
            ) : (
              <TouchableOpacity
                style={[s.cancelBtn, { borderColor: '#C62828' }]}
                onPress={onCancel}
                disabled={cancelling}
              >
                <Text style={s.cancelBtnText}>
                  {cancelling
                    ? t('common.saving')
                    : t('subscription.cancelPlan')}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
