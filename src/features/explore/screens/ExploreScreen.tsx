import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import {
  getArticles,
  getWorkouts,
  type Post,
} from '../../../lib/workoutApi';
import { FAV_KEY } from '../constants';
import { useSettings } from '../../../context/SettingsContext';
import { ExploreWorkoutCard } from '../components/ExploreWorkoutCard';
import { ExploreArticleRow } from '../components/ExploreArticleRow';
import { ExploreChipButton } from '../components/ExploreChipButton';
import { ExploreTabSegment } from '../components/ExploreTabSegment';
import { styles } from './ExploreScreen.styles';

type Chip = 'all' | 'foryou' | 'nutrition' | 'workout';
type Tab = 'explore' | 'workout';

export default function ExploreScreen() {
  const { t } = useSettings();
  const navigation = useNavigation<any>();
  const [workouts, setWorkouts] = useState<Post[]>([]);
  const [articles, setArticles] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<Chip>('all');
  const [tab, setTab] = useState<Tab>('explore');
  const [favs, setFavs] = useState<string[]>([]);
  const [badImg, setBadImg] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);

  // Tải lại khi focus (quay lại từ AddWorkout là thấy bài mới ngay)
  // và khi kéo refresh, thay cho chỉ tải 1 lần lúc mount.
  const load = useCallback(async () => {
    try {
      const [w, a] = await Promise.all([getWorkouts(), getArticles(10)]);
      setWorkouts(w);
      setArticles(a);
      const saved = await AsyncStorage.getItem(FAV_KEY);
      if (saved) setFavs(JSON.parse(saved) as string[]);
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
    const next = favs.includes(id)
      ? favs.filter((x) => x !== id)
      : [...favs, id];
    setFavs(next);
    await AsyncStorage.setItem(FAV_KEY, JSON.stringify(next));
  };

  const matches = (p: Post) => {
    const q = query.trim().toLowerCase();
    if (q && !`${p.title} ${p.summary ?? ''}`.toLowerCase().includes(q))
      return false;
    if (chip === 'foryou') return p.level === 'beginner';
    if (chip === 'nutrition') return p.kind === 'article';
    if (chip === 'workout') return p.kind === 'workout';
    return true;
  };

  const shownWorkouts = useMemo(
    () => workouts.filter(matches),
    [workouts, chip, query],
  );
  const shownArticles = useMemo(
    () => articles.filter((a) => tab === 'explore' && matches(a)),
    [articles, chip, query, tab],
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
          <Text style={styles.hint}>
            {t('explore.migrationHint')}
          </Text>
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

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipRow}
            >
              <ExploreChipButton label={t('explore.chipAll')} active={chip === 'all'} onPress={() => setChip('all')} />
              <ExploreChipButton label={t('explore.chipForYou')} active={chip === 'foryou'} onPress={() => setChip('foryou')} />
              <ExploreChipButton label={t('home.nutrition')} active={chip === 'nutrition'} onPress={() => setChip('nutrition')} />
              <ExploreChipButton label={t('home.workout')} active={chip === 'workout'} onPress={() => setChip('workout')} />
            </ScrollView>

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
                onToggleFav={() => toggleFav(w.id)}
                onOpen={() =>
                  navigation.navigate('WorkoutPlayer', { postId: w.id })
                }
                onMarkBadImg={() => setBadImg((s) => ({ ...s, [w.id]: true }))}
              />
            ))}

            {tab === 'explore' && (
              <>
                <Text style={styles.h2}> {t('explore.latestArticles')}</Text>
                {shownArticles.length === 0 && (
                  <Text style={styles.empty}>
                    {t('explore.noArticlesMatch')}
                  </Text>
                )}
                {shownArticles.map((a) => (
                  <ExploreArticleRow
                    key={a.id}
                    post={a}
                    hasBadImg={!!badImg[a.id]}
                    onOpen={() =>
                      navigation.navigate('ArticleDetail', { postId: a.id })
                    }
                    onMarkBadImg={() =>
                      setBadImg((s) => ({ ...s, [a.id]: true }))
                    }
                  />
                ))}
              </>
            )}
          </ScrollView>
          <TouchableOpacity
            style={styles.fab}
            onPress={() => navigation.navigate('AddWorkout')}
          >
            <Ionicons name='add' size={30} color='#fff' />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
