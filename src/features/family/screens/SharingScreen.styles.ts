import { StyleSheet } from 'react-native';

// Style con lai cua SharingScreen sau khi tach component con ra
// components/ (cac muc da doi sang component giu nguyen van tai do).
export const s = StyleSheet.create({
  safe: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,},
  logo: { fontSize: 18, fontWeight: '800', color: '#2E7D32' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  avatarBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10, marginTop: 16 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  title: { fontSize: 26, fontWeight: '800', marginTop: 10, lineHeight: 32 },
  subtitle: { fontSize: 14, marginTop: 6, lineHeight: 20 },
  bannerWrap: { borderRadius: 16, overflow: 'hidden', marginBottom: 10, height: 180, backgroundColor: '#E8F5E9' },
  bannerImg: { width: '100%', height: 180 },
  bannerOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: 'rgba(0,0,0,0.45)' },
  bannerText: { color: '#fff', fontSize: 14, fontWeight: '800', flex: 1 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 6 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 6},
  sectionRight: { fontSize: 13, fontWeight: '700' },
  empty: { fontSize: 14, lineHeight: 20 },
  valueCard: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10, gap: 10 },
  valueIcon: { fontSize: 26 },
  valueTitle: { fontSize: 15, fontWeight: '800' },
  valueBody: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  chipRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  chip: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  chipText: { fontSize: 12, fontWeight: '700' },
  cta: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  ctaText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  ctaOutline: { borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  ctaOutlineText: { fontWeight: '700', fontSize: 15 },
  // Màn khóa chia sẻ (chỉ gói Family mới dùng được).
  lockWrap: { flex: 1, justifyContent: 'center' },
  lockCard: { borderRadius: 20, padding: 24, alignItems: 'center', gap: 12 },
  lockTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  lockBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
