import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1B2A1E' },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1B2A1E',
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F6F8F6',
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: '#1B2A1E',
  },
  levelRow: { flexDirection: 'row', gap: 8 },
  levelChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#EEF1EE',
  },
  levelChipActive: { backgroundColor: '#2E7D32' },
  levelText: { fontSize: 14, color: '#5B665E' },
  levelTextActive: { color: '#fff', fontWeight: '700' },
  hint: { fontSize: 13, color: '#6B7A6E', marginTop: 6 },
  saveBtn: {
    backgroundColor: '#2E7D32',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
