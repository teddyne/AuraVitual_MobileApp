import React from 'react';
import { View } from 'react-native';

export function BarcodeIcon() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <View style={{ width: 3, height: 22, backgroundColor: '#000' }} />
      <View style={{ width: 2, height: 22, backgroundColor: '#000' }} />
      <View style={{ width: 4, height: 22, backgroundColor: '#000' }} />
      <View style={{ width: 2, height: 22, backgroundColor: '#000' }} />
      <View style={{ width: 3, height: 22, backgroundColor: '#000' }} />
    </View>
  );
}
