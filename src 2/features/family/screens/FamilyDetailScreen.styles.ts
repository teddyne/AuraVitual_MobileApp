import { StyleSheet } from 'react-native';

// Style con lai cua FamilyDetailScreen sau khi tach luoi chi so, danh sach
// su kien va banner SOS ra components/ (cac muc da doi giu nguyen van tai do).
export const s = StyleSheet.create({
  safe: { flex: 1 },
// 1. Thêm alignItems: 'center' để tất cả phần tử trong hàng căn giữa theo chiều dọc
  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  headerTitle: { 
    fontSize: 17, 
    fontWeight: '800', 
    flex: 1,
  },

  headerBtns: { flexDirection: 'row', gap: 14 },
  notFound: { fontSize: 15, marginTop: 20, lineHeight: 22 },
  profileCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 14, marginTop: 1, gap: 12 },
  initialCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 24, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  profileName: { fontSize: 17, fontWeight: '800', flexShrink: 1 },
  editNick: { fontSize: 16 },
  nickRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nickInput: { flex: 1, borderRadius: 8, padding: 8, fontSize: 15 },
  nickSave: { fontWeight: '800' },
  profileSub: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  profileSub2: { fontSize: 13, marginTop: 1 },
  scoreBadge: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  scoreText: { fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 0 },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  sectionRight: { fontSize: 13 },
  live: { fontSize: 13, fontWeight: '700' },
});
