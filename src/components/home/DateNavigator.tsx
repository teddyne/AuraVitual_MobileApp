import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { makeStyles } from '../../features/home/screens/HomeScreen.styles';

// Tach nguyen van tu HomeScreen.tsx: thanh chon ngay (‹ ngay ›, vuot
// ngang de doi ngay) + dong bao "dang xem ngay cu" + chip "Ve hom nay".
// Style lay tu makeStyles chung cua man hinh.
export function DateNavigator({
  selectedLabel,
  isToday,
  onPrev,
  onNext,
  onOpenCalendar,
  onBackToToday,
  onTouchStart,
  onTouchEnd,
  viewingPastText,
  backToTodayText,
  s,
}: {
  selectedLabel: string;
  isToday: boolean;
  onPrev: () => void;
  onNext: () => void;
  onOpenCalendar: () => void;
  onBackToToday: () => void;
  onTouchStart: (e: any) => void;
  onTouchEnd: (e: any) => void;
  viewingPastText: string;
  backToTodayText: string;
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <>
      <View
        style={s.dateNav}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <TouchableOpacity style={s.dateNavBtn} onPress={onPrev}>
          <Text style={s.dateNavBtnText}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.dateNavCenter} onPress={onOpenCalendar}>
          <Text style={s.dateLabel}>{selectedLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.dateNavBtn}
          onPress={onNext}
          disabled={isToday}
        >
          <Text style={[s.dateNavBtnText, isToday && s.disabledText]}>›</Text>
        </TouchableOpacity>
      </View>
      {!isToday && (
        <>
          <Text style={s.viewingPast}>{viewingPastText}</Text>
          <TouchableOpacity style={s.todayChip} onPress={onBackToToday}>
            <Text style={s.todayChipText}>{backToTodayText}</Text>
          </TouchableOpacity>
        </>
      )}
    </>
  );
}
