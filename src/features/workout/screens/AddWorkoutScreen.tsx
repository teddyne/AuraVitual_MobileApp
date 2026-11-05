import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { addCustomWorkout, levelLabel } from '../../../lib/workoutApi';
import { useSettings } from '../../../context/SettingsContext';
import { LEVELS } from '../constants';
import { styles } from './AddWorkoutScreen.styles';

export default function AddWorkoutScreen() {
  const { t } = useSettings();
  const navigation = useNavigation<any>();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [durationText, setDurationText] = useState('');
  const [kcalText, setKcalText] = useState('');
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('beginner');
  const [videoUrl, setVideoUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    const duration = parseInt(durationText, 10);
    const kcal = kcalText.trim() === '' ? null : parseInt(kcalText, 10);
    if (!title.trim()) {
      Alert.alert(t('workout.add.missingTitle'), t('workout.add.missingTitleBody'));
      return;
    }
    if (!Number.isInteger(duration) || duration < 1 || duration > 480) {
      Alert.alert(t('workout.add.invalidDurationTitle'), t('workout.log.invalidMinutesBody'));
      return;
    }
    if (kcal !== null && (!Number.isInteger(kcal) || kcal < 0)) {
      Alert.alert(
        t('workout.add.invalidKcalTitle'),
        t('workout.add.invalidKcalBody'),
      );
      return;
    }
    setSaving(true);
    try {
      await addCustomWorkout({
        title: title.trim(),
        summary: summary.trim() || null,
        duration_min: duration,
        kcal_estimate: kcal,
        level,
        video_url: videoUrl.trim() || null,
      });
      Alert.alert(
        t('workout.add.savedTitle'),
        t('workout.add.savedBody'),
        [{ text: t('common.ok'), onPress: () => navigation.goBack() }],
      );
    } catch (e: any) {
      Alert.alert(t('workout.log.saveFailedTitle'), e?.message ?? t('common.tryAgainLater'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.wrap}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name='chevron-back' size={26} color='#1B2A1E' />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('workout.add.title')}</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>

          <Text style={styles.label}>{t('workout.add.nameLabel')}</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={t('workout.add.namePlaceholder')}
          />

          <Text style={styles.label}>{t('workout.add.summaryLabel')}</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            value={summary}
            onChangeText={setSummary}
            placeholder={t('workout.add.summaryPlaceholder')}
            multiline
          />

          <Text style={styles.label}>{t('workout.add.durationLabel')}</Text>
          <TextInput
            style={styles.input}
            value={durationText}
            onChangeText={setDurationText}
            keyboardType='number-pad'
            placeholder={t('workout.add.durationPlaceholder')}
          />

          <Text style={styles.label}>
            {t('workout.add.kcalLabel')}
          </Text>
          <TextInput
            style={styles.input}
            value={kcalText}
            onChangeText={setKcalText}
            keyboardType='number-pad'
            placeholder={t('workout.add.kcalPlaceholder')}
          />

          <Text style={styles.label}>{t('workout.add.levelLabel')}</Text>
          <View style={styles.levelRow}>
            {LEVELS.map((lv) => (
              <TouchableOpacity
                key={lv}
                style={[
                  styles.levelChip,
                  level === lv && styles.levelChipActive,
                ]}
                onPress={() => setLevel(lv)}
              >
                <Text
                  style={[
                    styles.levelText,
                    level === lv && styles.levelTextActive,
                  ]}
                >
                  {levelLabel(lv)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>{t('workout.add.videoLabel')}</Text>
          <TextInput
            style={styles.input}
            value={videoUrl}
            onChangeText={setVideoUrl}
            placeholder='https://...'
            autoCapitalize='none'
          />
          <Text style={styles.hint}>
            {t('workout.add.videoHint')}
          </Text>

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={onSave}
            disabled={saving}
          >
            <Text style={styles.saveText}>
              {saving ? t('common.saving') : t('workout.add.save')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
