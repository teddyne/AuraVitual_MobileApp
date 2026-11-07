import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  error: { color: '#B23A3A', fontSize: 15, textAlign: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1B2A1E', marginRight: 180 },
  cover: { width: '100%', height: 220, borderRadius: 20 },
  tag: { fontSize: 12, fontWeight: '700', color: '#2E7D32', marginTop: 18 },
  title: { fontSize: 24, fontWeight: '800', color: '#1B2A1E', marginTop: 6, lineHeight: 30 },
  summary: { fontSize: 16, color: '#5B665E', marginTop: 10, lineHeight: 23 },
  body: { fontSize: 16, color: '#2B332E', marginTop: 14, lineHeight: 24 },
  h2: { fontSize: 18, fontWeight: '800', color: '#1B2A1E', marginTop: 28, marginBottom: 10 },
  relRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F6F8F6', borderRadius: 14, padding: 14, marginBottom: 8 },
  relTitle: { fontSize: 15, fontWeight: '700', color: '#1B2A1E' },
  relMeta: { fontSize: 13, color: '#8A968E', marginTop: 3 },
});
