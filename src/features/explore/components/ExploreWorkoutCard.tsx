import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { levelLabel, type Post } from '../../../lib/workoutApi';

// The bai tap trong ExploreScreen (doi nguyen van).
export function ExploreWorkoutCard({
  post: w,
  isFav,
  hasBadImg,
  onToggleFav,
  onOpen,
  onMarkBadImg,
}: {
  post: Post;
  isFav: boolean;
  hasBadImg: boolean;
  onToggleFav: () => void;
  onOpen: () => void;
  onMarkBadImg: () => void;
}) {
  return (
    <View style={styles.workCard}>
      <TouchableOpacity
        onPress={onOpen}
        activeOpacity={0.9}
      >
        {w.cover_url && !hasBadImg ? (
          <Image
            source={{ uri: w.cover_url }}
            style={styles.workImg}
            onError={onMarkBadImg}
          />
        ) : (
          <View
            style={[
              styles.workImg,
              {
                backgroundColor: '#2E7D32',
                justifyContent: 'center',
                alignItems: 'center',
              },
            ]}
          >
            <Ionicons name='fitness' size={48} color='#fff' />
          </View>
        )}
        <View style={styles.levelChip}>
          <Text style={styles.levelText}>
            {levelLabel(w.level).toUpperCase()}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.bookmark}
          onPress={onToggleFav}
        >
          <Ionicons
            name={
              isFav ? 'bookmark' : 'bookmark-outline'
            }
            size={20}
            color='#fff'
          />
        </TouchableOpacity>
        <View style={styles.playMini}>
          <Ionicons
            name='play'
            size={20}
            color='#2E7D32'
            style={{ marginLeft: 2 }}
          />
        </View>
        <View style={styles.workMeta}>
          <Text style={styles.workMetaText}>
            ⏱ {w.duration_min ?? '—'} PHÚT
          </Text>
          {w.kcal_estimate != null && (
            <Text style={styles.workMetaText}>
              🔥 {w.kcal_estimate} kcal
            </Text>
          )}
        </View>
      </TouchableOpacity>
      <View style={styles.workBody}>
        <Text style={styles.workTitle}>{w.title}</Text>
        <TouchableOpacity
          onPress={onOpen}
        >
          <Text style={styles.goNow}>Tập ngay →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  workCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  workImg: { width: '100%', height: 180 },
  levelChip: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  levelText: { fontSize: 12, fontWeight: '700', color: '#2E7D32' },
  bookmark: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playMini: {
    position: 'absolute',
    alignSelf: 'center',
    top: 65,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  workMeta: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    gap: 8,
  },
  workMetaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  workBody: { padding: 14 },
  workTitle: { fontSize: 17, fontWeight: '800', color: '#1B2A1E' },
  goNow: { fontSize: 14, fontWeight: '700', color: '#2E7D32', marginTop: 8 },
});
