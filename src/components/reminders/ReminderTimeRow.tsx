import React, { useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSettings } from '../../context/SettingsContext';
import type { ThemePalette } from '../../context/SettingsContext';

// Hàng chọn giờ (HH:MM) trong RemindersScreen — bấm vào mở bánh xe
// giờ/phút (spinner, giờ 00→23, phút 00→59) thay cho gõ tay. Giờ đã
// chọn vẫn trả về đúng "HH:MM" qua onChangeText, rồi gọi onBlur để màn
// hình lưu nháp như cũ.
export function ReminderTimeRow({
  label,
  value,
  placeholder,
  theme,
  onChangeText,
  onBlur,
}: {
  label: string;
  value: string;
  placeholder: string;
  theme: ThemePalette;
  onChangeText: (v: string) => void;
  onBlur: () => void;
}) {
  const { t } = useSettings();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Date | null>(null);
  // onBlur của cha đóng lại (closure) theo giá trị nháp lúc render — giữ
  // qua ref để lúc commit luôn gọi đúng bản mới nhất (đã chứa giờ vừa chọn).
  const onBlurRef = useRef(onBlur);
  onBlurRef.current = onBlur;

  const parseToDate = (v: string, fallback: string) => {
    const m =
      /^(\d{1,2}):(\d{2})$/.exec(v.trim()) ??
      /^(\d{1,2}):(\d{2})$/.exec(fallback);
    const hh = m ? Math.min(23, parseInt(m[1], 10)) : 7;
    const mm = m ? Math.min(59, parseInt(m[2], 10)) : 0;
    const d = new Date();
    d.setHours(hh, mm, 0, 0);
    return d;
  };
  const toHHMM = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  // Commit sau khi đóng picker: onChangeText cập nhật state cha trước, rồi
  // mới gọi onBlur (setTimeout để state cha kịp render lại trước khi lưu nháp).
  const commit = (v: string) => {
    onChangeText(v);
    setTimeout(() => onBlurRef.current(), 0);
  };

  return (
    <View>
      <View style={styles.timeRow}>
        <Text style={[styles.rowTitle, { color: theme.text }]}>{label}</Text>
        <TouchableOpacity
          onPress={() => {
            setPicked(parseToDate(value, placeholder));
            setOpen(true);
          }}
          style={[
            styles.timeInput,
            { backgroundColor: theme.cardAlt, justifyContent: 'center' },
          ]}
        >
          <Text
            style={{
              color: value ? theme.text : theme.muted,
              fontWeight: '800',
            }}
          >
            {value || placeholder}
          </Text>
        </TouchableOpacity>
      </View>
      {open ? (
        <>
          <DateTimePicker
            value={picked ?? parseToDate(value, placeholder)}
            mode='time'
            display='spinner'
            is24Hour
            onValueChange={(_e, d) => {
              if (!d) return;
              if (Platform.OS !== 'ios') {
                // Android: spinner là hộp thoại, chọn xong (bấm OK) thì
                // lưu luôn rồi đóng.
                setOpen(false);
                commit(toHHMM(d));
              } else {
                // iOS: spinner hiện inline, xoay tiếp được — chỉ ghi nhận
                // giờ đang chọn, bấm "Đóng" mới lưu.
                setPicked(d);
              }
            }}
            onDismiss={() => setOpen(false)}
          />
          {Platform.OS === 'ios' ? (
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: theme.primary }]}
              onPress={() => {
                setOpen(false);
                commit(toHHMM(picked ?? parseToDate(value, placeholder)));
              }}
            >
              <Text style={styles.closeBtnText}>{t('common.close')}</Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rowTitle: { fontWeight: '800' },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  timeInput: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    width: 90,
    alignItems: 'center',
  },
  closeBtn: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  closeBtnText: { color: '#fff', fontWeight: '700' },
});
