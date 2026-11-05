import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView } from 'expo-camera';
import { CODE_RE } from '../utils/sharingFormat';

// Quet QR: camera toan man hinh, chi nhan ma 8 ky tu hop le (doi nguyen van tu SharingScreen).
export function SharingQrScannerModal({
  visible,
  onClose,
  onCodeScanned,
}: {
  visible: boolean;
  onClose: () => void;
  onCodeScanned: (code: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType='slide'>
      <View style={styles.wrap}>
        <CameraView
          style={styles.camera}
          facing='back'
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => {
            const code = data.trim().toUpperCase();
            if (CODE_RE.test(code)) {
              onCodeScanned(code);
            }
          }}
        />
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>Đóng</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000', justifyContent: 'flex-end' },
  camera: { ...StyleSheet.absoluteFill },
  closeBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    margin: 20,
    alignItems: 'center',
  },
  closeText: { fontWeight: '800', fontSize: 15 },
});
