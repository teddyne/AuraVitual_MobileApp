import React from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

// Tach nguyen van tu HomeScreen.tsx: banner anh luot ngang Trang chu.
// Mang banners (uri/title/sub) do man hinh xay dung bang tr() roi truyen
// xuong; carousel chi hien thi + bao index hien tai ve qua onIndexChange.
// Style homeBanner* + bannerWidth doi theo nguyen van (chi noi nay dung).
const { width: screenWidth } = Dimensions.get('window');
// Chiều rộng khả dụng của banner = màn hình trừ padding 16 mỗi bên của màn hình chính.
const bannerWidth = screenWidth - 32;

export type HomeBanner = { uri: string; title: string; sub: string };

function makeStyles(theme: any) {
  return StyleSheet.create({
    homeBannerWrap: { marginTop: 16 },
    homeBannerClip: { borderRadius: 16, overflow: 'hidden', height: 170, backgroundColor: '#E8F5E9' },
    homeBannerSlide: { width: bannerWidth, height: 170 },
    homeBannerImg: { width: '100%', height: 170 },
    homeBannerOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: 'rgba(0,0,0,0.45)' },
    homeBannerTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
    homeBannerSub: { color: '#fff', fontSize: 13, marginTop: 4, opacity: 0.9 },
    homeBannerDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 },
    homeBannerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#C8D8CC' },
    homeBannerDotActive: { backgroundColor: theme.primaryDark },
  });
}

export function HomeBannerCarousel({
  banners,
  bannerIndex,
  onIndexChange,
  theme,
}: {
  banners: HomeBanner[];
  bannerIndex: number;
  onIndexChange: (index: number) => void;
  theme: any;
}) {
  const s = makeStyles(theme);
  return (
    <View style={s.homeBannerWrap}>
      <View style={s.homeBannerClip}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            onIndexChange(
              Math.round(
                e.nativeEvent.contentOffset.x / bannerWidth,
              ),
            );
          }}
        >
          {banners.map((item) => (
            <View key={item.uri} style={s.homeBannerSlide}>
              <Image
                source={{ uri: item.uri }}
                style={s.homeBannerImg}
                resizeMode='cover'
              />
              <View style={s.homeBannerOverlay}>
                <Text style={s.homeBannerTitle}>{item.title}</Text>
                <Text style={s.homeBannerSub}>{item.sub}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
      <View style={s.homeBannerDots}>
        {banners.map((item, i) => (
          <View
            key={item.uri}
            style={[
              s.homeBannerDot,
              i === bannerIndex && s.homeBannerDotActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}
