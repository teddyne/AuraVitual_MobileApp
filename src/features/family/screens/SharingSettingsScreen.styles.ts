import { StyleSheet } from 'react-native';

// Style con lai cua SharingSettingsScreen sau khi tach hang thanh vien ra
// components/SharingMemberRow (cac muc da doi giu nguyen van tai do).
export const s = StyleSheet.create({
  safe: { flex: 1 },
  // Căn giữa theo chiều dọc và tạo khoảng cách hợp lý
  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: {
    paddingRight: 2,
    paddingVertical: 4,
  },
  back: { 
    fontSize: 28, 
    fontWeight: '300',
    lineHeight: 32,
  },
  headerTitle: { 
    fontSize: 16, 
    fontWeight: '800', 
    flex: 1
  },
  card: { borderRadius: 14, padding: 12, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  icon: { fontSize: 36 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  muted: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginTop: 16, marginBottom: 10 },
  // Màn khóa chia sẻ (chỉ gói Family mới dùng được).
  lockWrap: { flex: 1, justifyContent: 'center' },
  lockCard: { borderRadius: 20, padding: 24, alignItems: 'center', gap: 12 },
  lockTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  lockBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  lockBtn: { borderRadius: 999, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', marginTop: 4, alignSelf: 'stretch' },
  lockBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
