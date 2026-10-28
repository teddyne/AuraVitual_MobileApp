import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { addCustomWorkout, levelLabel } from '../../../lib/workoutApi';

const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

export default function AddWorkoutScreen() {
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
      Alert.alert('Thiếu tên bài tập', 'Nhập tên bài tập trước.');
      return;
    }
    if (!Number.isInteger(duration) || duration < 1 || duration > 480) {
      Alert.alert('Thời lượng chưa đúng', 'Nhập số phút từ 1 đến 480.');
      return;
    }
    if (kcal !== null && (!Number.isInteger(kcal) || kcal < 0)) {
      Alert.alert(
        'Kcal chưa đúng',
        'Kcal phải là số nguyên từ 0 trở lên, hoặc để trống.',
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
        'Đã thêm bài tập',
        'Bài tập mới đã có trong danh sách để chọn và ghi nhận.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (e: any) {
      Alert.alert('Không lưu được', e?.message ?? 'Thử lại sau.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.wrap}>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name='chevron-back' size={26} color='#1B2A1E' />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Thêm bài tập mới</Text>
            <View style={{ width: 26 }} />
          </View>

          <Text style={styles.label}>Tên bài tập *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder='Ví dụ: Giãn cơ vai gáy 10 phút'
          />

          <Text style={styles.label}>Mô tả ngắn</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            value={summary}
            onChangeText={setSummary}
            placeholder='Bài tập này giúp gì, tập như thế nào?'
            multiline
          />

          <Text style={styles.label}>Thời lượng chuẩn (phút) *</Text>
          <TextInput
            style={styles.input}
            value={durationText}
            onChangeText={setDurationText}
            keyboardType='number-pad'
            placeholder='Ví dụ: 15'
          />

          <Text style={styles.label}>
            Kcal ước lượng / buổi (để trống nếu chưa biết)
          </Text>
          <TextInput
            style={styles.input}
            value={kcalText}
            onChangeText={setKcalText}
            keyboardType='number-pad'
            placeholder='Ví dụ: 120'
          />

          <Text style={styles.label}>Cấp độ</Text>
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

          <Text style={styles.label}>Link video (không bắt buộc)</Text>
          <TextInput
            style={styles.input}
            value={videoUrl}
            onChangeText={setVideoUrl}
            placeholder='https://...'
            autoCapitalize='none'
          />
          <Text style={styles.hint}>
            Không có link thì trình phát vẫn chạy bộ đếm bước tập, chỉ không có
            video.
          </Text>

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={onSave}
            disabled={saving}
          >
            <Text style={styles.saveText}>
              {saving ? 'Đang lưu...' : 'Lưu bài tập'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1B2A1E' },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1B2A1E',
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F6F8F6',
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: '#1B2A1E',
  },
  levelRow: { flexDirection: 'row', gap: 8 },
  levelChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#EEF1EE',
  },
  levelChipActive: { backgroundColor: '#2E7D32' },
  levelText: { fontSize: 14, color: '#5B665E' },
  levelTextActive: { color: '#fff', fontWeight: '700' },
  hint: { fontSize: 13, color: '#6B7A6E', marginTop: 6 },
  saveBtn: {
    backgroundColor: '#2E7D32',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
