import React, { type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { ICON_MUTED, INPUT_BG } from '../../features/auth/constants';

// O nhap chung cho ca 4 man hinh auth (Login / Dang ky / Quen /
// Dat lai mat khau): label in hoa, o nen xanh nhat, khong vien.
// Gop nguyen van 4 ban LoginField / AuthField / ResetField /
// ForgotField — chung chi khac nhau o prop icon va vai prop
// TextInput tung man hard-code truoc day:
//   - Login truyen san phan tu <Ionicons ... /> (icon: ReactNode),
//     3 man con lai truyen ten glyph (icon: string);
//   - autoCapitalize / autoCorrect / blurOnSubmit tung man hard-code
//     truoc day nay truyen o noi goi, gia tri giu nguyen nhu cu
//     (Login/Reset/Forgot: autoCapitalize="none"; Reset/Forgot:
//     autoCorrect={false}; Forgot: blurOnSubmit).
type IconName = keyof typeof Ionicons.glyphMap;

function isGlyphName(v: ReactNode | IconName): v is IconName {
  return typeof v === 'string';
}
export type AuthFieldProps = {
  label: string;
  icon: ReactNode | IconName;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  right?: ReactNode;
  returnKeyType?: 'default' | 'done' | 'go' | 'next' | 'search' | 'send';
  onSubmitEditing?: () => void;
  blurOnSubmit?: boolean;
  inputRef?: React.RefObject<TextInputInstance | null>;
};

export function AuthField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  right,
  returnKeyType,
  onSubmitEditing,
  blurOnSubmit,
  inputRef,
}: AuthFieldProps) {
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputBox}>
        {isGlyphName(icon) ? (
          <Ionicons
            name={icon}
            size={20}
            color={ICON_MUTED}
            style={styles.icon}
          />
        ) : (
          <View style={styles.iconWrap}>{icon}</View>
        )}
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
        />
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  iconWrap: { marginRight: 10, justifyContent: 'center' },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: colors.ink, paddingVertical: 14 },
});
