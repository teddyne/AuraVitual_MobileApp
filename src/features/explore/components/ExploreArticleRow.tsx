import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Post } from '../../../lib/workoutApi';

// Hang bai viet suc khoe trong ExploreScreen (doi nguyen van).
export function ExploreArticleRow({
  post: a,
  hasBadImg,
  onOpen,
  onMarkBadImg,
}: {
  post: Post;
  hasBadImg: boolean;
  onOpen: () => void;
  onMarkBadImg: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.articleRow}
      onPress={onOpen}
    >
      {a.cover_url && !hasBadImg ? (
        <Image
          source={{ uri: a.cover_url }}
          style={styles.articleThumb}
          onError={onMarkBadImg}
        />
      ) : (
        <View
          style={[
            styles.articleThumb,
            {
              backgroundColor: '#EAF6EC',
              justifyContent: 'center',
              alignItems: 'center',
            },
          ]}
        >
          <Ionicons name='book' size={26} color='#2E7D32' />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.articleTag}>
          DINH DƯỠNG · {a.duration_min ?? '—'} phút đọc
        </Text>
        <Text style={styles.articleTitle} numberOfLines={2}>
          {a.title}
        </Text>
        <Text style={styles.readMore}>Đọc tiếp →</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  articleRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  articleThumb: { width: 84, height: 84, borderRadius: 12 },
  articleTag: { fontSize: 11, fontWeight: '700', color: '#2E7D32' },
  articleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1B2A1E',
    marginTop: 3,
  },
  readMore: { fontSize: 13, fontWeight: '700', color: '#2E7D32', marginTop: 6 },
});
