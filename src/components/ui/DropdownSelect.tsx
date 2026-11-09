import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

// Nhóm A (v4) — dropdown chọn tự làm bằng Modal + FlatList, không cài
// thêm lib, không dùng picker ngoài. Dùng cho tab Tuần/Tháng của màn Ngủ
// (chọn tuần, tháng, năm). Bấm ngoài modal thì đóng.
export type DropdownOption = { value: string; label: string };

type DropdownSelectProps = {
  label?: string;
  value: string | null;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
};

export function DropdownSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
}: DropdownSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) ?? null;

  const close = () => setOpen(false);
  const pick = (v: string) => {
    onChange(v);
    close();
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        style={styles.button}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <Text
          style={[styles.buttonText, !selected && styles.placeholderText]}
          numberOfLines={1}
        >
          {selected ? selected.label : (placeholder ?? '')}
        </Text>
        <Ionicons name='chevron-down' size={18} color='#111' />
      </TouchableOpacity>
      <Modal
        visible={open}
        transparent
        animationType='fade'
        onRequestClose={close}
      >
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={close} />
          <View style={styles.sheet}>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              style={styles.list}
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <TouchableOpacity
                    style={[styles.item, active && styles.itemActive]}
                    onPress={() => pick(item.value)}
                  >
                    <Text
                      style={[
                        styles.itemText,
                        active && styles.itemTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {active ? (
                      <Ionicons
                        name='checkmark'
                        size={18}
                        color={colors.sageDark}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: '#F1F8E9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  buttonText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#111' },
  placeholderText: { color: '#888', fontWeight: '400' },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    width: '85%',
    maxHeight: 360,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  list: { flexGrow: 0 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  itemActive: { backgroundColor: '#EEF1FF' },
  itemText: { fontSize: 15, color: '#111' },
  itemTextActive: { fontWeight: '700' },
});
