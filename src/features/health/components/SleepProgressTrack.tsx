import React, { useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import { PRIMARY } from '../constants';

export function ProgressTrack({
  progress,
  onSeek,
}: {
  progress: number;
  onSeek: (ratio: number) => void;
}) {
  const [w, setW] = useState(0);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        if (!w) return;
        onSeek(Math.max(0, Math.min(1, e.nativeEvent.locationX / w)));
      },
      onPanResponderMove: (e) => {
        if (!w) return;
        onSeek(Math.max(0, Math.min(1, e.nativeEvent.locationX / w)));
      },
    }),
  ).current;
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      {...pan.panHandlers}
      style={{ height: 28, justifyContent: 'center' }}
    >
      <View
        style={{ height: 6, backgroundColor: '#D9E2F3', borderRadius: 3 }}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          height: 6,
          width: `${pct * 100}%`,
          backgroundColor: PRIMARY,
          borderRadius: 3,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: `${pct * 100}%`,
          marginLeft: -11,
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: PRIMARY,
          borderWidth: 2,
          borderColor: '#fff',
        }}
      />
    </View>
  );
}

