import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemePalette } from '../../context/SettingsContext';
import { formatVnd, type Plan } from '../../features/subscription/plans';
import { s } from '../../features/subscription/screens/PlansScreen.styles';

export function PlanCard({
  plan,
  isCurrent,
  onSelect,
  theme,
  t,
}: {
  plan: Plan;
  isCurrent: boolean;
  onSelect: () => void;
  theme: ThemePalette;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <View
      style={[
        s.card,
        { backgroundColor: theme.card, borderColor: theme.border },
        plan.highlighted && { borderColor: theme.primaryDark, borderWidth: 2 },
      ]}
    >
      {plan.highlighted && (
        <View style={s.badge}>
          <Text style={s.badgeText}>{t('subscription.popular')}</Text>
        </View>
      )}
      <Text style={[s.planName, { color: theme.text }]}>{plan.name}</Text>
      <Text style={[s.planTagline, { color: theme.muted }]}>{plan.tagline}</Text>
      <Text style={[s.price, { color: theme.primaryDark }]}>
        {formatVnd(plan.priceVnd)}
        <Text style={[s.period, { color: theme.muted }]}>{plan.period}</Text>
      </Text>
      {plan.features.map((f) => (
        <View key={f} style={s.featureRow}>
          <Ionicons name='checkmark-circle' size={18} color={theme.primaryDark} />
          <Text style={[s.featureText, { color: theme.text }]}>{f}</Text>
        </View>
      ))}
      <TouchableOpacity
        style={[
          s.selectBtn,
          { backgroundColor: isCurrent ? theme.cardAlt : theme.primaryDark },
        ]}
        onPress={onSelect}
        disabled={isCurrent}
      >
        <Text
          style={[
            s.selectBtnText,
            { color: isCurrent ? theme.muted : '#fff' },
          ]}
        >
          {isCurrent ? t('subscription.inUse') : t('subscription.selectPlan')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
