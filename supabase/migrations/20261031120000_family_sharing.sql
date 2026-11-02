-- =====================================================================
-- AuraVital — Chia sẻ gia đình: lời mời có chấp nhận/từ chối,
-- biệt danh thành viên, cài đặt nội dung chia sẻ.
-- Chạy 1 lần trên project (local hoặc cloud) SAU migration gốc
-- 20261025171445_auravital.sql. Không chạy lại migration gốc.
-- Cách chạy local: dán vào Supabase Studio SQL Editor
-- (http://localhost:54323) rồi Run, hoặc:
--   supabase migration up
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Biệt danh: người XEM đặt tên gọi cho người CHIA SẺ.
--    Ví dụ: Hiền xem Bố thì đặt nickname 'Bố' cho hàng
--    (owner_id = Bố, viewer_id = Hiền).
-- ---------------------------------------------------------------------
alter table public.family_links
  add column if not exists nickname text
  check (nickname is null or char_length(btrim(nickname)) between 1 and 30);

-- Chỉ người xem được sửa biệt danh của hàng mình xem.
drop policy if exists links_update_nickname on public.family_links;
create policy links_update_nickname on public.family_links for update to authenticated
  using (viewer_id = (select auth.uid()))
  with check (viewer_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 2. Cài đặt nội dung chia sẻ: 1 hàng cho mỗi người dùng, áp dụng
--    CHUNG cho tất cả người thân đã kết nối (không phân quyền từng người).
-- ---------------------------------------------------------------------
create table if not exists public.sharing_settings (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  share_enabled    boolean not null default true,
  share_steps      boolean not null default true,
  share_sleep      boolean not null default true,
  share_heart_rate boolean not null default true,
  share_spo2       boolean not null default true,
  share_water      boolean not null default true,
  share_weight     boolean not null default true,
  updated_at       timestamptz not null default now()
);
drop trigger if exists trg_sharing_settings_updated on public.sharing_settings;
create trigger trg_sharing_settings_updated before update on public.sharing_settings
  for each row execute function public.set_updated_at();

alter table public.sharing_settings enable row level security;
drop policy if exists sharing_settings_own on public.sharing_settings;
create policy sharing_settings_own on public.sharing_settings for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
-- Người đã kết nối được ĐỌC cài đặt của chủ sở hữu để biết ẩn/hiện gì.
drop policy if exists sharing_settings_shared_read on public.sharing_settings;
create policy sharing_settings_shared_read on public.sharing_settings for select to authenticated
  using (exists (select 1 from public.family_links fl
                  where fl.owner_id = sharing_settings.user_id
                    and fl.viewer_id = (select auth.uid())));

-- Supabase không còn tự cấp quyền cho bảng public mới (từ 30/10/2026):
-- cấp tường minh, nếu không app sẽ gặp 42501 trước cả RLS.
grant select, insert, update, delete on public.sharing_settings to authenticated;

-- ---------------------------------------------------------------------
-- 3. Lời mời kết nối: người gửi nhập mã của người nhận -> người nhận
--    thấy lời mời trong tab Chia sẻ và bấm Đồng ý / Từ chối.
--    Mã mời KHÔNG bị tiêu hao khi gửi (dùng được nhiều lần trong 24h);
--    chỉ khi Đồng ý mới tạo family_links (2 chiều: xem được nhau).
--    from_name lưu sẵn tên người gửi vì trước khi kết nối, người nhận
--    không đọc được hàng profiles của người gửi (RLS owner-only).
-- ---------------------------------------------------------------------
create table if not exists public.family_requests (
  id           uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users (id) on delete cascade,
  to_user_id   uuid not null references auth.users (id) on delete cascade,
  code         text not null,
  from_name    text not null,
  to_name      text, -- tên người nhận, lưu sẵn lúc gửi (trước khi kết nối
                      -- phía gửi cũng không đọc được profile người nhận)
  status       text not null default 'pending'
               check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);
create index if not exists family_requests_to_idx
  on public.family_requests (to_user_id, status);
create index if not exists family_requests_from_idx
  on public.family_requests (from_user_id, status);

alter table public.family_requests enable row level security;
drop policy if exists family_requests_select on public.family_requests;
create policy family_requests_select on public.family_requests for select to authenticated
  using (from_user_id = (select auth.uid()) or to_user_id = (select auth.uid()));
-- Ghi (insert/update/delete) chỉ qua các hàm SECURITY DEFINER bên dưới,
-- nên không cấp policy ghi trực tiếp cho client.
grant select on public.family_requests to authenticated;

-- ---------------------------------------------------------------------
-- 4. Gửi lời mời: nhập mã 8 ký tự của người nhận.
--    Trả về jsonb: { ok, to_user_id, to_name } hoặc { ok:false, error }.
--    error: 'self' | 'invalid_code' | 'already_linked' | 'already_pending'
--           | 'too_many_attempts'
-- ---------------------------------------------------------------------
create or replace function public.send_family_request(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid      uuid := (select auth.uid());
  v_owner    uuid;
  v_owner_nm text;
  v_my_name  text;
  v_code     text := upper(btrim(p_code));
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  -- Chống dò mã: sai quá 5 lần trong 15 phút thì khóa tạm.
  -- Kiểm tra TRƯỚC khi tra mã, nếu không kẻ dò mã không bao giờ
  -- chạm tới giới hạn (vì mã sai đã return sớm ở dưới).
  if (select count(*) from public.invite_attempts
       where user_id = v_uid and attempted_at > now() - interval '15 minutes') >= 5 then
    return jsonb_build_object('ok', false, 'error', 'too_many_attempts');
  end if;

  -- Mã của chính mình thì không mời được.
  select owner_id into v_owner from public.family_invites
   where code = v_code and used_at is null and expires_at > now();
  if v_owner is null then
    insert into public.invite_attempts (user_id) values (v_uid);
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;
  if v_owner = v_uid then
    return jsonb_build_object('ok', false, 'error', 'self');
  end if;

  -- Đã kết nối rồi thì không gửi nữa.
  if exists (select 1 from public.family_links
              where (owner_id = v_owner and viewer_id = v_uid)
                 or (owner_id = v_uid and viewer_id = v_owner)) then
    return jsonb_build_object('ok', false, 'error', 'already_linked');
  end if;
  if exists (select 1 from public.family_requests
              where from_user_id = v_uid and to_user_id = v_owner
                and status = 'pending') then
    return jsonb_build_object('ok', false, 'error', 'already_pending');
  end if;

  select display_name into v_my_name from public.profiles where id = v_uid;
  select display_name into v_owner_nm from public.profiles where id = v_owner;
  insert into public.family_requests (from_user_id, to_user_id, code, from_name, to_name)
  values (v_uid, v_owner, v_code, coalesce(v_my_name, 'Người dùng'),
          coalesce(v_owner_nm, 'Người dùng'));
  return jsonb_build_object('ok', true, 'to_user_id', v_owner,
                            'to_name', coalesce(v_owner_nm, 'Người dùng'));
end $$;
revoke execute on function public.send_family_request(text) from public, anon;
grant execute on function public.send_family_request(text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Đồng ý: chỉ người nhận được bấm. Tạo 2 hàng family_links
--    (xem được nhau) rồi xóa lời mời — link chính là bằng chứng.
-- ---------------------------------------------------------------------
create or replace function public.accept_family_request(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := (select auth.uid());
  v_from uuid;
  v_to   uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select from_user_id, to_user_id into v_from, v_to
    from public.family_requests where id = p_request_id and status = 'pending';
  if v_from is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_to <> v_uid then
    return jsonb_build_object('ok', false, 'error', 'not_recipient');
  end if;
  insert into public.family_links (owner_id, viewer_id) values (v_from, v_to)
    on conflict (owner_id, viewer_id) do nothing;
  insert into public.family_links (owner_id, viewer_id) values (v_to, v_from)
    on conflict (owner_id, viewer_id) do nothing;
  delete from public.family_requests where id = p_request_id;
  return jsonb_build_object('ok', true, 'from_user_id', v_from);
end $$;
revoke execute on function public.accept_family_request(uuid) from public, anon;
grant execute on function public.accept_family_request(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Từ chối: chỉ người nhận được bấm. Giữ hàng ở trạng thái
--    'declined' để phía người gửi thấy và tự bấm Ẩn.
-- ---------------------------------------------------------------------
create or replace function public.decline_family_request(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := (select auth.uid());
  v_to   uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select to_user_id into v_to
    from public.family_requests where id = p_request_id and status = 'pending';
  if v_to is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_to <> v_uid then
    return jsonb_build_object('ok', false, 'error', 'not_recipient');
  end if;
  update public.family_requests set status = 'declined' where id = p_request_id;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.decline_family_request(uuid) from public, anon;
grant execute on function public.decline_family_request(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Ẩn lời mời đã bị từ chối: chỉ người gửi được bấm.
-- ---------------------------------------------------------------------
create or replace function public.dismiss_family_request(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := (select auth.uid());
  v_from uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select from_user_id into v_from
    from public.family_requests where id = p_request_id and status = 'declined';
  if v_from is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_from <> v_uid then
    return jsonb_build_object('ok', false, 'error', 'not_sender');
  end if;
  delete from public.family_requests where id = p_request_id;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.dismiss_family_request(uuid) from public, anon;
grant execute on function public.dismiss_family_request(uuid) to authenticated;
