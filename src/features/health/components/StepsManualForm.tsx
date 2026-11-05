import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { styles } from '../screens/StepsDetailScreen.styles';
import { useSettings } from '../../../context/SettingsContext';

// O nhap tay so buoc hom nay. Doi nguyen van tu StepsDetailScreen.
export function StepsManualForm({
  manualInput,
  onChangeText,
  savingManual,
  onSave,
}: {
  manualInput: string;
  onChangeText: (v: string) => void;
  savingManual: boolean;
  onSave: () => void;
}) {
  const { t } = useSettings();
  return (
    <View style={styles.manualCard}>
      <Text style={styles.cardTitle}>{t('steps.manualTitle')}</Text>
      <Text style={styles.cardText}>{t('steps.manualDesc')}</Text>
      <View style={styles.manualRow}>
        <TextInput
          style={styles.manualInput}
          value={manualInput}
          onChangeText={onChangeText}
          keyboardType='number-pad'
          placeholder={t('steps.manualPlaceholder')}
          placeholderTextColor='#999'
        />
        <TouchableOpacity
          style={styles.manualBtn}
          onPress={onSave}
          disabled={savingManual}
        >
          <Text style={styles.manualBtnText}>
            {savingManual ? t('steps.saving') : t('common.save')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
