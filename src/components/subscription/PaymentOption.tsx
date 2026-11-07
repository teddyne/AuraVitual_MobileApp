// Ô chọn cách thanh toán — cùng kiểu với PaymentOption của BookStore Buổi 9.
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemePalette } from '../../context/SettingsContext';
import type { PaymentMethod } from '../../features/subscription/subscriptionService';
import { s } from '../../features/subscription/screens/SubscriptionCheckoutScreen.styles';

export function PaymentOption({
  method,
  selected,
  title,
  desc,
  icon,
  theme,
  onSelect,
}: {
  method: PaymentMethod;
  selected: boolean;
  title: string;
  desc: string;
  icon: string;
  theme: ThemePalette;
  onSelect: (m: PaymentMethod) => void;
}) {
  return (
    <TouchableOpacity
      style={[
        s.payOption,
        { backgroundColor: theme.card, borderColor: theme.border },
        selected && { borderColor: theme.primaryDark, borderWidth: 2 },
      ]}
      onPress={() => onSelect(method)}
    >
      <View style={s.payIcon}>
        <Ionicons
          name={icon as any}
          size={22}
          color={theme.primaryDark}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.payTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[s.payDesc, { color: theme.muted }]}>{desc}</Text>
      </View>
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={22}
        color={selected ? theme.primaryDark : theme.muted}
      />
    </TouchableOpacity>
  );
}
