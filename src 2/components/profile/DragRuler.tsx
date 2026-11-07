import React, { useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import { s } from '../../features/profile/screens/ProfileSetupScreen.styles';

// Dời nguyên văn từ screens/ProfileSetupScreen.tsx; style s.rulerTrack /
// s.rulerFill / s.rulerThumb vẫn nằm trong ProfileSetupScreen.styles.ts.
export function DragRuler({
  value,
  min,
  max,
  step,
  onChange,
  onDragStart,
  onDragEnd,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const [w, setW] = useState(0);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: (e) => {
        if (!w) return;
        onDragStart?.();
        const r = Math.max(0, Math.min(1, e.nativeEvent.locationX / w));
        onChange(
          Math.max(
            min,
            Math.min(max, Math.round((min + r * (max - min)) / step) * step),
          ),
        );
      },
      onPanResponderMove: (e) => {
        if (!w) return;
        const r = Math.max(0, Math.min(1, e.nativeEvent.locationX / w));
        onChange(
          Math.max(
            min,
            Math.min(max, Math.round((min + r * (max - min)) / step) * step),
          ),
        );
      },
      onPanResponderRelease: () => {
        onDragEnd?.();
      },
      onPanResponderTerminate: () => {
        onDragEnd?.();
      },
    }),
  ).current;
  // Kẹp vị trí hiển thị 0-100% để giá trị gõ tay ngoài [min, max]
  // (vd hồ sơ cũ) không đẩy núm ra ngoài thước; onChange vẫn kẹp
  // đúng min/max khi kéo.
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      {...pan.panHandlers}
      style={s.rulerTrack}
    >
      <View style={[s.rulerFill, { width: `${pct}%` }]} />
      <View style={[s.rulerThumb, { left: `${pct}%` }]} />
    </View>
  );
}
