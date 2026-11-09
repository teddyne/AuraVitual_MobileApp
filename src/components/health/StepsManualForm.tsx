import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { styles } from '../../features/health/screens/StepsDetailScreen.styles';
import { useSettings } from '../../context/SettingsContext';

// O nhap tay so buoc hom nay. Doi nguyen van tu StepsDetailScreen.
// Form GIU state rieng: go phim chi re-render minh form, khong
// re-render ca man (bieu do, dong ho...) nen khong lag nhu truoc.
// onSave nhan gia tri va tra true khi luu duoc de form tu xoa o nhap.
export function StepsManualForm({
  onSave,
}: {
  onSave: (value: string) => Promise<boolean>;
}) {
  const { t } = useSettings();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const onPressSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const ok = await onSave(text);
      if (ok) setText('');
    } finally {
      setSaving(false);
    }
  };
  return (
    <View style={styles.manualCard}>
      <Text style={styles.cardTitle}>{t('steps.manualTitle')}</Text>
      <Text style={styles.cardText}>{t('steps.manualDesc')}</Text>
      <View style={styles.manualRow}>
        <TextInput
          style={styles.manualInput}
          value={text}
          onChangeText={setText}
          keyboardType='number-pad'
          placeholder={t('steps.manualPlaceholder')}
          placeholderTextColor='#999'
        />
        <TouchableOpacity
          style={styles.manualBtn}
          onPress={onPressSave}
          disabled={saving}
        >
          <Text style={styles.manualBtnText}>
            {saving ? t('steps.saving') : t('common.save')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
