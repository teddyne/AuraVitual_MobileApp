import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Huy hieu icon tron, dung chung cho cac man hinh (truoc day moi man hinh
// tu viet mot ban giong het nhau). solid = nen xanh dam + icon trang,
// dung cho trang thai dang chon (hien chua co cho nao dung solid).
export function IconBadge({ name, solid }: { name: any; solid?: boolean }) {
  return (
    <View style={[styles.iconBadge, solid && { backgroundColor: '#2E7D32' }]}>
      <Ionicons name={name} size={22} color={solid ? '#fff' : '#2E7D32'} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EAF0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
