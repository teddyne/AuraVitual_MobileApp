import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Doan chuyen tab Kham pha / Luyen tap trong ExploreScreen (doi nguyen van).
export function ExploreTabSegment({
  tab,
  onTabChange,
}: {
  tab: 'explore' | 'workout';
  onTabChange: (t: 'explore' | 'workout') => void;
}) {
  return (
    <View style={styles.segment}>
      <TouchableOpacity
        style={[styles.segBtn, tab === 'explore' && styles.segActive]}
        onPress={() => onTabChange('explore')}
      >
        <Text
          style={[
            styles.segText,
            tab === 'explore' && styles.segTextActive,
          ]}
        >
          Khám phá
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.segBtn, tab === 'workout' && styles.segActive]}
        onPress={() => onTabChange('workout')}
      >
        <Text
          style={[
            styles.segText,
            tab === 'workout' && styles.segTextActive,
          ]}
        >
          Luyện tập
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    backgroundColor: '#EAF0E9',
    borderRadius: 999,
    padding: 4,
    marginTop: 16,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  segActive: { backgroundColor: '#fff' },
  segText: { fontSize: 15, color: '#6B7A6E' },
  segTextActive: { color: '#2E7D32', fontWeight: '700' },
});
