import { StyleSheet } from 'react-native';

export const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 32 },
  totalCard: { borderRadius: 20, padding: 20, alignItems: 'center' },
  totalLabel: { fontSize: 13, fontWeight: '700' },
  // Biểu đồ tròn: số ở giữa vòng, chữ ml sát số.
  ringWrap: { position: 'relative', alignItems: 'center', marginTop: 12 },
  ringCenter: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringValue: { fontSize: 30, fontWeight: '800' },
  ringUnit: { fontSize: 16, fontWeight: '700' },
  ringPct: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  goalText: { fontSize: 13, marginTop: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginTop: 24, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  chipText: { fontSize: 15, fontWeight: '800' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // Căn giữa để chữ "ml" nằm sát số vừa nhập: ô nhập chỉ rộng
    // vừa đủ (110), không dàn hết hàng như trước.
    justifyContent: 'center',
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  input: { flex: 0, width: 110, textAlign: 'center', fontSize: 16, paddingVertical: 14 },
  inputUnit: { fontSize: 15, fontWeight: '700' },
  errorText: { fontSize: 13, marginTop: 8 },
  hint: { fontSize: 13, lineHeight: 18, marginTop: 8 },
  addBtn: {
    borderRadius: 999,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
