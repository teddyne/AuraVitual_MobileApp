import React, { useState } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { levelLabel, type Post } from '../../lib/workoutApi';
import { useSettings } from '../../context/SettingsContext';
import { styles } from './HomeSections.styles';

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
  const [badImg, setBadImg] = useState<Record<string, boolean>>({});
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
          <TouchableOpacity
            key={`${a.id ?? 'no-id'}-${index}`}
            style={styles.articleRow}
            onPress={() => onPressArticle(a)}
          >
            {a.cover_url && !badImg[a.id] ? (
              <Image
                source={{ uri: a.cover_url }}
                style={styles.articleThumb}
                onError={() => setBadImg((s) => ({ ...s, [a.id]: true }))}
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
                <Ionicons name='book' size={28} color='#2E7D32' />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.articleTitle} numberOfLines={2}>
                {a.title}
              </Text>
              {a.summary ? (
                <Text style={styles.articleSummary} numberOfLines={2}>
                  {a.summary}
                </Text>
              ) : null}
              <Text style={styles.articleMeta}>
                {a.duration_min != null
                  ? t('home.readMinutes', { min: a.duration_min })
                  : t('home.article')}{' '}
                · {levelLabel(a.level)}
              </Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

