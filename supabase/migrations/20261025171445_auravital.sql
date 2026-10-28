create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm  with schema extensions;

-- ---------------------------------------------------------------------
-- 1. ENUM
-- ---------------------------------------------------------------------
create type public.meal_type    as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type public.food_source  as enum ('seed', 'manual', 'ai', 'barcode');
create type public.steps_source as enum ('auto', 'manual');
create type public.post_kind    as enum ('article', 'workout');
create type public.post_level   as enum ('beginner', 'intermediate', 'advanced');

-- ---------------------------------------------------------------------
-- 2. HÀM DÙNG CHUNG
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 3. HỒ SƠ (User trong sơ đồ = auth.users; mật khẩu chỉ nằm ở Supabase Auth)
-- ---------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  display_name     text not null check (char_length(btrim(display_name)) between 1 and 50),
  height_cm        numeric(4,1) not null check (height_cm between 50 and 250),
  weight_kg        numeric(4,1) not null check (weight_kg between 20 and 300),   -- cân nặng ban đầu
  step_goal        integer      not null default 10000 check (step_goal between 1000 and 100000),
  water_goal_ml    integer      not null default 2200  check (water_goal_ml between 500 and 10000),
  sleep_goal_hours numeric(3,1) not null default 8     check (sleep_goal_hours between 4 and 12),
  calorie_goal     integer      not null default 2000  check (calorie_goal between 800 and 6000),
  emergency_phone  text check (emergency_phone ~ '^\+?[0-9]{8,15}$'),
  consented_at     timestamptz not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. CHỈ SỐ SỨC KHỎE (mỗi người một dòng mỗi ngày)
-- ---------------------------------------------------------------------
create table public.health_metrics (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  log_date        date not null,                       -- ngày địa phương của điện thoại
  steps           integer       check (steps between 0 and 100000),
  sleep_hours     numeric(4,2)  check (sleep_hours between 0 and 24),
  water_ml        integer       check (water_ml between 0 and 10000),
  weight_kg       numeric(4,1)  check (weight_kg between 20 and 300),
  heart_rate      smallint      check (heart_rate between 30 and 220),
  spo2            smallint      check (spo2 between 70 and 100),
  steps_source    public.steps_source,                 -- null khi chưa có số bước
  steps_synced_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, log_date),
  check (num_nonnulls(steps, sleep_hours, water_ml, weight_kg, heart_rate, spo2) >= 1)
);
create trigger trg_metrics_updated before update on public.health_metrics
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 5. DINH DƯỠNG: foods -> meals -> meal_items
-- ---------------------------------------------------------------------
-- owner_id null = món của hệ thống (seed); có giá trị = món người dùng tự lưu
create table public.foods (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid references auth.users (id) on delete cascade,
  name              text not null check (char_length(btrim(name)) between 1 and 120),
  serving_label     text not null default '1 phần',
  kcal_per_serving  numeric(7,1) not null check (kcal_per_serving >= 0),
  carb_g            numeric(6,1) not null default 0 check (carb_g    >= 0),
  protein_g         numeric(6,1) not null default 0 check (protein_g >= 0),
  fat_g             numeric(6,1) not null default 0 check (fat_g     >= 0),
  barcode           text check (barcode ~ '^[0-9]{8,14}$'),
  -- seed = món hệ thống (seed.sql phải ghi source = 'seed'); manual/ai/barcode = món của người dùng
  source            public.food_source not null default 'manual',
  created_at        timestamptz not null default now(),
  check ((owner_id is null) = (source = 'seed'))
);
create unique index foods_owner_barcode_uq
  on public.foods (coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), barcode)
  where barcode is not null;
create index foods_owner_idx on public.foods (owner_id);
create index foods_name_trgm on public.foods using gin (name extensions.gin_trgm_ops);

create table public.meals (
  id               uuid primary key default gen_random_uuid(),  -- app có thể tự sinh trước để đặt tên ảnh
  user_id          uuid not null references auth.users (id) on delete cascade,
  eaten_at         timestamptz not null,
  meal_type        public.meal_type not null,
  photo_path       text,                                   -- {user_id}/{meal_id}.jpg
  -- Tổng được trigger tự tính từ meal_items; client không ghi trực tiếp
  total_kcal       numeric(8,1) not null default 0,
  total_carb_g     numeric(7,1) not null default 0,
  total_protein_g  numeric(7,1) not null default 0,
  total_fat_g      numeric(7,1) not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (photo_path is null or photo_path = user_id::text || '/' || id::text || '.jpg')
);
create index meals_user_eaten_idx on public.meals (user_id, eaten_at);
create trigger trg_meals_updated before update on public.meals
  for each row execute function public.set_updated_at();

-- Ảnh chụp nhanh (snapshot) tên, kcal, chất tại thời điểm ăn:
-- sửa/xóa món trong thư viện không làm đổi lịch sử; món AI/mã vạch không cần tạo Food.
create table public.meal_items (
  id         uuid primary key default gen_random_uuid(),
  meal_id    uuid not null references public.meals (id) on delete cascade,
  food_id    uuid references public.foods (id) on delete set null,
  name       text not null check (char_length(btrim(name)) between 1 and 120),
  servings   numeric(6,2) not null check (servings > 0),
  kcal       numeric(7,1) not null check (kcal >= 0),      -- tổng của dòng này (đã nhân servings)
  carb_g     numeric(6,1) not null default 0 check (carb_g    >= 0),
  protein_g  numeric(6,1) not null default 0 check (protein_g >= 0),
  fat_g      numeric(6,1) not null default 0 check (fat_g     >= 0),
  created_at timestamptz not null default now()
);
create index meal_items_meal_idx on public.meal_items (meal_id);

create or replace function public.recalc_meal_totals()
returns trigger language plpgsql set search_path = '' as $$
declare v_meal uuid := coalesce(new.meal_id, old.meal_id);
begin
  update public.meals m
     set total_kcal      = coalesce(s.k, 0),
         total_carb_g    = coalesce(s.c, 0),
         total_protein_g = coalesce(s.p, 0),
         total_fat_g     = coalesce(s.f, 0)
    from (select sum(kcal) k, sum(carb_g) c, sum(protein_g) p, sum(fat_g) f
            from public.meal_items where meal_id = v_meal) s
   where m.id = v_meal;
  return null;
end $$;
create trigger trg_meal_items_totals
  after insert or update or delete on public.meal_items
  for each row execute function public.recalc_meal_totals();

-- Lưu bữa ăn + các dòng món trong MỘT giao dịch (client không tự làm được).
-- p_items: [{food_id,name,servings,kcal,carb_g,protein_g,fat_g}, ...]
-- Món mã vạch/AI: app tạo Food trước (source = 'barcode'/'ai'), rồi truyền food_id vào đây.
create or replace function public.save_meal(
  p_meal_id uuid, p_eaten_at timestamptz, p_meal_type public.meal_type,
  p_photo_path text, p_items jsonb)
returns uuid language plpgsql set search_path = '' as $$   -- SECURITY INVOKER: RLS vẫn áp dụng
declare v_uid uuid := (select auth.uid()); v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'meal_needs_items';                    -- Meal 1..* MealItem
  end if;

  insert into public.meals as m (id, user_id, eaten_at, meal_type, photo_path)
  values (coalesce(p_meal_id, gen_random_uuid()), v_uid, p_eaten_at, p_meal_type, p_photo_path)
  on conflict (id) do update
     set eaten_at = excluded.eaten_at, meal_type = excluded.meal_type, photo_path = excluded.photo_path
   where m.user_id = v_uid
  returning id into v_id;
  if v_id is null then raise exception 'meal_not_found'; end if;

  delete from public.meal_items where meal_id = v_id;
  insert into public.meal_items (meal_id, food_id, name, servings, kcal, carb_g, protein_g, fat_g)
  select v_id, x.food_id, x.name, x.servings, x.kcal,
         coalesce(x.carb_g, 0), coalesce(x.protein_g, 0), coalesce(x.fat_g, 0)
    from jsonb_to_recordset(p_items) as x(
         food_id uuid, name text, servings numeric, kcal numeric,
         carb_g numeric, protein_g numeric, fat_g numeric);
  return v_id;
end $$;
revoke execute on function public.save_meal(uuid, timestamptz, public.meal_type, text, jsonb) from public, anon;
grant  execute on function public.save_meal(uuid, timestamptz, public.meal_type, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 6. CHU KỲ
-- ---------------------------------------------------------------------
create table public.cycles (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  start_date         date not null,
  cycle_length_days  smallint not null check (cycle_length_days between 20 and 45),
  period_length_days smallint not null default 5 check (period_length_days between 1 and 15),
  created_at         timestamptz not null default now(),
  unique (user_id, start_date)
);
create index cycles_user_start_idx on public.cycles (user_id, start_date);

-- ---------------------------------------------------------------------
-- 7. CHIA SẺ GIA ĐÌNH
-- ---------------------------------------------------------------------
create table public.family_invites (
  code       text primary key check (code ~ '^[A-HJKMNP-Z2-9]{8}$'),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  used_at    timestamptz,
  used_by    uuid references auth.users (id) on delete set null
);
create index family_invites_owner_idx on public.family_invites (owner_id);

create table public.family_links (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  viewer_id  uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (owner_id, viewer_id),
  check (owner_id <> viewer_id)
);
create index family_links_owner_idx  on public.family_links (owner_id);
create index family_links_viewer_idx on public.family_links (viewer_id);

create table public.invite_attempts (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index invite_attempts_user_idx on public.invite_attempts (user_id, attempted_at);

-- ---------------------------------------------------------------------
-- 8. KHÁM PHÁ
-- ---------------------------------------------------------------------
create table public.posts (
  id           uuid primary key default gen_random_uuid(),
  kind         public.post_kind not null,
  title        text not null,
  summary      text,
  body         text,
  cover_url    text,
  video_url    text,
  duration_min smallint check (duration_min > 0),
  level        public.post_level,
  published_at timestamptz not null default now(),
  check (kind <> 'article' or body is not null)
);
create index posts_kind_published_idx on public.posts (kind, published_at desc);

create table public.workout_steps (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts (id) on delete cascade,
  step_order   smallint not null check (step_order >= 1),
  title        text not null,
  instruction  text,
  duration_sec integer check (duration_sec > 0),
  start_at_sec integer check (start_at_sec >= 0),         -- mốc trong video
  unique (post_id, step_order)
);

-- ---------------------------------------------------------------------
-- 9. NHẮC NHỞ
-- ---------------------------------------------------------------------
create table public.reminder_settings (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  water_enabled boolean not null default false,
  water_times   time[]  not null default '{}' check (cardinality(water_times) <= 12),
  sleep_enabled boolean not null default false,
  sleep_time    time,
  updated_at    timestamptz not null default now(),
  check (not sleep_enabled or sleep_time is not null)
);
create trigger trg_reminders_updated before update on public.reminder_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 10. QUOTA QUÉT AI PHÍA SERVER (đề xuất, chỉ Edge Function dùng service_role)
-- ---------------------------------------------------------------------
create table public.ai_scan_usage (
  user_id    uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,                               -- ngày giờ Việt Nam do Edge Function tính
  scan_count integer not null default 0 check (scan_count >= 0),
  primary key (user_id, usage_date)
);

-- ---------------------------------------------------------------------
-- 11. VIEW CHIA SẺ (chỉ lộ các cột cần cho người xem)
-- ---------------------------------------------------------------------
create view public.shared_profiles as
select p.id, p.display_name, p.step_goal, p.water_goal_ml, p.sleep_goal_hours
  from public.profiles p
 where p.id = (select auth.uid())
    or exists (select 1 from public.family_links fl
                where fl.owner_id = p.id and fl.viewer_id = (select auth.uid()));
revoke all on public.shared_profiles from anon;
grant select on public.shared_profiles to authenticated;

-- ---------------------------------------------------------------------
-- 12. HÀM MÃ MỜI
-- ---------------------------------------------------------------------
create or replace function public.create_invite()
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_uid      uuid := (select auth.uid());
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   -- 31 ký tự, bỏ 0/O/1/I/L
  v_code text; v_b int; v_try int := 0;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  delete from public.family_invites
   where owner_id = v_uid and used_at is null and expires_at <= now();
  if (select count(*) from public.family_invites
       where owner_id = v_uid and used_at is null and expires_at > now()) >= 5 then
    raise exception 'too_many_active_invites';
  end if;

  loop
    v_code := '';
    for i in 1..8 loop
      loop                                                  -- loại bỏ lệch phân phối (31*8 = 248)
        v_b := get_byte(extensions.gen_random_bytes(1), 0);
        exit when v_b < 248;
      end loop;
      v_code := v_code || substr(v_alphabet, 1 + (v_b % 31), 1);
    end loop;
    begin
      insert into public.family_invites (code, owner_id) values (v_code, v_uid);
      return v_code;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 5 then raise; end if;
    end;
  end loop;
end $$;
revoke execute on function public.create_invite() from public, anon;
grant  execute on function public.create_invite() to authenticated;

create or replace function public.redeem_invite(p_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := (select auth.uid());
  v_owner uuid;
begin
  if v_uid is null then return false; end if;

  if (select count(*) from public.invite_attempts
       where user_id = v_uid and attempted_at > now() - interval '15 minutes') >= 5 then
    return false;
  end if;

  update public.family_invites
     set used_at = now(), used_by = v_uid
   where code = upper(btrim(p_code))
     and used_at is null and expires_at > now() and owner_id <> v_uid
  returning owner_id into v_owner;

  if v_owner is null then
    insert into public.invite_attempts (user_id) values (v_uid);   -- trả về, không ném lỗi
    return false;
  end if;

  insert into public.family_links (owner_id, viewer_id) values (v_owner, v_uid)
  on conflict (owner_id, viewer_id) do nothing;
  return true;
end $$;
revoke execute on function public.redeem_invite(text) from public, anon;
grant  execute on function public.redeem_invite(text) to authenticated;

-- ---------------------------------------------------------------------
-- 13. RLS
-- ---------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.health_metrics    enable row level security;
alter table public.foods             enable row level security;
alter table public.meals             enable row level security;
alter table public.meal_items        enable row level security;
alter table public.cycles            enable row level security;
alter table public.family_invites    enable row level security;
alter table public.family_links      enable row level security;
alter table public.invite_attempts   enable row level security;
alter table public.posts             enable row level security;
alter table public.workout_steps     enable row level security;
alter table public.reminder_settings enable row level security;
alter table public.ai_scan_usage     enable row level security;

-- Chỉ chủ sở hữu
create policy profiles_own on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy meals_own on public.meals for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cycles_own on public.cycles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy reminders_own on public.reminder_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy meal_items_own on public.meal_items for all to authenticated
  using (exists (select 1 from public.meals m
                  where m.id = meal_items.meal_id and m.user_id = (select auth.uid())))
  with check (exists (select 1 from public.meals m
                  where m.id = meal_items.meal_id and m.user_id = (select auth.uid())));

-- Chỉ số: chủ ghi; người được chia sẻ chỉ đọc
create policy metrics_write_own on public.health_metrics for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy metrics_read_shared on public.health_metrics for select to authenticated
  using (exists (select 1 from public.family_links fl
                  where fl.owner_id = health_metrics.user_id
                    and fl.viewer_id = (select auth.uid())));

-- Món ăn: đọc món hệ thống + món của mình; chỉ ghi món của mình
create policy foods_read on public.foods for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy foods_write_own on public.foods for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Nội dung công khai cho người đã đăng nhập
create policy posts_read on public.posts for select to authenticated using (true);
create policy workout_steps_read on public.workout_steps for select to authenticated using (true);

-- Gia đình: không có policy insert (chỉ qua create_invite / redeem_invite)
create policy invites_select_own on public.family_invites for select to authenticated
  using (owner_id = (select auth.uid()));
create policy invites_delete_own on public.family_invites for delete to authenticated
  using (owner_id = (select auth.uid()));
create policy links_select on public.family_links for select to authenticated
  using (owner_id = (select auth.uid()) or viewer_id = (select auth.uid()));
create policy links_delete on public.family_links for delete to authenticated
  using (owner_id = (select auth.uid()) or viewer_id = (select auth.uid()));

-- invite_attempts, ai_scan_usage: không policy, không quyền cho client
revoke all on public.invite_attempts from anon, authenticated;
revoke all on public.ai_scan_usage   from anon, authenticated;
revoke insert, update on public.family_links   from authenticated;
revoke insert, update on public.family_invites from authenticated;
-- Tổng kcal/chất của bữa ăn do trigger tính, client không được tự ghi
revoke update (total_kcal, total_carb_g, total_protein_g, total_fat_g) on public.meals from authenticated;

-- ---------------------------------------------------------------------
-- 14. STORAGE: bucket riêng tư cho ảnh bữa ăn
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

create policy meal_photos_own on storage.objects for all to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------
-- PHẦN 2: Bổ sung cột cho profiles
-- (update_profile.sql + gender.sql + sleep.sql, phần profiles)
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS date_of_birth DATE;

alter table public.profiles
add column if not exists gender text
check (gender in ('Nam', 'Nữ', 'Khác'));

alter table public.profiles
  add column if not exists bedtime_time time,
  add column if not exists wake_time time,
  add column if not exists sleep_reminder_enabled boolean not null default true,
  add column if not exists alarm_enabled boolean not null default true;

-- ---------------------------------------------------------------------
-- PHẦN 3: Bữa ăn — meal_source, cột mới, save_meal 7 tham số
-- (update_meal.sql)
-- ---------------------------------------------------------------------
-- 1. Enum nguồn gốc bữa ăn (sơ đồ gọi là MealSource, nhưng không vẽ thành hộp enum)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meal_source') THEN
    CREATE TYPE public.meal_source AS ENUM ('manual', 'library', 'ai', 'barcode');
  END IF;
END $$;

-- 2. Thêm cột còn thiếu vào meals và meal_items
-- meals hiện có 11 cột, thêm 2 cột này thành 13, dữ liệu cũ không mất
ALTER TABLE public.meals
  ADD COLUMN IF NOT EXISTS source public.meal_source NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS barcode text
    CHECK (barcode IS NULL OR barcode ~ '^[0-9]{8,14}$');

-- meal_items hiện có 10 cột, thêm 2 cột này thành 12
-- grams giữ số gam gốc từ mã vạch/AI, vì servings đã đổi gam ra suất thì không khôi phục lại được gam gốc
ALTER TABLE public.meal_items
  ADD COLUMN IF NOT EXISTS grams numeric(7,1) CHECK (grams IS NULL OR grams >= 0),
  ADD COLUMN IF NOT EXISTS barcode text
    CHECK (barcode IS NULL OR barcode ~ '^[0-9]{8,14}$');

-- 3. Cập nhật save_meal để nhận thêm nguồn gốc và gam/mã vạch
-- Bỏ bản cũ 5 tham số, tạo lại bản 7 tham số, 2 tham số mới có default
-- nên lệnh gọi cũ vẫn chạy được, lệnh gọi mới truyền đủ 7 tham số thì lưu đủ thông tin
DROP FUNCTION IF EXISTS public.save_meal(uuid, timestamptz, public.meal_type, text, jsonb);

CREATE OR REPLACE FUNCTION public.save_meal(
  p_meal_id uuid, p_eaten_at timestamptz, p_meal_type public.meal_type,
  p_photo_path text, p_items jsonb,
  p_source public.meal_source DEFAULT 'manual'::public.meal_source,
  p_barcode text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_uid uuid := (SELECT auth.uid()); v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'meal_needs_items';
  END IF;
  IF p_barcode IS NOT NULL AND p_barcode !~ '^[0-9]{8,14}$' THEN
    RAISE EXCEPTION 'invalid_barcode';
  END IF;

  INSERT INTO public.meals AS m
    (id, user_id, eaten_at, meal_type, photo_path, source, barcode)
  VALUES
    (COALESCE(p_meal_id, gen_random_uuid()), v_uid, p_eaten_at, p_meal_type, p_photo_path, p_source, p_barcode)
  ON CONFLICT (id) DO UPDATE SET
    eaten_at = EXCLUDED.eaten_at, meal_type = EXCLUDED.meal_type,
    photo_path = EXCLUDED.photo_path, source = EXCLUDED.source, barcode = EXCLUDED.barcode
  WHERE m.user_id = v_uid
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'meal_not_found'; END IF;

  DELETE FROM public.meal_items WHERE meal_id = v_id;
  INSERT INTO public.meal_items
    (meal_id, food_id, name, servings, kcal, carb_g, protein_g, fat_g, grams, barcode)
  SELECT v_id, x.food_id, x.name, x.servings, x.kcal,
         COALESCE(x.carb_g, 0), COALESCE(x.protein_g, 0), COALESCE(x.fat_g, 0),
         x.grams, x.barcode
    FROM jsonb_to_recordset(p_items) AS x(
         food_id uuid, name text, servings numeric, kcal numeric,
         carb_g numeric, protein_g numeric, fat_g numeric,
         grams numeric, barcode text);
  RETURN v_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.save_meal(uuid, timestamptz, public.meal_type, text, jsonb, public.meal_source, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_meal(uuid, timestamptz, public.meal_type, text, jsonb, public.meal_source, text) TO authenticated;

-- ---------------------------------------------------------------------
-- PHẦN 4: Ghi nhận chu kỳ theo ngày (cycle_logs.sql)
-- ---------------------------------------------------------------------
-- Migration mới: ghi nhận kinh nguyệt + triệu chứng theo từng ngày
-- Áp sau migration v5 (hàm public.set_updated_at() đã có sẵn từ v5).

create type public.period_flow as enum ('light', 'medium', 'heavy');
-- light = Ít, medium = Trung bình, heavy = Nhiều

create table public.cycle_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  log_date   date not null,
  has_period boolean not null default false,
  flow       public.period_flow,
  symptoms   text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date),
  -- Lượng kinh chỉ có nghĩa khi ngày đó có kinh.
  check (flow is null or has_period)
);

create trigger trg_cycle_logs_updated before update on public.cycle_logs
  for each row execute function public.set_updated_at();

create index cycle_logs_user_date_idx on public.cycle_logs (user_id, log_date);

alter table public.cycle_logs enable row level security;

-- Chỉ chủ sở hữu được đọc/ghi ngày của mình.
create policy cycle_logs_own on public.cycle_logs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.cycle_logs
  add column if not exists spotting boolean not null default false;

-- ---------------------------------------------------------------------
-- PHẦN 5: Bảng đề xuất (recomment.sql)
-- ---------------------------------------------------------------------
create table if not exists public.recommendations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal text not null check (goal in ('maintain', 'lose', 'gain', 'sleep', 'cycle')),
  calorie_target integer,
  water_ml integer,
  sleep_hours numeric,
  target_weight_kg numeric,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recommendations enable row level security;

drop policy if exists "recommendations_owner" on public.recommendations;
create policy "recommendations_owner"
  on public.recommendations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- PHẦN 6: Phiên ngủ (sleep.sql, phần sleep_sessions)
-- ---------------------------------------------------------------------
create table if not exists public.sleep_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_minutes int not null check (duration_minutes > 0 and duration_minutes <= 1440),
  snooze_count int not null default 0,
  source text not null check (source in ('alarm', 'next_day', 'manual')),
  created_at timestamptz not null default now()
);

create index if not exists sleep_sessions_user_started_idx
  on public.sleep_sessions (user_id, started_at desc);

alter table public.sleep_sessions enable row level security;
drop policy if exists sleep_sessions_owner on public.sleep_sessions;
create policy sleep_sessions_owner on public.sleep_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- PHẦN 7: kcal bài tập + nhật ký tập (workout_logs.sql)
-- PHẦN này phải đứng TRƯỚC PHẦN 9 vì update_post.sql dùng
-- cột posts.kcal_estimate.
-- ---------------------------------------------------------------------
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS kcal_estimate integer
  CHECK (kcal_estimate IS NULL OR kcal_estimate >= 0);

CREATE TABLE IF NOT EXISTS public.workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
  log_date date NOT NULL,
  minutes integer NOT NULL CHECK (minutes >= 1 AND minutes <= 480),
  kcal integer NOT NULL DEFAULT 0 CHECK (kcal >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id, log_date)
);

-- RLS theo đúng mẫu owner-only của v5 (profiles/meals/cycles/...):
-- mỗi người chỉ thấy / sửa được dòng của chính mình.
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workout_logs_select_own" ON public.workout_logs;
CREATE POLICY "workout_logs_select_own" ON public.workout_logs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "workout_logs_insert_own" ON public.workout_logs;
CREATE POLICY "workout_logs_insert_own" ON public.workout_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "workout_logs_update_own" ON public.workout_logs;
CREATE POLICY "workout_logs_update_own" ON public.workout_logs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "workout_logs_delete_own" ON public.workout_logs;
CREATE POLICY "workout_logs_delete_own" ON public.workout_logs
  FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- PHẦN 8: Seed — món ăn, bài viết/bài tập, bước tập (v5)
-- (food.sql + post.sql + workout.sql)
-- ---------------------------------------------------------------------
INSERT INTO public.foods
  (owner_id, name, serving_label, kcal_per_serving, carb_g, protein_g, fat_g, source)
SELECT NULL, v.name, v.serving, v.kcal, v.carb, v.protein, v.fat, 'seed'::public.food_source
FROM (VALUES
  ('Cơm trắng',            '1 chén', 200, 44.0,  4.0,  0.5),
  ('Cơm gạo lứt',          '1 chén', 180, 38.0,  4.0,  1.5),
  ('Phở bò',               '1 tô',   430, 55.0, 25.0, 12.0),
  ('Bún chả',              '1 suất', 550, 60.0, 25.0, 23.0),
  ('Bánh mì thịt',         '1 ổ',    350, 45.0, 15.0, 11.0),
  ('Trứng luộc',           '1 quả',   78,  0.6,  6.0,  5.5),
  ('Ức gà luộc',           '100 g',  165,  0.0, 31.0,  4.5),
  ('Thịt heo luộc',        '100 g',  220,  0.0, 26.0, 13.0),
  ('Tôm hấp',              '100 g',   99,  0.2, 24.0,  0.3),
  ('Cá hồi áp chảo',       '100 g',  280,  0.0, 25.0, 20.0),
  ('Canh chua cá',         '1 tô',   150,  8.0, 15.0,  6.0),
  ('Đậu hũ sốt cà',        '1 đĩa',  180, 10.0, 12.0, 10.0),
  ('Salad rau trộn',       '1 đĩa',  120, 10.0,  3.0,  7.0),
  ('Rau luộc thập cẩm',    '1 đĩa',   80, 15.0,  3.0,  1.0),
  ('Sữa chua không đường', '1 hộp',   59,  4.0,  5.0,  2.5),
  ('Sữa tươi không đường', '1 hộp',  110, 12.0,  6.0,  4.0),
  ('Yến mạch',             '1 chén', 150, 27.0,  5.0,  2.5),
  ('Chuối',                '1 quả',   89, 22.0,  1.0,  0.3),
  ('Táo',                  '1 quả',   52, 13.0,  0.3,  0.2),
  ('Bánh mì trứng ốp la',  '1 ổ',    300, 38.0, 12.0, 10.0)
) AS v(name, serving, kcal, carb, protein, fat)
WHERE NOT EXISTS (
  SELECT 1 FROM public.foods f
  WHERE f.name = v.name AND f.owner_id IS NULL
);

INSERT INTO public.posts
  (kind, title, summary, body, cover_url, video_url, duration_min, level)
SELECT v.kind, v.title, v.summary, v.body, NULL, NULL, v.duration_min, v.level
FROM (VALUES
  ('article'::public.post_kind, 'Đi bộ 30 phút mỗi ngày có đủ không?',
   'Đi bộ đều đặn và cách tăng dần thời lượng.',
   'Bài viết mẫu: đi bộ đều đặn giúp tim mạch và giấc ngủ tốt hơn. Hãy bắt đầu từ mức vừa sức rồi tăng dần thời lượng theo tuần.',
   NULL, NULL),
  ('article'::public.post_kind, 'Uống nước đúng cách trong ngày',
   'Chia đều lượng nước theo các khung giờ.',
   'Bài viết mẫu: chia đều lượng nước theo các khung giờ, không dồn một lúc. Đặt nhắc uống nước vào các mốc cố định sẽ dễ duy trì hơn.',
   NULL, NULL),
  ('article'::public.post_kind, 'Ngủ đủ giấc giúp phục hồi như thế nào?',
   'Giấc ngủ sâu và giờ ngủ cố định.',
   'Bài viết mẫu: giấc ngủ sâu giúp cơ thể phục hồi sau vận động. Duy trì giờ ngủ cố định và hạn chế màn hình trước khi ngủ.',
   NULL, NULL),
  ('article'::public.post_kind, 'Ăn sáng đủ chất mà không quá nhiều calo',
   'Bữa sáng có đạm và rau, hạn chế đồ chiên.',
   'Bài viết mẫu: bữa sáng nên có đạm và rau, hạn chế đồ chiên nhiều dầu. Ghi lại bữa ăn trong app để theo dõi tổng calo trong ngày.',
   NULL, NULL),
  ('article'::public.post_kind, 'Ngồi lâu: đứng dậy vận động mỗi giờ',
   'Nhắc mỗi giờ để đứng dậy, đi lại vài phút.',
   'Bài viết mẫu: ngồi liên tục nhiều giờ khiến cơ thể mỏi và uể oải. Đặt nhắc mỗi giờ để đứng dậy, đi lại vài phút.',
   NULL, NULL),
  ('workout'::public.post_kind, 'Bài tập giãn cơ 10 phút buổi sáng',
   'Giãn cơ nhẹ nhàng trước khi bắt đầu ngày mới.',
   'Video mẫu: các động tác giãn cơ nhẹ nhàng trước khi bắt đầu ngày mới.',
   10, 'beginner'::public.post_level),
  ('workout'::public.post_kind, 'Đi bộ nhanh 20 phút cho người mới bắt đầu',
   'Khởi động, đi bộ nhanh, thả lỏng.',
   'Video mẫu: khởi động nhẹ 5 phút, đi bộ nhanh 20 phút, thả lỏng 5 phút. Dừng lại nếu thấy chóng mặt hoặc khó thở.',
   20, 'beginner'::public.post_level),
  ('workout'::public.post_kind, 'Yoga nhẹ nhàng trước khi ngủ',
   'Thư giãn nhẹ, thở chậm trước giờ ngủ.',
   'Video mẫu: các tư thế thư giãn nhẹ, thở chậm, giúp cơ thể thả lỏng trước giờ ngủ.',
   15, 'beginner'::public.post_level)
) AS v(kind, title, summary, body, duration_min, level)
WHERE NOT EXISTS (
  SELECT 1 FROM public.posts p WHERE p.title = v.title
);

INSERT INTO public.workout_steps (post_id, step_order, title, instruction, duration_sec, start_at_sec)
SELECT p.id, v.step_order, v.title, v.instruction, v.duration_sec, v.start_at_sec
FROM public.posts p
JOIN (VALUES
  ('Bài tập giãn cơ 10 phút buổi sáng', 1, 'Khởi động cổ và vai', 'Xoay cổ, nhún vai nhẹ nhàng.', 120, 0),
  ('Bài tập giãn cơ 10 phút buổi sáng', 2, 'Giãn cơ tay và lưng', 'Vươn tay lên cao, nghiêng người hai bên.', 240, 120),
  ('Bài tập giãn cơ 10 phút buổi sáng', 3, 'Giãn cơ chân', 'Gập người chạm mũi chân, giữ lưng thẳng.', 240, 360),
  ('Đi bộ nhanh 20 phút cho người mới bắt đầu', 1, 'Khởi động', 'Đi bộ chậm, xoay khớp cổ chân, gối.', 300, 0),
  ('Đi bộ nhanh 20 phút cho người mới bắt đầu', 2, 'Đi bộ nhanh', 'Giữ nhịp thở đều, vung tay tự nhiên.', 1200, 300),
  ('Đi bộ nhanh 20 phút cho người mới bắt đầu', 3, 'Thả lỏng', 'Đi chậm dần, thở sâu.', 300, 1500),
  ('Yoga nhẹ nhàng trước khi ngủ', 1, 'Thở chậm', 'Ngồi thoải mái, hít sâu thở chậm.', 180, 0),
  ('Yoga nhẹ nhàng trước khi ngủ', 2, 'Tư thế em bé', 'Gập người về phía trước, thả lỏng vai.', 300, 180),
  ('Yoga nhẹ nhàng trước khi ngủ', 3, 'Nằm thư giãn', 'Nằm ngửa, thả lỏng toàn thân.', 420, 480)
) AS v(post_title, step_order, title, instruction, duration_sec, start_at_sec)
  ON p.title = v.post_title
WHERE p.kind = 'workout'
ON CONFLICT (post_id, step_order) DO UPDATE SET
  title = EXCLUDED.title,
  instruction = EXCLUDED.instruction,
  duration_sec = EXCLUDED.duration_sec,
  start_at_sec = EXCLUDED.start_at_sec;

-- ---------------------------------------------------------------------
-- PHẦN 9: Cập nhật posts — kcal, bài mới, bước tập mới
-- (update_post.sql, phần 1)
-- ---------------------------------------------------------------------
UPDATE public.posts SET kcal_estimate = 40
  WHERE kind = 'workout' AND title = 'Bài tập giãn cơ 10 phút buổi sáng';
UPDATE public.posts SET kcal_estimate = 110
  WHERE kind = 'workout' AND title = 'Đi bộ nhanh 20 phút cho người mới bắt đầu';
UPDATE public.posts SET kcal_estimate = 60
  WHERE kind = 'workout' AND title = 'Yoga nhẹ nhàng trước khi ngủ';

INSERT INTO public.posts
  (kind, title, summary, body, cover_url, video_url, duration_min, level, kcal_estimate)
SELECT v.kind, v.title, v.summary, v.body, v.cover_url, v.video_url,
       v.duration_min, v.level, v.kcal_estimate
FROM (VALUES
  ('workout'::public.post_kind,
   '15 phút Yoga & Giãn cơ cột sống buổi sáng',
   'Giải tỏa căng cứng vùng thắt lưng, mở rộng khớp hông và kích hoạt năng lượng tích cực cho ngày mới.',
   'Chuỗi bài tập giúp thư giãn cột sống, giải phóng căng thẳng vùng cơ thắt lưng và kích hoạt quá trình trao đổi chất tự nhiên. Tập chậm, thở đều, dừng lại nếu thấy đau.',
   'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1200&q=80',
   'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
   15, 'beginner'::public.post_level, 120),
  ('workout'::public.post_kind,
   'HIIT Đốt mỡ toàn thân',
   'Đốt mỡ tối đa với chuỗi bài tập ngắt quãng cường độ cao không cần dụng cụ, cải thiện hệ tim mạch.',
   'Chuỗi HIIT ngắt quãng cường độ cao, xen kẽ vận động mạnh và nghỉ ngắn. Người mới bắt đầu nên giảm nhịp và dừng lại nếu thấy chóng mặt hoặc khó thở.',
   'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&q=80',
   'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
   25, 'intermediate'::public.post_level, 280),
  ('article'::public.post_kind,
   'Siêu thực phẩm giúp tăng cường hệ miễn dịch',
   'Những thực phẩm giàu vitamin và chất chống oxy hoá nên có trong bữa ăn hằng ngày.',
   'Bài viết mẫu: rau xanh đậm, trái cây giàu vitamin C và các loại hạt cung cấp nhiều vi chất cho cơ thể. Ăn đa dạng vẫn quan trọng hơn chỉ ăn một loại siêu thực phẩm duy nhất.',
   'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200&q=80',
   NULL,
   5, 'beginner'::public.post_level, NULL),
  ('article'::public.post_kind,
   'Kỹ thuật điều hòa nhịp thở tối ưu sau khi chạy',
   'Thở chậm và đều sau khi chạy giúp nhịp tim hạ dần một cách nhẹ nhàng.',
   'Bài viết mẫu: sau khi chạy, đi bộ chậm vài phút rồi thở sâu theo nhịp đều, hít vào bằng mũi và thở ra chậm. Nếu còn khó thở kéo dài thì nên nghỉ và theo dõi thêm.',
   'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=1200&q=80',
   NULL,
   4, 'beginner'::public.post_level, NULL)
) AS v(kind, title, summary, body, cover_url, video_url, duration_min, level, kcal_estimate)
WHERE NOT EXISTS (
  SELECT 1 FROM public.posts p WHERE p.title = v.title
);

-- 3) Bước tập cho 2 bài mới.
--    LƯU Ý VỀ YOGA BUỔI SÁNG: Figma ghi 5 động tác 60/45/60/45/90 giây
--    thì tổng chỉ 5 phút, không khớp tiêu đề 15 phút trên cùng thẻ đó.
--    Seed này giữ đúng tên + thứ tự 5 động tác của Figma, nhưng nhân
--    thời lượng mỗi động tác để tổng = 900 giây = 15 phút, cho khớp
--    thanh tiến trình của trình phát. Nếu nhóm muốn giữ đúng giây
--    gốc của Figma thì sửa duration_sec về 60/45/60/45/90 và chấp nhận
--    trình phát chỉ chạy 5 phút.
INSERT INTO public.workout_steps (post_id, step_order, title, instruction, duration_sec, start_at_sec)
SELECT p.id, v.step_order, v.title, v.instruction, v.duration_sec, v.start_at_sec
FROM public.posts p
JOIN (VALUES
  ('15 phút Yoga & Giãn cơ cột sống buổi sáng', 1, 'Tư thế đứa trẻ', 'Child''s Pose: gập người, tay vươn dài, thở chậm.', 180, 0),
  ('15 phút Yoga & Giãn cơ cột sống buổi sáng', 2, 'Giãn cơ mèo - bò', 'Cat-Cow Stretch: lưng cong - võng theo nhịp thở.', 135, 180),
  ('15 phút Yoga & Giãn cơ cột sống buổi sáng', 3, 'Tư thế chó úp mặt', 'Downward Dog: nâng hông, giữ lưng thẳng.', 180, 315),
  ('15 phút Yoga & Giãn cơ cột sống buổi sáng', 4, 'Rắn hổ mang mở ngực', 'Cobra Pose: mở ngực, vai thả lỏng.', 135, 495),
  ('15 phút Yoga & Giãn cơ cột sống buổi sáng', 5, 'Căng giãn cánh bướm phục hồi', 'Butterfly Pose: hai bàn chân áp vào nhau, thả lỏng.', 270, 630),
  ('HIIT Đốt mỡ toàn thân', 1, 'Khởi động', 'Chạy tại chỗ nhẹ, xoay khớp.', 300, 0),
  ('HIIT Đốt mỡ toàn thân', 2, 'Vòng HIIT 1', 'Vận động mạnh xen kẽ nghỉ ngắn.', 600, 300),
  ('HIIT Đốt mỡ toàn thân', 3, 'Nghỉ giữa vòng', 'Đi lại chậm, thở đều.', 120, 900),
  ('HIIT Đốt mỡ toàn thân', 4, 'Vòng HIIT 2', 'Vận động mạnh xen kẽ nghỉ ngắn, giữ đúng tư thế.', 480, 1020)
) AS v(post_title, step_order, title, instruction, duration_sec, start_at_sec)
  ON p.title = v.post_title
WHERE p.kind = 'workout'
ON CONFLICT (post_id, step_order) DO UPDATE SET
  title = EXCLUDED.title,
  instruction = EXCLUDED.instruction,
  duration_sec = EXCLUDED.duration_sec,
  start_at_sec = EXCLUDED.start_at_sec;

-- (đã bỏ COMMIT lẻ ở đây, xem ghi chú đầu file)
-- Kiểm tra nhanh (chạy riêng, sau COMMIT):
-- SELECT title, duration_min, level, kcal_estimate FROM public.posts
--   WHERE kind = 'workout' ORDER BY duration_min;
-- SELECT p.title, count(*) FROM public.workout_steps s
--   JOIN public.posts p ON p.id = s.post_id
--   WHERE p.title IN ('15 phút Yoga & Giãn cơ cột sống buổi sáng', 'HIIT Đốt mỡ toàn thân')
--   GROUP BY p.title;

-- ---------------------------------------------------------------------
-- PHẦN 9b: 2 bài viết chu kỳ (update_post.sql, phần 2)
-- ---------------------------------------------------------------------
BEGIN;
INSERT INTO public.posts
  (kind, title, summary, body, cover_url, video_url, duration_min, level, published_at)
SELECT v.kind, v.title, v.summary, v.body, v.cover_url, v.video_url,
       v.duration_min, v.level, v.published_at
FROM (VALUES
  ('article'::public.post_kind,
   'Hiểu chu kỳ kinh nguyệt: 4 pha và cách cơ thể thay đổi',
   'Chu kỳ không chỉ là những ngày có kinh: mỗi pha đều đi kèm thay đổi về năng lượng, giấc ngủ và cảm xúc.',
   'Chu kỳ kinh nguyệt được tính từ ngày đầu tiên có kinh đến ngày trước kỳ kinh sau. Ở người trưởng thành, chu kỳ thường dài từ 21 đến 35 ngày, và độ dài có thể thay đổi đôi chút theo từng tháng.

Trong pha kinh nguyệt, cơ thể mất máu nên nhiều người thấy mệt, đau bụng dưới và năng lượng thấp. Đây là lúc nên nghỉ ngơi nhiều hơn, vận động nhẹ và ngủ đủ giấc thay vì cố tập nặng.

Sau kỳ kinh là pha nang noãn. Nồng độ estrogen tăng dần, năng lượng và tâm trạng thường hồi phục. Nhiều người thấy dễ vận động hơn trong giai đoạn này, có thể tăng dần cường độ tập nếu cơ thể cho phép.

Khoảng giữa chu kỳ là thời điểm rụng trứng. Một số người cảm thấy đau nhẹ một bên bụng dưới trong thời gian ngắn hoặc thấy dịch nhầy thay đổi. Đây là những thay đổi thường gặp, nhưng mức độ khác nhau ở mỗi người.

Pha hoàng thể là giai đoạn sau rụng trứng, khi progesterone tăng lên. Nhiều người dễ đầy hơi, mệt mỏi, thèm ăn và ngủ nông hơn. Giữ giờ ngủ cố định, ăn đủ bữa và vận động vừa sức thường giúp giai đoạn này dễ chịu hơn.

Bài viết chỉ mang tính tham khảo, không thay thế tư vấn y tế. Nếu chu kỳ thay đổi đột ngột, đau dữ dội hoặc ra máu nhiều bất thường, bạn nên đi khám để được kiểm tra trực tiếp.',
   NULL, NULL, 5, 'beginner'::public.post_level, now()),
  ('article'::public.post_kind,
   'Đau bụng kinh và mệt mỏi trong kỳ: làm gì để dễ chịu hơn',
   'Vận động nhẹ, chườm ấm, ngủ đủ và ăn uống đều đặn thường giúp cơ thể dễ chịu hơn trong những ngày có kinh.',
   'Đau bụng kinh xảy ra khi tử cung co bóp để đẩy lớp niêm mạc ra ngoài. Cơn đau thường âm ỉ trong 1 đến 2 ngày đầu của kỳ kinh, có thể kèm theo mệt mỏi, đau lưng hoặc buồn nôn nhẹ ở một số người.

Vận động nhẹ như đi bộ chậm, giãn cơ và yoga nhẹ giúp máu lưu thông tốt hơn và nhiều người thấy đỡ đau hơn. Khi đang đau nhiều thì không nên tập nặng, và cần dừng lại ngay nếu thấy chóng mặt hoặc khó thở.

Chườm ấm vùng bụng dưới, tắm nước ấm và nghỉ ngơi cũng là những cách đơn giản thường được dùng trong kỳ kinh. Giữ ấm cơ thể và tránh làm việc quá sức trong những ngày này.

Giấc ngủ và ăn uống cũng ảnh hưởng rõ rệt đến cảm giác mệt mỏi. Bạn nên giữ giờ ngủ cố định, uống đủ nước và ăn đủ bữa, vì bỏ bữa khi đang mất máu thường làm cơ thể mệt thêm.

Ghi nhận ngày có kinh, lượng kinh và triệu chứng trong app giúp bạn thấy xu hướng của chính mình theo từng tháng. Ghi nhận này chỉ để theo dõi, không dùng để tự chẩn đoán bệnh.

Bạn nên đi khám sớm nếu đau dữ dội không giảm, phải thay băng liên tục vì ra máu rất nhiều, bị sốt, ngất, hoặc chu kỳ thay đổi đột ngột. Bài viết chỉ mang tính tham khảo, không thay thế tư vấn y tế.',
   NULL, NULL, 4, 'beginner'::public.post_level, now() - interval '1 day')
) AS v(kind, title, summary, body, cover_url, video_url, duration_min, level, published_at)
WHERE NOT EXISTS (
  SELECT 1 FROM public.posts p WHERE p.title = v.title
);
COMMIT;

-- ---------------------------------------------------------------------
-- PHẦN 10: Kiểm tra (chỉ SELECT, không đổi dữ liệu)
-- Gom từ: update_profile.sql, update_meal.sql,
-- workout_logs.sql, update_post.sql, Untitled query 757.sql
-- ---------------------------------------------------------------------
SELECT display_name, date_of_birth FROM public.profiles;

SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('meals', 'meal_items')
ORDER BY table_name, ordinal_position;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'meal_items'
  AND column_name IN ('grams', 'barcode');

SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'kcal_estimate';

SELECT count(*) AS workout_logs_count FROM public.workout_logs;

SELECT title, duration_min, level, kcal_estimate FROM public.posts
  WHERE kind = 'workout' ORDER BY duration_min;

SELECT title, duration_min, level, published_at
FROM public.posts WHERE kind = 'article'
ORDER BY published_at DESC NULLS LAST LIMIT 2;
