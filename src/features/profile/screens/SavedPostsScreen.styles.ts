import { StyleSheet } from 'react-native';

export const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 32 },
  empty: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 40 },
  // 1 card 1 hàng, bìa ảnh trên cùng (theo ảnh tham khảo trang Yêu
  // thích, nhưng không xếp 2 cột).
  card: {
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
  },
  coverWrap: { position: 'relative', width: '100%', height: 180 },
  cover: { width: '100%', height: '100%' },
  coverFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Nút lưu góc trên bên phải bìa (giống nút lưu ở card Khám phá).
  bookmark: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: 14 },
  title: { fontSize: 16, fontWeight: '800', lineHeight: 22 },
  meta: { fontSize: 13, marginTop: 6 },
});
