import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
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
  levelLabel,
  type Post,
} from '../../../lib/workoutApi';

const FAV_KEY = '@auravital:fav_workouts';
type Chip = 'all' | 'foryou' | 'nutrition' | 'workout';
type Tab = 'explore' | 'workout';

export default function ExploreScreen() {
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
      setError(e?.message ?? 'Không tải được dữ liệu.');
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
            Kiểm tra đã chạy migration v6 + seed v6 chưa, rồi mở lại tab này.
          </Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const chipBtn = (key: Chip, label: string) => (
    <TouchableOpacity
      key={key}
      style={[styles.chip, chip === key && styles.chipActive]}
      onPress={() => setChip(key)}
    >
      <Text style={[styles.chipText, chip === key && styles.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FBF9' }}>
        <View style={{ flex: 1 }}>
          <ScrollView
            style={styles.wrap}
            contentContainerStyle={{ paddingBottom: 32 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            <View style={styles.header}>
              <Text style={styles.logo}>🌿 AuraVital</Text>
              <Text style={styles.headerTitle}>Khám phá</Text>
            </View>

            <View style={styles.segment}>
              <TouchableOpacity
                style={[styles.segBtn, tab === 'explore' && styles.segActive]}
                onPress={() => setTab('explore')}
              >
                <Text
                  style={[
                    styles.segText,
                    tab === 'explore' && styles.segTextActive,
                  ]}
                >
                  Khám phá
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segBtn, tab === 'workout' && styles.segActive]}
                onPress={() => setTab('workout')}
              >
                <Text
                  style={[
                    styles.segText,
                    tab === 'workout' && styles.segTextActive,
                  ]}
                >
                  Luyện tập
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name='search' size={20} color='#8A968E' />
              <TextInput
                style={styles.searchInput}
                placeholder='Tìm kiếm chủ đề, bài tập, công thức...'
                value={query}
                onChangeText={setQuery}
              />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipRow}
            >
              {chipBtn('all', 'Tất cả')}
              {chipBtn('foryou', '✨ Dành cho bạn')}
              {chipBtn('nutrition', 'Dinh dưỡng')}
              {chipBtn('workout', 'Bài tập')}
            </ScrollView>

            <Text style={styles.h2}>● Bài tập nổi bật</Text>
            {shownWorkouts.length === 0 && (
              <Text style={styles.empty}>
                Không có bài tập nào khớp bộ lọc.
              </Text>
            )}
            {shownWorkouts.map((w) => (
              <View key={w.id} style={styles.workCard}>
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('WorkoutPlayer', { postId: w.id })
                  }
                  activeOpacity={0.9}
                >
                  {w.cover_url && !badImg[w.id] ? (
                    <Image
                      source={{ uri: w.cover_url }}
                      style={styles.workImg}
                      onError={() => setBadImg((s) => ({ ...s, [w.id]: true }))}
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
                    onPress={() => toggleFav(w.id)}
                  >
                    <Ionicons
                      name={
                        favs.includes(w.id) ? 'bookmark' : 'bookmark-outline'
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
                  {w.summary ? (
                    <Text style={styles.workSummary} numberOfLines={2}>
                      {w.summary}
                    </Text>
                  ) : null}
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate('WorkoutPlayer', { postId: w.id })
                    }
                  >
                    <Text style={styles.goNow}>Tập ngay →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {tab === 'explore' && (
              <>
                <Text style={styles.h2}>📖 Bài viết sức khỏe mới nhất</Text>
                {shownArticles.length === 0 && (
                  <Text style={styles.empty}>
                    Không có bài viết nào khớp bộ lọc.
                  </Text>
                )}
                {shownArticles.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={styles.articleRow}
                    onPress={() =>
                      navigation.navigate('ArticleDetail', { postId: a.id })
                    }
                  >
                    {a.cover_url && !badImg[a.id] ? (
                      <Image
                        source={{ uri: a.cover_url }}
                        style={styles.articleThumb}
                        onError={() =>
                          setBadImg((s) => ({ ...s, [a.id]: true }))
                        }
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

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#F9F9FF', paddingHorizontal: 16 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  error: { color: '#B23A3A', fontSize: 15, textAlign: 'center' },
  hint: { color: '#6B7A6E', fontSize: 14, textAlign: 'center', marginTop: 8 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  logo: { fontSize: 18, fontWeight: '800', color: '#2E7D32' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1B2A1E' },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#EAF0E9',
    borderRadius: 999,
    padding: 4,
    marginTop: 16,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  segActive: { backgroundColor: '#fff' },
  segText: { fontSize: 15, color: '#6B7A6E' },
  segTextActive: { color: '#2E7D32', fontWeight: '700' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 14,
  },
  searchInput: { flex: 1, fontSize: 15 },
  chipRow: { marginTop: 14 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#EEF1FF',
    marginRight: 8,
  },
  chipActive: { backgroundColor: '#2E7D32' },
  chipText: { fontSize: 14, color: '#5B665E' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  h2: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1B2A1E',
    marginTop: 22,
    marginBottom: 12,
  },
  empty: { fontSize: 14, color: '#6B7A6E', marginBottom: 12 },
  workCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
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
  workSummary: { fontSize: 14, color: '#5B665E', marginTop: 4 },
  goNow: { fontSize: 14, fontWeight: '700', color: '#2E7D32', marginTop: 8 },
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
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});
