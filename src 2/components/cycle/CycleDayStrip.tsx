import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { fromKey, pad } from '../../utils/dates';
import {
  CELL_GAP,
  PINK_BG,
  PINK_TEXT,
  TODAY_BG,
  WD,
  WD_EN,
  YELLOW_DOT,
} from '../../features/cycle/constants';
import { useSettings } from '../../context/SettingsContext';
import { styles } from '../../features/cycle/screens/CycleTrackingScreen.styles';

// Dai ngay ngang 61 ngay quanh ngay trung tam, doi nguyen van tu
// CycleTrackingScreen (che do 'month').
export function CycleDayStrip({
  stripDays,
  stripCenterKey,
  stripInitialOffset,
  todayKey,
  selectedKey,
  isPeriodDay,
  hasSymptoms,
  isFutureKey,
  onSelect,
}: {
  stripDays: string[];
  stripCenterKey: string;
  stripInitialOffset: number;
  todayKey: string;
  selectedKey: string;
  isPeriodDay: (key: string) => boolean;
  hasSymptoms: (key: string) => boolean;
  isFutureKey: (key: string) => boolean;
  onSelect: (key: string) => void;
}) {
  const { locale } = useSettings();
  const wd = locale === 'en' ? WD_EN : WD;
  return (
    <View style={styles.stripRow}>
      <ScrollView
        key={stripCenterKey}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: stripInitialOffset, y: 0 }}
        contentContainerStyle={{
          gap: CELL_GAP,
          paddingHorizontal: 2,
        }}
      >
        {stripDays.map((key) => {
          const d = fromKey(key);
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;
          const isPeriod = isPeriodDay(key);
          const isSymptom = hasSymptoms(key);
          const isFuture = isFutureKey(key);
          return (
            <TouchableOpacity
              key={key}
              disabled={isFuture}
              style={[
                styles.stripCell,
                {
                  backgroundColor: isPeriod
                    ? PINK_BG
                    : isToday
                      ? TODAY_BG
                      : isSelected
                        ? '#E8F5E9'
                        : '#FFFFFF',
                },
                {
                  borderColor: isToday
                    ? TODAY_BG
                    : isSelected
                      ? '#111111'
                      : isPeriod
                        ? '#F48FB1'
                        : '#EEEEEE',
                },
                isFuture && { opacity: 0.45 },
              ]}
              onPress={() => {
                if (isFuture) return;
                onSelect(key);
              }}
            >
              <Text
                style={[
                  styles.stripWeekday,
                  {
                    color: isFuture
                      ? '#AAAAAA'
                      : isToday
                        ? '#FFFFFF'
                        : isPeriod
                          ? PINK_TEXT
                          : '#888888',
                  },
                ]}
              >
                {wd[d.getDay()]}
              </Text>
              <Text
                style={[
                  styles.stripNum,
                  {
                    color: isFuture
                      ? '#AAAAAA'
                      : isToday
                        ? '#FFFFFF'
                        : isPeriod
                          ? PINK_TEXT
                          : '#111111',
                  },
                ]}
              >
                {pad(d.getDate())}
              </Text>
              <View style={styles.dotRow}>
                {isFuture ? (
                  <View style={styles.dotPlaceholder} />
                ) : isToday ? (
                  <View style={styles.whiteDot} />
                ) : isSymptom ? (
                  <View style={styles.yellowDot} />
                ) : (
                  <View style={styles.dotPlaceholder} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
