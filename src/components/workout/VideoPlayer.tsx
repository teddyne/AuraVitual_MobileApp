import React, { useEffect, useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { WebView } from 'react-native-webview';
import { useSettings } from '../../context/SettingsContext';
import { fmtClock } from '../../utils/workout/workoutFormat';

// Lấy mã video YouTube (11 ký tự) từ các dạng link thường gặp:
// youtu.be/ID, youtube.com/watch?v=ID, /embed/ID, /shorts/ID,
// /live/ID, /v/ID (kèm tham số phụ như ?si=... vẫn lấy đúng).
export function getYouTubeVideoId(uri: string): string | null {
  const u = uri.trim();
  const patterns = [
    /(?:youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/|live\/|v\/))([A-Za-z0-9_-]{11})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = re.exec(u);
    if (m) return m[1];
  }
  return null;
}

export type VideoProgress = {
  currentTime: number;
  duration: number;
  playing: boolean;
};

export type VideoSeekRequest = { time: number; nonce: number };

export function VideoPlayer({
  uri,
  onProgress,
  seekRequest,
}: {
  uri: string;
  // Chi co tac dung voi file mp4 (expo-video); link YouTube nhung qua
  // WebView nen khong bao tien do / khong tua duoc tu app.
  onProgress?: (p: VideoProgress) => void;
  seekRequest?: VideoSeekRequest | null;
}) {
  const { t } = useSettings();
  const youtubeId = getYouTubeVideoId(uri);
  if (youtubeId) {
    return (
      <View style={styles.wrap}>
        <WebView
          source={{
            uri: `https://www.youtube.com/embed/${youtubeId}?rel=0`,
          }}
          style={styles.video}
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
        />
      </View>
    );
  }
  // Trông giống link YouTube nhưng không lấy được mã video (link sai,
  // thiếu mã, ...) — báo rõ thay vì để màn hình đen như trước.
  if (/youtu\.?be/i.test(uri)) {
    return (
      <View style={[styles.wrap, styles.invalidWrap]}>
        <Text style={styles.invalidText}>{t('workout.invalidVideoLink')}</Text>
      </View>
    );
  }
  return <ExpoVideoPlayer uri={uri} onProgress={onProgress} seekRequest={seekRequest} />;
}

function ExpoVideoPlayer({
  uri,
  onProgress,
  seekRequest,
}: {
  uri: string;
  onProgress?: (p: VideoProgress) => void;
  seekRequest?: VideoSeekRequest | null;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Giờ đang kéo (preview). null = không kéo.
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const trackWidth = useRef(0);
  const scrubRef = useRef<number | null>(null);
  // PanResponder chỉ tạo 1 lần nên handler của nó phải đọc duration qua
  // ref, không đọc trực tiếp state duration (sẽ kẹt ở giá trị 0 lúc đầu).
  const durationRef = useRef(0);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    const id = setInterval(() => {
      if (scrubRef.current != null) return;
      const ct = player.currentTime ?? 0;
      const d = player.duration ?? 0;
      setCurrentTime(ct);
      setDuration(d);
      setPlaying(player.playing);
      onProgressRef.current?.({ currentTime: ct, duration: d, playing: player.playing });
    }, 500);
    return () => clearInterval(id);
  }, [player]);

  // Bam 1 buoc tap o man hinh cha -> tua video toi dung giay do va phat tiep.
  useEffect(() => {
    if (!seekRequest) return;
    player.currentTime = seekRequest.time;
    player.play();
    setPlaying(true);
  }, [seekRequest, player]);

  const timeFromX = (x: number): number => {
    const d = durationRef.current;
    if (!d || d <= 0 || trackWidth.current <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, x / trackWidth.current));
    return ratio * d;
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Bấm vào thanh cũng tua ngay (grant = 1 lần chạm).
      onPanResponderGrant: (evt) => {
        const t = timeFromX(evt.nativeEvent.locationX);
        scrubRef.current = t;
        setScrubTime(t);
      },
      onPanResponderMove: (evt) => {
        const t = timeFromX(evt.nativeEvent.locationX);
        scrubRef.current = t;
        setScrubTime(t);
      },
      // Chỉ seek thật khi thả tay, để video không giật khi kéo nhanh.
      onPanResponderRelease: () => {
        const t = scrubRef.current;
        scrubRef.current = null;
        setScrubTime(null);
        if (t != null && durationRef.current > 0) {
          player.currentTime = t;
          setCurrentTime(t);
        }
      },
      onPanResponderTerminate: () => {
        scrubRef.current = null;
        setScrubTime(null);
      },
    }),
  ).current;

  const shownTime = scrubTime ?? currentTime;
  const pct = duration > 0 ? Math.min(100, (shownTime / duration) * 100) : 0;

  const togglePlay = () => {
    if (player.playing) {
      player.pause();
      setPlaying(false);
    } else {
      player.play();
      setPlaying(true);
    }
  };

  return (
    <View style={styles.wrap}>
      <VideoView player={player} style={styles.video} nativeControls={false} />
      <View style={styles.controls}>
        <TouchableOpacity style={styles.playBtn} onPress={togglePlay}>
          <Ionicons
            name={playing ? 'pause' : 'play'}
            size={20}
            color='#fff'
            style={playing ? undefined : { marginLeft: 2 }}
          />
        </TouchableOpacity>
        <View
          style={styles.trackHit}
          onLayout={(e) => {
            trackWidth.current = e.nativeEvent.layout.width;
          }}
          {...pan.panHandlers}
        >
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct}%` }]} />
          </View>
          <View style={[styles.thumb, { left: `${pct}%` }]} />
        </View>
        <Text style={styles.time}>
          {fmtClock(shownTime)} / {duration > 0 ? fmtClock(duration) : '--:--'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#000' },
  video: { width: '100%', aspectRatio: 16 / 9 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#000',
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Vùng chạm cao 28px để ngón tay dễ kéo, thanh thật chỉ cao 4px.
  trackHit: { flex: 1, paddingVertical: 12, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: '#555' },
  fill: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 2 },
  thumb: {
    position: 'absolute',
    top: '50%',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    marginLeft: -7,
    marginTop: -7,
  },
  time: { color: '#fff', fontSize: 12, fontVariant: ['tabular-nums'] },
  invalidWrap: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  invalidText: { color: '#fff', fontSize: 13, textAlign: 'center' },
});
