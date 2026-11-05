import React, { useState } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { levelLabel, type Post } from '../../lib/workoutApi';
import { styles } from './HomeSections.styles';

export function TodayWorkoutCard({
  post,
  onPress,
  onSeeAll,
}: {
  post: Post | null;
  onPress: (post: Post) => void;
  onSeeAll: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  if (!post) {
    return (
      <View>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Đề xuất bài tập hôm nay</Text>
          <TouchableOpacity onPress={onSeeAll}>
            <Text style={styles.seeAll}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>
        <View
          style={[
            styles.workoutCard,
            {
              backgroundColor: '#EAF6EC',
              justifyContent: 'center',
              alignItems: 'center',
            },
          ]}
        >
          <Text style={styles.emptyText}>
            Chưa có bài tập.{'\n'}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Đề xuất bài tập hôm nay</Text>
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={styles.seeAll}>Xem tất cả</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.workoutCard}
        onPress={() => onPress(post)}
        activeOpacity={0.9}
      >
        {post.cover_url && !imgError ? (
          <Image
            source={{ uri: post.cover_url }}
            style={styles.workoutImage}
            onError={() => setImgError(true)}
          />
        ) : (
          <View
            style={[
              styles.workoutImage,
              {
                backgroundColor: '#2E7D32',
                justifyContent: 'center',
                alignItems: 'center',
              },
            ]}
          >
            <Ionicons name='fitness' size={64} color='#fff' />
          </View>
        )}
        <View style={styles.workoutOverlay} />
        <View style={styles.chipRow}>
          {post.duration_min != null && (
            <View style={[styles.chip, { backgroundColor: '#2E7D32' }]}>
              <Text style={styles.chipText}>{post.duration_min} PHÚT</Text>
            </View>
          )}
          <View
            style={[styles.chip, { backgroundColor: 'rgba(120,120,120,0.9)' }]}
          >
            <Text style={styles.chipText}>
              {levelLabel(post.level).toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={styles.playBtn}>
          <Ionicons
            name='play'
            size={28}
            color='#2E7D32'
            style={{ marginLeft: 3 }}
          />
        </View>
        <View style={styles.workoutText}>
          <Text style={styles.workoutTitle} numberOfLines={2}>
            {post.title}
          </Text>
          {post.summary ? (
            <Text style={styles.workoutSummary} numberOfLines={2}>
              {post.summary}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    </View>
  );
}

