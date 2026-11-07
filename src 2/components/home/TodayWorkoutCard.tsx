import React, { useState } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { levelLabel, type Post } from '../../api/workoutApi';
import { useSettings } from '../../context/SettingsContext';
import { useSubscription } from '../../context/SubscriptionContext';
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
  const { t } = useSettings();
  // Free bấm video thì không mở trình phát mà sang xem các gói.
  const { canWorkout } = useSubscription();
  const navigation = useNavigation<any>();
  const [imgError, setImgError] = useState(false);
  if (!post) {
    return (
      <View>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('home.workoutToday')}</Text>
          <TouchableOpacity onPress={onSeeAll}>
            <Text style={styles.seeAll}>{t('home.viewAll')}</Text>
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
            {t('home.noWorkoutToday')}
            {'\n'}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{t('home.workoutToday')}</Text>
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={styles.seeAll}>{t('home.viewAll')}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.workoutCard}
        onPress={() =>
          canWorkout ? onPress(post) : navigation.navigate('Plans')
        }
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
          {!canWorkout && (
            <View style={[styles.chip, { backgroundColor: '#B7791F' }]}>
              <Text style={styles.chipText}>🔒 {t('home.workoutLocked')}</Text>
            </View>
          )}
          {post.duration_min != null && (
            <View style={[styles.chip, { backgroundColor: '#2E7D32' }]}>
              <Text style={styles.chipText}>
                {post.duration_min} {t('home.minutes')}
              </Text>
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
            name={canWorkout ? 'play' : 'lock-closed'}
            size={28}
            color='#2E7D32'
            style={{ marginLeft: canWorkout ? 3 : 0 }}
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
      {!canWorkout && (
        <TouchableOpacity
          style={styles.lockBtn}
          onPress={() => navigation.navigate('Plans')}
        >
          <Text style={styles.lockBtnText}>
            {t('subscription.viewPlans')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

