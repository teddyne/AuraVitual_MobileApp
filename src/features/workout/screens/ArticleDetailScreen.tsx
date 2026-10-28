// =====================================================================
// AuraVital — ArticleDetailScreen.tsx (Chi tiết bài viết)
// Đặt tại: src/features/workout/screens/ArticleDetailScreen.tsx
// Route params: { postId: string }.
// Nội dung body lấy nguyên từ posts.body trong DB, không viết thêm,
// không tóm tắt lại. Bài liên quan cũng lấy từ DB (cùng kind=article).
// =====================================================================
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getArticles, getPostById, levelLabel, type Post } from '../../../lib/workoutApi';

export default function ArticleDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const postId: string = route.params?.postId;
  const [post, setPost] = useState<Post | null>(null);
  const [related, setRelated] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imgError, setImgError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      if (!postId) throw new Error('Thiếu postId.');
      const [p, all] = await Promise.all([getPostById(postId), getArticles(10)]);
      if (!p) throw new Error('Không tìm thấy bài viết này trong database.');
      setPost(p);
      setRelated(all.filter((a) => a.id !== p.id).slice(0, 3));
    } catch (e: any) {
      setError(e?.message ?? 'Không tải được bài viết.');
    } finally {
      setLoading(false);
    }
  }, [postId]);
  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.center, { backgroundColor: '#fff' }]}>
          <ActivityIndicator size="large" color="#2E7D32" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }
  if (error || !post) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.center, { backgroundColor: '#fff' }]}>
          <Text style={styles.error}>{error || 'Không có bài viết.'}</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const paragraphs = (post.body ?? post.summary ?? '').split(/\n\s*\n/).filter(Boolean);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color="#1B2A1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bài viết</Text>
        <View style={{ width: 26 }} />
      </View>

      {post.cover_url && !imgError ? (
        <Image source={{ uri: post.cover_url }} style={styles.cover} onError={() => setImgError(true)} />
      ) : (
        <View style={[styles.cover, { backgroundColor: '#EAF6EC', justifyContent: 'center', alignItems: 'center' }]}>
          <Ionicons name="book" size={56} color="#2E7D32" />
        </View>
      )}

      <Text style={styles.tag}>
        DINH DƯỠNG · {levelLabel(post.level).toUpperCase()}
        {post.duration_min != null ? ` · ${post.duration_min} PHÚT ĐỌC` : ''}
      </Text>
      <Text style={styles.title}>{post.title}</Text>
      {post.summary ? <Text style={styles.summary}>{post.summary}</Text> : null}

      {paragraphs.map((para, i) => (
        <Text key={i} style={styles.body}>{para}</Text>
      ))}

      {related.length > 0 && (
        <>
          <Text style={styles.h2}>Bài viết liên quan</Text>
          {related.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.relRow}
              onPress={() => navigation.push('ArticleDetail', { postId: r.id })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.relTitle} numberOfLines={2}>{r.title}</Text>
                <Text style={styles.relMeta}>
                  {r.duration_min != null ? `${r.duration_min} phút đọc` : 'Bài viết'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#8A968E" />
            </TouchableOpacity>
          ))}
        </>
      )}
    </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  error: { color: '#B23A3A', fontSize: 15, textAlign: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1B2A1E' },
  cover: { width: '100%', height: 220, borderRadius: 20 },
  tag: { fontSize: 12, fontWeight: '700', color: '#2E7D32', marginTop: 18 },
  title: { fontSize: 24, fontWeight: '800', color: '#1B2A1E', marginTop: 6, lineHeight: 30 },
  summary: { fontSize: 16, color: '#5B665E', marginTop: 10, lineHeight: 23 },
  body: { fontSize: 16, color: '#2B332E', marginTop: 14, lineHeight: 24 },
  h2: { fontSize: 18, fontWeight: '800', color: '#1B2A1E', marginTop: 28, marginBottom: 10 },
  relRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F6F8F6', borderRadius: 14, padding: 14, marginBottom: 8 },
  relTitle: { fontSize: 15, fontWeight: '700', color: '#1B2A1E' },
  relMeta: { fontSize: 13, color: '#8A968E', marginTop: 3 },
});
