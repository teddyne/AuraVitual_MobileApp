import React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MONTH_NAMES, MONTH_NAMES_EN } from '../../features/cycle/constants';
import { useSettings } from '../../context/SettingsContext';
import { styles } from '../../features/cycle/screens/CycleTrackingScreen.styles';

// Modal chon thang/nam, doi nguyen van tu CycleTrackingScreen.
export function CycleMonthPicker({
  visible,
  pickerYear,
  selectedYear,
  selectedMonth,
  todayYear,
  onYearChange,
  onPickMonth,
  onClose,
}: {
  visible: boolean;
  pickerYear: number;
  selectedYear: number;
  selectedMonth: number;
  todayYear: number;
  onYearChange: (year: number) => void;
  onPickMonth: (year: number, month: number) => void;
  onClose: () => void;
}) {
  const { t, locale } = useSettings();
  const monthNames = locale === 'en' ? MONTH_NAMES_EN : MONTH_NAMES;
  return (
    <Modal visible={visible} transparent animationType='slide'>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={() => onYearChange(pickerYear - 1)}>
              <Ionicons name='chevron-back' size={26} color='#111111' />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>
              {t('cycle.yearLabel', { year: pickerYear })}
            </Text>
            <TouchableOpacity
              disabled={pickerYear >= todayYear}
              onPress={() => {
                if (pickerYear < todayYear) onYearChange(pickerYear + 1);
              }}
            >
              <Ionicons
                name='chevron-forward'
                size={26}
                color='#111111'
                style={pickerYear >= todayYear && { opacity: 0.3 }}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.yearGrid}>
            {monthNames.map((name, m) => (
              <TouchableOpacity
                key={name}
                style={[
                  styles.yearCell,
                  pickerYear === selectedYear &&
                    m === selectedMonth &&
                    styles.yearCellActive,
                ]}
                onPress={() => onPickMonth(pickerYear, m)}
              >
                <Text
                  style={[
                    styles.yearMonth,
                    pickerYear === selectedYear &&
                      m === selectedMonth &&
                      styles.yearMonthActive,
                  ]}
                >
                  {name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.saveButton} onPress={onClose}>
            <Text style={styles.saveButtonText}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
