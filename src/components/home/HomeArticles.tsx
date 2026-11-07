import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { type Post } from '../../api/workoutApi';
import { ArticleCard } from '../explore/ArticleCard';
import { useSettings } from '../../context/SettingsContext';
import { styles } from './HomeSections.styles';

// Nhóm B (v4): mục "Kiến thức dinh dưỡng" ở Trang chủ render bằng
// ArticleCard chuẩn dùng chung (ảnh cover ở đầu thẻ, tiêu đề đậm,
// summary tối đa 2 dòng, dòng "Xem chi tiết" xanh lá + chevron).
// Giữ nguyên props/export và cách lấy dữ liệu (articles từ DB qua
// getPostsByTopic('nutrition', 3) ở HomeScreen).
export function HomeArticles({
  articles,
  onPressArticle,
  onSeeAll,
}: {
  articles: Post[];
  onPressArticle: (post: Post) => void;
  onSeeAll: () => void;
}) {
  const { t } = useSettings();
  return (
    <View>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{t('home.knowledgeTitle')}</Text>
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={styles.seeAll}>{t('home.viewAll')}</Text>
        </TouchableOpacity>
      </View>
      {articles.length === 0 ? (
        <Text style={styles.emptyText}>{t('home.noArticlesSeed')}</Text>
      ) : (
        articles.map((a, index) => (
          <ArticleCard
            key={`${a.id ?? 'no-id'}-${index}`}
            post={a}
            onOpen={() => onPressArticle(a)}
          />
        ))
      )}
    </View>
  );
}
