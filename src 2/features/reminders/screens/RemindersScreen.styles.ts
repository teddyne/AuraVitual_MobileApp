import { StyleSheet } from 'react-native';

// Style con lai cua RemindersScreen sau khi tach the bat/tat va hang nhap
// gio ra components/ (cac muc da doi giu nguyen van tai do).
export const s = StyleSheet.create({
  safe: { flex: 1 },
  pillRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  pillBtn: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  pillText: { fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  summaryChip: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  summaryChipText: { fontWeight: '700', fontSize: 14 },
  summaryPill: {
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    minWidth: 84,
  },
  summaryTime: { fontWeight: '800', fontSize: 15 },
  summaryLabel: { fontSize: 12, marginTop: 2 },
  previewCard: { borderRadius: 16, padding: 14, marginTop: 12 },
  previewTitle: { fontWeight: '800', marginBottom: 6 },
  previewLine: { lineHeight: 20, marginTop: 2 },
  windowLine: { fontSize: 13, lineHeight: 20 },
  windowNote: { fontSize: 12, fontStyle: 'italic', marginTop: 6, lineHeight: 17 },
  note: { textAlign: 'center', fontSize: 12, marginTop: 12 },
  primaryBtn: {
    borderRadius: 999,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
