// =====================================================================
// AuraVital — ArticleDetailScreen.tsx (Chi tiết bài viết)
// Đặt tại: src/features/workout/screens/ArticleDetailScreen.tsx
// Route params: { postId: string }.
// Nội dung body lấy nguyên từ posts.body trong DB, không viết thêm,
// không tóm tắt lại. Bài liên quan cũng lấy từ DB (cùng topic với bài
// đang xem, thay vì cùng kind như trước — cột posts.kind đã xóa).
// =====================================================================
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, RefreshControl, ScrollView, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getArticles, getPostById, levelLabel, type Post } from '../../../api/workoutApi';
import { getPostsByTopic, type PostTopic } from '../../../api/auravitalApi';
import {
  isSavedPost,
  toggleSavedPost,
} from '../../../utils/saved/savedPosts';
import { useSettings } from '../../../context/SettingsContext';
import { styles } from './ArticleDetailScreen.styles';

export default function ArticleDetailScreen() {
  const { t } = useSettings();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const postId: string = route.params?.postId;
  const [post, setPost] = useState<Post | null>(null);
  const [related, setRelated] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imgError, setImgError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saved, setSaved] = useState(false);

  // Dấu lưu: đọc lúc mở màn + mỗi lần quay lại (bỏ lưu ở trang Tài
  // khoản thì nút ở đây cập nhật theo).
  const refreshSaved = useCallback(async () => {
    if (!postId) return;
    setSaved(await isSavedPost('article', postId));
  }, [postId]);
  useFocusEffect(
    useCallback(() => {
      void refreshSaved();
    }, [refreshSaved]),
  );
  const onToggleSave = async () => {
    if (!postId) return;
    setSaved(await toggleSavedPost('article', postId));
  };

  const load = useCallback(async () => {
    try {
      if (!postId) throw new Error(t('workout.player.missingPostId'));
      const p = await getPostById(postId);
      if (!p) throw new Error(t('workout.article.notFound'));
      setPost(p);
      // Nhóm A (v3): bài liên quan = cùng topic với bài đang xem.
      // Bài chưa có topic (topic null, seed cũ chưa chạy migration)
      // hoặc topic='workout' thì dự phòng bằng getArticles(10)
      // (mọi bài topic != 'workout') để vẫn có bài liên quan.
      const topic = p.topic as PostTopic | null;
      const all =
        topic && topic !== 'workout'
          ? await getPostsByTopic(topic, 10)
          : await getArticles(10);
      setRelated(all.filter((a) => a.id !== p.id).slice(0, 3));
    } catch (e: any) {
      setError(e?.message ?? t('workout.article.loadFailed'));
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
          <Text style={styles.error}>{error || t('workout.article.noArticle')}</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const paragraphs = (post.body ?? post.summary ?? '').split(/\n\s*\n/).filter(Boolean);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
    <View style={{ paddingHorizontal: 16 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color="#1B2A1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('home.article')}</Text>
        <View style={{ width: 26 }} />
      </View>
    </View>
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >

      {/* Bìa + dấu lưu góc trên bên phải (cùng kiểu card luyện tập). */}
      <View style={{ position: 'relative' }}>
        {post.cover_url && !imgError ? (
          <Image source={{ uri: post.cover_url }} style={styles.cover} onError={() => setImgError(true)} />
        ) : (
          <View style={[styles.cover, { backgroundColor: '#EAF6EC', justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="book" size={56} color="#2E7D32" />
          </View>
        )}
        <TouchableOpacity style={styles.bookmark} onPress={onToggleSave}>
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color='#fff'
          />
        </TouchableOpacity>
      </View>

      <Text style={styles.tag}>
        {t('home.nutritionTag')} · {levelLabel(post.level).toUpperCase()}
        {post.duration_min != null ? ` · ${t('workout.article.readMinutesUpper', { min: post.duration_min })}` : ''}
      </Text>
      <Text style={styles.title}>{post.title}</Text>
      {post.summary ? <Text style={styles.summary}>{post.summary}</Text> : null}

      {paragraphs.map((para, i) => (
        <Text key={i} style={styles.body}>{para}</Text>
      ))}

      {related.length > 0 && (
        <>
          <Text style={styles.h2}>{t('workout.article.related')}</Text>
          {related.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.relRow}
              onPress={() => navigation.push('ArticleDetail', { postId: r.id })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.relTitle} numberOfLines={2}>{r.title}</Text>
                <Text style={styles.relMeta}>
                  {r.duration_min != null ? t('explore.readMinutes', { min: r.duration_min }) : t('home.article')}
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
