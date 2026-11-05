import AsyncStorage from '@react-native-async-storage/async-storage';

export const ACC_KEY = '@auravital:steps_acc';
export const LAST_SYNC_KEY = '@auravital:steps_last_sync';

// Bộ tích lũy Android: cảm biến Android trả về tổng tích lũy từ lúc khởi
// động lại máy, không phải tổng của hôm nay, nên phải tự cộng delta và chỉ
// lưu cục bộ trên máy này (không đưa lên Supabase).
export type AccState = { date: string; total: number; lastSeen: number };

export async function loadAcc(): Promise<AccState | null> {
  try {
    const raw = await AsyncStorage.getItem(ACC_KEY);
    return raw ? (JSON.parse(raw) as AccState) : null;
  } catch {
    return null;
  }
}

export async function saveAcc(acc: AccState) {
  try {
    await AsyncStorage.setItem(ACC_KEY, JSON.stringify(acc));
  } catch {
    // Mất bộ tích lũy chỉ làm sai số Android trong ngày, không chặn màn hình.
  }
}
