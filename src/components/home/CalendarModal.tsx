import React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { toKey } from '../../utils/dates';
import type { makeStyles } from '../../features/home/screens/HomeScreen.styles';

// Tach nguyen van tu HomeScreen.tsx: Modal lich chon ngay (doi thang /
// doi nam, luoi ngay, khong cho chon ngay tuong lai). Cac bien cal*
// tinh trong nay nguyen van tu calendarMonth; man hinh chi giu state
// calendarMonth va truyen xuong qua month + onMonthChange. Style lay tu
// makeStyles chung cua man hinh.
export function CalendarModal({
  visible,
  month,
  onMonthChange,
  onClose,
  onSelectDate,
  selectedKey,
  todayKey,
  todayMidnight,
  locale,
  dateLocale,
  closeText,
  s,
}: {
  visible: boolean;
  month: Date;
  onMonthChange: (d: Date) => void;
  onClose: () => void;
  onSelectDate: (d: Date) => void;
  selectedKey: string;
  todayKey: string;
  todayMidnight: Date;
  locale: string;
  dateLocale: string;
  closeText: string;
  s: ReturnType<typeof makeStyles>;
}) {
  const calYear = month.getFullYear();
  const calMonth = month.getMonth();
  const calDays = new Date(calYear, calMonth + 1, 0).getDate();
  const calOffset = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
  const calCells: (number | null)[] = [
    ...Array(calOffset).fill(null),
    ...Array.from({ length: calDays }, (_, i) => i + 1),
  ];
  const weekdayLabels =
    locale === 'en'
      ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
      : ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const monthLabel = month.toLocaleDateString(dateLocale, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType='fade'
      onRequestClose={onClose}
    >
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.calHeader}>
            <TouchableOpacity
              onPress={() =>
                onMonthChange(new Date(calYear, calMonth - 1, 1))
              }
            >
              <Text style={s.calArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={s.calMonthLabel}>{monthLabel}</Text>
            <TouchableOpacity
              onPress={() =>
                onMonthChange(new Date(calYear, calMonth + 1, 1))
              }
            >
              <Text style={s.calArrow}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={s.calHeader}>
            <TouchableOpacity
              onPress={() =>
                onMonthChange(new Date(calYear - 1, calMonth, 1))
              }
            >
              <Text style={s.calArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={s.calMonthLabel}>
              {locale === 'en' ? `Year ${calYear}` : `Năm ${calYear}`}
            </Text>
            <TouchableOpacity
              onPress={() =>
                onMonthChange(new Date(calYear + 1, calMonth, 1))
              }
            >
              <Text style={s.calArrow}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={s.calWeekRow}>
            {weekdayLabels.map((w) => (
              <Text key={w} style={s.calWeekText}>
                {w}
              </Text>
            ))}
          </View>
          <View style={s.calGrid}>
            {calCells.map((day, idx) => {
              if (day === null)
                return <View key={`empty-${idx}`} style={s.calCell} />;
              const cellDate = new Date(calYear, calMonth, day);
              const isFuture = cellDate > todayMidnight;
              const isSelectedCell = toKey(cellDate) === selectedKey;
              const isTodayCell = toKey(cellDate) === todayKey;
              return (
                <TouchableOpacity
                  key={day}
                  disabled={isFuture}
                  onPress={() => onSelectDate(cellDate)}
                  style={[
                    s.calCell,
                    isSelectedCell && s.calCellSelected,
                    isTodayCell && !isSelectedCell && s.calCellToday,
                  ]}
                >
                  <Text
                    style={[
                      s.calCellText,
                      isSelectedCell && s.calCellTextSelected,
                      isFuture && s.calCellTextDisabled,
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={s.primaryBtn} onPress={onClose}>
            <Text style={s.primaryBtnText}>{closeText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
