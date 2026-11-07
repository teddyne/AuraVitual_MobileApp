import type { RefObject } from 'react';
import type { TextInputInstance } from 'react-native';

// Focus tre 1 nhip: tranh bi nuot focus tren Android khi goi ngay
// trong onSubmitEditing cua o truoc (dung chung man Login / Dang ky).
export function focusInput(inputRef: RefObject<TextInputInstance | null>) {
  setTimeout(() => inputRef.current?.focus(), 50);
}
