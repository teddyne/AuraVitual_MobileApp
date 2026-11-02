-- Chạy trong Supabase Studio SQL Editor (local: http://localhost:54323)

-- 1. SỬA LỖI "Không lưu được biệt danh".
--    Nguyên nhân: bảng family_links chỉ được cấp quyền SELECT + DELETE
--    (từ file SQL tổng hợp ngày 30/10), migration gia đình thêm cột
--    nickname + policy UPDATE nhưng quên cấp quyền UPDATE. Thiếu quyền
--    thì PostgREST trả lỗi 42501, app báo "Không lưu được biệt danh"
--    dù policy đã đúng.
grant select, insert, update, delete on public.family_links to authenticated;

-- 2. HÀM TẠO LẠI MÃ MỜI 
create or replace function public.rotate_invite()
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  update public.family_invites
     set expires_at = now()
   where owner_id = v_uid and used_at is null and expires_at > now();
  return public.create_invite();
end $$;
revoke execute on function public.rotate_invite() from public, anon;
grant execute on function public.rotate_invite() to authenticated;
