// Lưu deep link mới nhất mà app nhận được, để màn ResetPassword có thể
// đọc code khôi phục ngay cả khi app đang chạy nền (trường hợp này
// Linking.getInitialURL() trả về null và listener đăng ký sau khi màn mở
// sẽ bỏ lỡ sự kiện link). Chỉ lưu chuỗi URL, không tự đổi code ở đây.
let pendingUrl: string | null = null;

export function setPendingDeepLink(url: string | null) {
  if (url) pendingUrl = url;
}

export function getPendingDeepLink(): string | null {
  return pendingUrl;
}

export function clearPendingDeepLink() {
  pendingUrl = null;
}
