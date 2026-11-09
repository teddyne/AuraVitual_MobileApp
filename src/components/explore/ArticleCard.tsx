import React, { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSettings } from '../../context/SettingsContext';
import {
  isSavedPost,
  toggleSavedPost,
} from '../../utils/saved/savedPosts';

// Thẻ bài viết chuẩn dùng chung (Nhóm B, v4) — mẫu: mục "Kiến thức
// chu kỳ & Thể trạng" ở CycleTrackingScreen: ảnh cover ở đầu thẻ,
// tiêu đề đậm, summary tối đa 2 dòng, dòng "Xem chi tiết" màu xanh lá
// + chevron, bấm mở ArticleDetail qua prop onOpen. Mọi nơi hiển thị
// bài viết (Trang chủ, Khám phá, Chu kỳ, Giấc ngủ) đều dùng thẻ này.
export type ArticleCardPost = {
  id: string;
  title: string;
  summary: string | null;
  cover_url?: string | null;
};

export function ArticleCard({
  post,
  onOpen,
  hasBadImg,
  onImageError,
}: {
  post: ArticleCardPost;
  onOpen: () => void;
  hasBadImg?: boolean;
  onImageError?: () => void;
}) {
  const { t, locale } = useSettings();
  // Dự phòng khi key i18n chưa được gộp vào translations: hiện thẳng
  // chữ vi/en thay vì hiện tên key (cùng cách làm ở CycleTrackingScreen).
  const viewDetail = (() => {
    try {
      const v = t('cycle.viewDetail');
      if (v && v !== 'cycle.viewDetail') return v;
    } catch {}
    return locale === 'en' ? 'View details' : 'Xem chi tiết';
  })();
  const [imgFailed, setImgFailed] = useState(false);
  const showPlaceholder = !post.cover_url || hasBadImg || imgFailed;
  const [saved, setSaved] = useState(false);
  const refreshSaved = useCallback(() => {
    let alive = true;
    isSavedPost('article', post.id).then((v) => {
      if (alive) setSaved(v);
    });
    return () => {
      alive = false;
    };
  }, [post.id]);
  useEffect(() => refreshSaved(), [refreshSaved]);
  useFocusEffect(
    useCallback(() => {
      const cleanup = refreshSaved();
      return cleanup;
    }, [refreshSaved]),
  );
  const onToggleSave = async () => {
    const next = await toggleSavedPost('article', post.id);
    setSaved(next);
  };
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onOpen}
      activeOpacity={0.85}
    >
      {showPlaceholder ? (
        <View style={[styles.cover, styles.coverPlaceholder]}>
          <Ionicons name='image-outline' size={40} color='#2E7D32' />
        </View>
      ) : (
        <Image
          source={{ uri: post.cover_url as string }}
          style={styles.cover}
          onError={() => {
            setImgFailed(true);
            onImageError?.();
          }}
        />
      )}
      {/* Dấu lưu góc trên bên phải của bìa (cùng kiểu card luyện tập). */}
      <TouchableOpacity style={styles.bookmark} onPress={onToggleSave}>
        <Ionicons
          name={saved ? 'bookmark' : 'bookmark-outline'}
          size={20}
          color='#fff'
        />
      </TouchableOpacity>
      <View style={styles.body}>
        <Text style={styles.title}>{post.title}</Text>
        {post.summary ? (
          <Text style={styles.summary} numberOfLines={2}>
            {post.summary}
          </Text>
        ) : null}
        <View style={styles.moreRow}>
          <Text style={styles.moreText}>{viewDetail}</Text>
          <Ionicons name='chevron-forward' size={18} color='#2E7D32' />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  cover: { width: '100%', height: 160 },
  coverPlaceholder: {
    backgroundColor: '#EAF6EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  body: { padding: 14 },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    lineHeight: 22,
  },
  summary: { fontSize: 14, color: '#444444', lineHeight: 20, marginTop: 4 },
  moreRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  moreText: { fontSize: 14, fontWeight: '700', color: '#2E7D32' },
});
