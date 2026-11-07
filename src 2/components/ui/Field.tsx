import React, { type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../theme/colors';

export function Field({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  right,
  keyboardType,
  autoCapitalize = 'none',
}: {
  label: string;
  icon?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  right?: ReactNode;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'words';
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
        />
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldWrap: { marginBottom: 16 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  icon: { fontSize: 18, marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: colors.ink, paddingVertical: 14 },
});
