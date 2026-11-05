import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type { ThemePalette } from '../../../context/SettingsContext';
import { fmtExpiry } from '../utils/sharingFormat';

// The Ghep doi tuc thi trong SharingScreen (doi nguyen van).
export function SharingPairCard({
  myCode,
  codeInput,
  sending,
  sendMsg,
  rotating,
  theme,
  onCodeInputChange,
  onRotateCode,
  onScanPress,
  onSend,
}: {
  myCode: { code: string; expiresAt: string } | null;
  codeInput: string;
  sending: boolean;
  sendMsg: { ok: boolean; text: string } | null;
  rotating: boolean;
  theme: ThemePalette;
  onCodeInputChange: (v: string) => void;
  onRotateCode: () => void;
  onScanPress: () => void;
  onSend: () => void;
}) {
  return (
    <View style={[styles.pairCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {myCode ? (
        <>
          <Text style={[styles.codeLabel, { color: theme.muted }]}>MÃ MỜI CỦA BẠN</Text>
          <Text style={[styles.code, { color: theme.text }]}>{myCode.code}</Text>
          <Text style={[styles.codeExp, { color: theme.muted }]}>
            Hiệu lực đến {fmtExpiry(myCode.expiresAt)}
          </Text>
          <View style={styles.qrWrap}>
            <QRCode value={myCode.code} size={180} color='#1F2937' backgroundColor='#FFFFFF' />
          </View>
          <TouchableOpacity
            onPress={onRotateCode}
            disabled={rotating}
            style={[
              styles.reloadBtn,
              { borderColor: theme.border, opacity: rotating ? 0.5 : 1 },
            ]}
          >
            <Text style={[styles.reloadText, { color: theme.primaryDark }]}>
              {rotating ? 'Đang tạo…' : '↻ Tạo mã mới'}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={[styles.empty, { color: theme.muted }]}>
          Chưa tạo được mã mời, kéo xuống để thử lại hoặc kiểm tra mạng.
        </Text>
      )}

      <View style={styles.divider}>
        <Text style={[styles.dividerText, { color: theme.muted, paddingTop: 15 }]}>- nhập mã chia sẻ của người khác -</Text>
      </View>
      <TextInput
        value={codeInput}
        onChangeText={(t) => onCodeInputChange(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        placeholder='Nhập mã 8 ký tự'
        placeholderTextColor={theme.muted}
        autoCapitalize='characters'
        maxLength={8}
        style={[styles.codeInput, { backgroundColor: theme.cardAlt, color: theme.text }]}
      />
      <View style={styles.reqBtns}>
        <TouchableOpacity
          onPress={onScanPress}
          style={[styles.scanBtn, { borderColor: theme.border }]}
        >
          <Text style={[styles.scanText, { color: theme.text }]}>📷 Quét QR</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onSend}
          disabled={sending}
          style={[styles.sendBtn, { backgroundColor: theme.primaryDark, opacity: sending ? 0.6 : 1 }]}
        >
          <Text style={styles.sendText}>{sending ? 'Đang gửi...' : 'Gửi lời mời'}</Text>
        </TouchableOpacity>
      </View>
      {sendMsg && (
        <Text style={[styles.sendMsg, { color: sendMsg.ok ? theme.primaryDark : '#C62828' }]}>
          {sendMsg.text}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pairCard: { borderWidth: 1, borderRadius: 16, padding: 16, alignItems: 'center' },
  codeLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  code: { fontSize: 30, fontWeight: '900', letterSpacing: 4, marginTop: 4 },
  codeExp: { fontSize: 13, marginTop: 2 },
  qrWrap: { marginTop: 14, padding: 12, backgroundColor: '#FFFFFF', borderRadius: 12 },
  reloadBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, marginTop: 12 },
  reloadText: { fontWeight: '700' },
  divider: { marginVertical: 16 },
  dividerText: { fontSize: 13, },
  codeInput: { width: '100%', borderRadius: 10, padding: 12, fontSize: 16, letterSpacing: 3, textAlign: 'center' },
  reqBtns: { flexDirection: 'row', gap: 10, marginTop: 10 },
  scanBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  scanText: { fontWeight: '700' },
  sendBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  sendText: { color: '#FFFFFF', fontWeight: '800' },
  sendMsg: { fontSize: 13, marginTop: 10, textAlign: 'center', lineHeight: 18 },
  empty: { fontSize: 14, lineHeight: 20 },
});
