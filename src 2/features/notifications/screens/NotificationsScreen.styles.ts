import { StyleSheet } from 'react-native';

// Style con lai cua NotificationsScreen sau khi tach the thong bao va hang
// vien loc ra components/ (cac muc da doi giu nguyen van tai do).
export const s = StyleSheet.create({
  safe: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summary: { fontWeight: '700' },
  readAll: { fontWeight: '800' },
  hint: { fontSize: 11, marginTop: 14, marginBottom: 8 },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  sectionRight: { fontWeight: '700' },
  empty: { lineHeight: 20, marginTop: 12 },
});
