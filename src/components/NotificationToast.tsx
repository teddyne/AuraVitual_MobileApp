import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { navigationRef } from '../navigation/navigationRef';

// =====================================================================
// Toast kiểu Zalo: banner nhỏ trượt ở phía trên cùng, hiện trên MỌI
// màn hình (gắn ở gốc app, trên cả NavigationContainer).
// - Tự tắt sau 3 giây.
// - Bấm vào thì vào màn đích (mặc định: trang Thông báo).
// - Thông báo mới đến thì thay luôn cái đang hiện (đặt lại timer).
// =====================================================================

export type ToastTarget = { screen: string; params?: any };

export type ToastData = {
  title: string;
  body: string;
  target?: ToastTarget;
};

type ToastValue = {
  toast: ToastData | null;
  showToast: (t: ToastData) => void;
  hideToast: () => void;
};

const Ctx = createContext<ToastValue>({
  toast: null,
  showToast: () => {},
  hideToast: () => {},
});

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback(
    (t: ToastData) => {
      if (timer.current) clearTimeout(timer.current);
      setToast(t);
      timer.current = setTimeout(() => setToast(null), 3000);
    },
    [],
  );

  return (
    <Ctx.Provider value={{ toast, showToast, hideToast }}>
      {children}
    </Ctx.Provider>
  );
}

export function ToastBanner() {
  const { toast, hideToast } = useToast();
  if (!toast) return null;

  const onPress = () => {
    const target = toast.target ?? { screen: 'Notifications' };
    hideToast();
    if (!navigationRef.isReady()) return;
    try {
      if (target.screen === 'Sharing') {
        // Tab Chia sẻ nằm trong stack 'Main'.
        (navigationRef as any).navigate('Main', { screen: 'ShareTab' });
      } else {
        (navigationRef as any).navigate(target.screen, target.params);
      }
    } catch {}
  };

  return (
    <View style={styles.overlay} pointerEvents='box-none'>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.9}
          style={styles.card}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {toast.title}
            </Text>
            <Text style={styles.body} numberOfLines={2}>
              {toast.body}
            </Text>
          </View>
          <TouchableOpacity onPress={hideToast} hitSlop={10}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    elevation: 999,
  },
  safe: {
    paddingHorizontal: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
  },
  body: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 2,
  },
  close: {
    fontSize: 16,
    color: '#9CA3AF',
    marginLeft: 10,
  },
});
