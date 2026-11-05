import React from 'react';
import { StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

// Trinh phat video mau cua bai tap (doi nguyen van tu
// WorkoutPlayerScreen; style video chi cho nay dung nen di theo
// component luon).
export function VideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return <VideoView player={player} style={styles.video} nativeControls />;
}

const styles = StyleSheet.create({
  video: { width: '100%', height: 220 },
});
