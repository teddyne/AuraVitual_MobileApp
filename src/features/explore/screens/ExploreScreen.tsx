import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getArticles,
  getWorkouts,
  type Post,
} from '../../../api/workoutApi';
import {
  loadSavedIds,
  toggleSavedPost,
} from '../../../utils/saved/savedPosts';
import { useSettings } from '../../../context/SettingsContext';
import { useSubscription } from '../../../context/SubscriptionContext';
import { ExploreWorkoutCard } from '../../../components/explore/ExploreWorkoutCard';
import { ArticleCard } from '../../../components/explore/ArticleCard';
import { ExploreChipButton } from '../../../components/explore/ExploreChipButton';
import { ExploreTabSegment } from '../../../components/explore/ExploreTabSegment';
import { styles } from './ExploreScreen.styles';

type Tab = 'explore' | 'workout';
type TopicFilter = 'all' | 'nutrition' | 'sleep' | 'cycle' | 'fitness' | 'general';

export default function ExploreScreen() {
  const { t } = useSettings();
  const navigation = useNavigation<any>();
  // Quyền xem video: Pro và Family mở, Free thấy ổ khóa (xem plans.ts).
  const { canWorkout } = useSubscription();
  const [workouts, setWorkouts] = useState<Post[]>([]);
  const [articles, setArticles] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('explore');
  // Nhóm B (v6): lọc bài viết theo topic — hàng chip quay lại theo
  // yêu cầu mới của user (v4 đã bỏ, user đổi ý, không phải lỗi v4).
  const [topicFilter, setTopicFilter] = useState<TopicFilter>('all');
  const [favs, setFavs] = useState<string[]>([]);
  const [badImg, setBadImg] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);

  // Tải lại khi focus (quay lại từ AddWorkout là thấy bài mới ngay)
  // và khi kéo refresh, thay cho chỉ tải 1 lần lúc mount.
  const load = useCallback(async () => {
    try {
      const [w, a] = await Promise.all([getWorkouts(), getArticles(20)]);
      setWorkouts(w);
      setArticles(a);
      setFavs(await loadSavedIds('workout'));
    } catch (e: any) {
      setError(e?.message ?? t('common.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const toggleFav = async (id: string) => {
    const nowSaved = await toggleSavedPost('workout', id);
    setFavs((prev) =>
      nowSaved ? [...prev, id] : prev.filter((x) => x !== id),
    );
  };

  // Nhóm B (v6): lọc topic TRƯỚC, rồi mới lọc theo ô tìm kiếm
  // (matches). Bài chưa có topic (topic = null, seed trước
  // migration) chỉ hiện ở nút "Tất cả".
  const matchesTopic = (p: Post) =>
    topicFilter === 'all' || p.topic === topicFilter;
  const matches = (p: Post) => {
    const q = query.trim().toLowerCase();
    if (q && !`${p.title} ${p.summary ?? ''}`.toLowerCase().includes(q))
      return false;
    return true;
  };

  const shownWorkouts = useMemo(
    () => workouts.filter(matches),
    [workouts, query],
  );
  // Nhóm B (v6): tab Bài viết lọc theo topic đã chọn rồi mới lọc
  // theo tìm kiếm (getArticles đã loại topic='workout').
  const shownArticles = useMemo(
    () =>
      articles.filter(
        (a) => tab === 'explore' && matchesTopic(a) && matches(a),
      ),
    [articles, query, tab, topicFilter],
  );

  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.center, { backgroundColor: '#F9FBF9' }]}>
          <ActivityIndicator size='large' color='#2E7D32' />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }
  if (error) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.center, { backgroundColor: '#F9FBF9' }]}>
          <Text style={styles.error}>{error}</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FBF9' }}>
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16 }}>
            <View style={styles.header}>
              <Text style={styles.logo}>🌿 AuraVital</Text>
              <Text style={styles.headerTitle}>{t('tabs.explore')}</Text>
            </View>
          </View>
          <ScrollView
            style={styles.wrap}
            contentContainerStyle={{ paddingBottom: 32 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >

            <ExploreTabSegment tab={tab} onTabChange={setTab} />

            <View style={styles.searchBox}>
              <Ionicons name='search' size={20} color='#8A968E' />
              <TextInput
                style={styles.searchInput}
                placeholder={t('explore.searchPlaceholder')}
                value={query}
                onChangeText={setQuery}
              />
            </View>

            {/* Nhóm B (v6): hàng lọc topic — chỉ ở tab Bài viết,
                1 hàng duy nhất, cuộn ngang. Tab Luyện tập không
                có hàng này. */}
            {tab === 'explore' && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipRow}
              >
                <ExploreChipButton
                  label={t('notifications.filter.all')}
                  active={topicFilter === 'all'}
                  onPress={() => setTopicFilter('all')}
                />
                <ExploreChipButton
                  label={t('home.nutrition')}
                  active={topicFilter === 'nutrition'}
                  onPress={() => setTopicFilter('nutrition')}
                />
                <ExploreChipButton
                  label={t('home.sleep')}
                  active={topicFilter === 'sleep'}
                  onPress={() => setTopicFilter('sleep')}
                />
                <ExploreChipButton
                  label={t('home.cycle')}
                  active={topicFilter === 'cycle'}
                  onPress={() => setTopicFilter('cycle')}
                />
                <ExploreChipButton
                  label={t('explore.filterFitness')}
                  active={topicFilter === 'fitness'}
                  onPress={() => setTopicFilter('fitness')}
                />
                <ExploreChipButton
                  label={t('explore.filterGeneral')}
                  active={topicFilter === 'general'}
                  onPress={() => setTopicFilter('general')}
                />
              </ScrollView>
            )}

            {tab === 'workout' && (
              <>
                <Text style={styles.h2}> {t('explore.featuredWorkouts')}</Text>
                {shownWorkouts.length === 0 && (
                  <Text style={styles.empty}>
                    {t('explore.noWorkoutsMatch')}
                  </Text>
                )}
                {shownWorkouts.map((w) => (
                  <ExploreWorkoutCard
                    key={w.id}
                    post={w}
                    isFav={favs.includes(w.id)}
                    hasBadImg={!!badImg[w.id]}
                    locked={!canWorkout}
                    onToggleFav={() => toggleFav(w.id)}
                    onOpen={() =>
                      canWorkout
                        ? navigation.navigate('WorkoutPlayer', { postId: w.id })
                        : navigation.navigate('Plans')
                    }
                    onMarkBadImg={() => setBadImg((s) => ({ ...s, [w.id]: true }))}
                  />
                ))}
              </>
            )}

            {tab === 'explore' && (
              <>
                <Text style={styles.h2}> {t('explore.latestArticles')}</Text>
                {shownArticles.length === 0 && (
                  <Text style={styles.empty}>
                    {t('explore.noArticlesMatch')}
                  </Text>
                )}
                {shownArticles.map((a) => (
                  <ArticleCard
                    key={a.id}
                    post={a}
                    onOpen={() =>
                      navigation.navigate('ArticleDetail', { postId: a.id })
                    }
                  />
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
