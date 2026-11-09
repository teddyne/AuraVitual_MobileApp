import React, { useCallback, useState } from 'react';
import {
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../../context/SettingsContext';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppIcon } from '../../../components/ui/AppIcon';
import {
  loadSavedPosts,
  removeSavedPost,
  type SavedPost,
} from '../../../utils/saved/savedPosts';
import { s } from './SavedPostsScreen.styles';

// Trang Đã lưu (Nov 2026): mở từ mục "Đã lưu" đầu tiên trong tab
// Tài khoản. Bố cục theo ảnh tham khảo trang Yêu thích: mỗi card có
// bìa ảnh + nút lưu ở góc trên bên phải bìa + tiêu đề + thông tin
// phụ bên dưới — nhưng 1 card 1 hàng (không xếp 2 cột như ảnh mẫu),
// theo chuẩn UI của app (AppHeader, theme.card, Ionicons).
export default function SavedPostsScreen({ navigation }: any) {
  const { theme, t } = useSettings();
  const [posts, setPosts] = useState<SavedPost[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadSavedPosts()
        .then(setPosts)
        .catch(() => {});
    }, []),
  );

  const openPost = (item: SavedPost) => {
    if (item.kind === 'workout') {
      navigation.navigate('WorkoutPlayer', { postId: item.id });
    } else {
      navigation.navigate('ArticleDetail', { postId: item.id });
    }
  };

  const unsave = async (item: SavedPost) => {
    await removeSavedPost(item.kind, item.id);
    setPosts((prev) => prev.filter((x) => x.id !== item.id));
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <AppHeader title={t('settings.savedSection')} withTopInset={false} />
        </View>
        <ScrollView contentContainerStyle={s.scroll}>
          {posts.length === 0 ? (
            <Text style={[s.empty, { color: theme.muted }]}>
              {t('settings.savedEmpty')}
            </Text>
          ) : (
            posts.map((item) => (
              <TouchableOpacity
                key={`${item.kind}:${item.id}`}
                style={[s.card, { backgroundColor: theme.card }]}
                onPress={() => openPost(item)}
                activeOpacity={0.85}
              >
                <View style={s.coverWrap}>
                  {item.cover_url ? (
                    <Image
                      source={{ uri: item.cover_url }}
                      style={s.cover}
                      resizeMode='cover'
                    />
                  ) : (
                    <View
                      style={[
                        s.coverFallback,
                        { backgroundColor: theme.cardAlt },
                      ]}
                    >
                      <AppIcon
                        name={
                          item.kind === 'workout'
                            ? 'fitness-outline'
                            : 'newspaper-outline'
                        }
                        size={40}
                        tone='primaryDark'
                      />
                    </View>
                  )}
                  <TouchableOpacity
                    style={s.bookmark}
                    onPress={() => void unsave(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name='bookmark' size={20} color='#fff' />
                  </TouchableOpacity>
                </View>
                <View style={s.body}>
                  <Text
                    style={[s.title, { color: theme.text }]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  <Text style={[s.meta, { color: theme.muted }]}>
                    {item.kind === 'workout'
                      ? t('settings.savedWorkout')
                      : t('settings.savedArticle')}
                    {item.duration_min != null
                      ? ` · ${item.duration_min} ${t('home.minutes')}`
                      : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
