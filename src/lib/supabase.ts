// SHIM — file thật đã dời sang src/api/supabase.ts (xem README_CAU_TRUC_MOI.md).
// Giữ lại để App.tsx hoặc code ngoài src/ còn import đường cũ không bị vỡ.
// Khi đã đổi hết import sang đường mới thì xóa cả thư mục src/lib/.
export * from '../api/supabase';
