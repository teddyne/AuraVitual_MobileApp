-- =====================================================================
-- AuraVital — FILE SQL TỔNG HỢP HOÀN CHỈNH
-- Gộp TOÀN BỘ thay đổi DB từ đầu tới nay thành 1 file, chạy 1 lần là đủ.
--
-- CÁCH CHẠY: dán toàn bộ file vào Supabase SQL Editor của PROJECT MỚI
-- (database trống) rồi Run 1 lần.
-- KHÔNG chạy file này chồng lên project local/cloud hiện tại: các project
-- đó đã có đủ schema rồi, các lệnh CREATE TABLE/CREATE TYPE thường (không
-- có IF NOT EXISTS) sẽ báo lỗi trùng.
-- =====================================================================

-- =====================================================================
-- PHẦN A — SCHEMA GỐC (30/10/2026)
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm  with schema extensions;

-- ---------------------------------------------------------------------
-- 1. ENUM (gom toàn bộ về đầu file)
-- ---------------------------------------------------------------------
create type public.meal_type    as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type public.food_source  as enum ('seed', 'manual', 'ai', 'barcode');
create type public.meal_source  as enum ('manual', 'library', 'ai', 'barcode');
create type public.steps_source as enum ('auto', 'manual');
create type public.post_kind    as enum ('article', 'workout');
create type public.post_level   as enum ('beginner', 'intermediate', 'advanced');
create type public.period_flow  as enum ('light', 'medium', 'heavy');  -- Ít / Trung bình / Nhiều

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
  date_of_birth    date,
  gender           text check (gender in ('Nam', 'Nữ', 'Khác')),
  step_goal        integer      not null default 10000 check (step_goal between 1000 and 100000),
  water_goal_ml    integer      not null default 2200  check (water_goal_ml between 500 and 10000),
  sleep_goal_hours numeric(3,1) not null default 8     check (sleep_goal_hours between 4 and 12),
  calorie_goal     integer      not null default 2000  check (calorie_goal between 800 and 6000),
  bedtime_time     time,
  wake_time        time,
  sleep_reminder_enabled boolean not null default true,
  alarm_enabled    boolean not null default true,
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
  source           public.meal_source not null default 'manual',
  barcode          text check (barcode is null or barcode ~ '^[0-9]{8,14}$'),
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
-- grams giữ số gam gốc từ mã vạch/AI, vì servings đã đổi gam ra suất thì không khôi phục lại được gam gốc.
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
  grams      numeric(7,1) check (grams is null or grams >= 0),
  barcode    text check (barcode is null or barcode ~ '^[0-9]{8,14}$'),
  created_at timestamptz not null default now()
);
create index meal_items_meal_idx on public.meal_items (meal_id);

-- Trigger tự tính tổng bữa ăn từ meal_items.
-- BẮT BUỘC là SECURITY DEFINER: file này thu hồi quyền UPDATE 4 cột tổng
-- của role authenticated (để client không tự ghi tổng), mà trigger chạy
-- theo quyền người gọi thì chính trigger cũng bị chặn → mọi lệnh thêm/
-- sửa/xóa meal_items đều lỗi. Chạy dưới quyền postgres thì trigger vẫn
-- chỉ cập nhật đúng bữa ăn của dòng vừa đổi, và việc ghi meal_items đã
-- được RLS kiểm tra trước đó nên an toàn.
create or replace function public.recalc_meal_totals()
returns trigger language plpgsql security definer set search_path = '' as $$
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
-- p_items: [{food_id,name,servings,kcal,carb_g,protein_g,fat_g,grams,barcode}, ...]
-- Món mã vạch/AI: app tạo Food trước (source = 'barcode'/'ai'), rồi truyền food_id vào đây.
-- 2 tham số cuối có default nên lệnh gọi cũ 5 tham số vẫn chạy được.
create or replace function public.save_meal(
  p_meal_id uuid, p_eaten_at timestamptz, p_meal_type public.meal_type,
  p_photo_path text, p_items jsonb,
  p_source public.meal_source default 'manual'::public.meal_source,
  p_barcode text default null)
returns uuid language plpgsql set search_path = '' as $$   -- SECURITY INVOKER: RLS vẫn áp dụng
declare v_uid uuid := (select auth.uid()); v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'meal_needs_items';                    -- Meal 1..* MealItem
  end if;
  if p_barcode is not null and p_barcode !~ '^[0-9]{8,14}$' then
    raise exception 'invalid_barcode';
  end if;

  insert into public.meals as m (id, user_id, eaten_at, meal_type, photo_path, source, barcode)
  values (coalesce(p_meal_id, gen_random_uuid()), v_uid, p_eaten_at, p_meal_type, p_photo_path, p_source, p_barcode)
  on conflict (id) do update
     set eaten_at = excluded.eaten_at, meal_type = excluded.meal_type,
         photo_path = excluded.photo_path, source = excluded.source, barcode = excluded.barcode
   where m.user_id = v_uid
  returning id into v_id;
  if v_id is null then raise exception 'meal_not_found'; end if;

  delete from public.meal_items where meal_id = v_id;
  insert into public.meal_items (meal_id, food_id, name, servings, kcal, carb_g, protein_g, fat_g, grams, barcode)
  select v_id, x.food_id, x.name, x.servings, x.kcal,
         coalesce(x.carb_g, 0), coalesce(x.protein_g, 0), coalesce(x.fat_g, 0),
         x.grams, x.barcode
    from jsonb_to_recordset(p_items) as x(
         food_id uuid, name text, servings numeric, kcal numeric,
         carb_g numeric, protein_g numeric, fat_g numeric,
         grams numeric, barcode text);
  return v_id;
end $$;
revoke execute on function public.save_meal(uuid, timestamptz, public.meal_type, text, jsonb, public.meal_source, text) from public, anon;
grant  execute on function public.save_meal(uuid, timestamptz, public.meal_type, text, jsonb, public.meal_source, text) to authenticated;

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

-- Ghi nhận kinh nguyệt + triệu chứng theo từng ngày.
create table public.cycle_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  log_date   date not null,
  has_period boolean not null default false,
  flow       public.period_flow,
  spotting   boolean not null default false,
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
  kcal_estimate integer check (kcal_estimate is null or kcal_estimate >= 0),
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
-- 10. QUOTA QUÉT AI PHÍA SERVER (chỉ Edge Function dùng service_role)
-- ---------------------------------------------------------------------
create table public.ai_scan_usage (
  user_id    uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,                               -- ngày giờ Việt Nam do Edge Function tính
  scan_count integer not null default 0 check (scan_count >= 0),
  primary key (user_id, usage_date)
);

-- ---------------------------------------------------------------------
-- 11. ĐỀ XUẤT
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
create trigger trg_recommendations_updated before update on public.recommendations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 12. PHIÊN NGỦ
-- ---------------------------------------------------------------------
create table if not exists public.sleep_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_minutes int not null check (duration_minutes > 0 and duration_minutes <= 1440),
  snooze_count int not null default 0,
  source text not null check (source in ('alarm', 'next_day', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sleep_sessions_user_started_idx
  on public.sleep_sessions (user_id, started_at desc);
create trigger trg_sleep_sessions_updated before update on public.sleep_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 13. NHẬT KÝ TẬP
-- ---------------------------------------------------------------------
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
create trigger trg_workout_logs_updated before update on public.workout_logs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 14. VIEW CHIA SẺ (chỉ lộ các cột cần cho người xem)
-- ---------------------------------------------------------------------
-- security_invoker = false: view chạy dưới quyền owner (postgres) nên RLS
-- của profiles không chặn các dòng của người khác; điều kiện WHERE trong
-- view vẫn chỉ cho thấy hồ sơ của chính mình hoặc của người đã chia sẻ
-- cho mình. Nếu để view chạy theo quyền người xem, RLS profiles (chỉ chủ
-- sở hữu) sẽ lọc mất hết dòng của người nhà.
create view public.shared_profiles with (security_invoker = false) as
select p.id, p.display_name, p.step_goal, p.water_goal_ml, p.sleep_goal_hours
  from public.profiles p
 where p.id = (select auth.uid())
    or exists (select 1 from public.family_links fl
                where fl.owner_id = p.id and fl.viewer_id = (select auth.uid()));
revoke all on public.shared_profiles from anon;
grant select on public.shared_profiles to authenticated;

-- ---------------------------------------------------------------------
-- 15. HÀM MÃ MỜI
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
-- 16. RLS
-- ---------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.health_metrics    enable row level security;
alter table public.foods             enable row level security;
alter table public.meals             enable row level security;
alter table public.meal_items        enable row level security;
alter table public.cycles            enable row level security;
alter table public.cycle_logs        enable row level security;
alter table public.family_invites    enable row level security;
alter table public.family_links      enable row level security;
alter table public.invite_attempts   enable row level security;
alter table public.posts             enable row level security;
alter table public.workout_steps     enable row level security;
alter table public.reminder_settings enable row level security;
alter table public.ai_scan_usage     enable row level security;
alter table public.recommendations   enable row level security;
alter table public.sleep_sessions    enable row level security;
alter table public.workout_logs      enable row level security;

-- Chỉ chủ sở hữu
create policy profiles_own on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy meals_own on public.meals for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cycles_own on public.cycles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cycle_logs_own on public.cycle_logs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy reminders_own on public.reminder_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy recommendations_owner on public.recommendations for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy sleep_sessions_owner on public.sleep_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

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

-- Nhật ký tập: mỗi người chỉ thấy / sửa được dòng của chính mình
create policy workout_logs_select_own on public.workout_logs
  for select using (auth.uid() = user_id);
create policy workout_logs_insert_own on public.workout_logs
  for insert with check (auth.uid() = user_id);
create policy workout_logs_update_own on public.workout_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy workout_logs_delete_own on public.workout_logs
  for delete using (auth.uid() = user_id);

-- GRANT cho role authenticated, khớp đúng với policy của từng bảng.
-- Từ 30/10/2026 Supabase không còn tự cấp quyền cho bảng mới trong schema
-- public: không có GRANT thì app báo 42501 permission denied trước cả khi
-- RLS chạy. Chỉ cấp cho authenticated; KHÔNG cấp cho anon.
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.health_metrics to authenticated;
grant select, insert, update, delete on public.foods to authenticated;
grant select, insert, update, delete on public.meals to authenticated;
grant select, insert, update, delete on public.meal_items to authenticated;
grant select, insert, update, delete on public.cycles to authenticated;
grant select, insert, update, delete on public.cycle_logs to authenticated;
grant select, delete on public.family_invites to authenticated;
grant select, delete on public.family_links to authenticated;
grant select on public.posts to authenticated;
grant select on public.workout_steps to authenticated;
grant select, insert, update, delete on public.reminder_settings to authenticated;
grant select, insert, update, delete on public.recommendations to authenticated;
grant select, insert, update, delete on public.sleep_sessions to authenticated;
grant select, insert, update, delete on public.workout_logs to authenticated;
-- invite_attempts, ai_scan_usage: cố tình KHÔNG cấp quyền cho client
-- (chỉ hàm SECURITY DEFINER / Edge Function dùng service_role mới ghi được).

-- invite_attempts, ai_scan_usage: không policy, không quyền cho client
revoke all on public.invite_attempts from anon, authenticated;
revoke all on public.ai_scan_usage   from anon, authenticated;
revoke insert, update on public.family_links   from authenticated;
revoke insert, update on public.family_invites from authenticated;
-- Tổng kcal/chất của bữa ăn do trigger tính, client không được tự ghi.
-- LƯU Ý THỨ TỰ: lệnh này phải đứng SAU lệnh GRANT cho bảng meals ở trên,
-- nếu không GRANT sẽ cấp lại quyền vừa thu hồi.
revoke update (total_kcal, total_carb_g, total_protein_g, total_fat_g) on public.meals from authenticated;

-- ---------------------------------------------------------------------
-- 17. STORAGE: bucket riêng tư cho ảnh bữa ăn
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

create policy meal_photos_own on storage.objects for all to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------
-- 18. SEED — món ăn, bài viết/bài tập, bước tập
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

-- Kcal ước tính cho 3 bài tập gốc.
UPDATE public.posts SET kcal_estimate = 40
  WHERE kind = 'workout' AND title = 'Bài tập giãn cơ 10 phút buổi sáng';
UPDATE public.posts SET kcal_estimate = 110
  WHERE kind = 'workout' AND title = 'Đi bộ nhanh 20 phút cho người mới bắt đầu';
UPDATE public.posts SET kcal_estimate = 60
  WHERE kind = 'workout' AND title = 'Yoga nhẹ nhàng trước khi ngủ';

-- 2 bài tập + 2 bài viết mới.
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

-- Bước tập cho 2 bài mới.
-- LƯU Ý VỀ YOGA BUỔI SÁNG: Figma ghi 5 động tác 60/45/60/45/90 giây thì
-- tổng chỉ 5 phút, không khớp tiêu đề 15 phút trên cùng thẻ đó. Seed này
-- giữ đúng tên + thứ tự 5 động tác của Figma, nhưng nhân thời lượng mỗi
-- động tác để tổng = 900 giây = 15 phút, cho khớp thanh tiến trình của
-- trình phát. Nếu nhóm muốn giữ đúng giây gốc của Figma thì sửa
-- duration_sec về 60/45/60/45/90 và chấp nhận trình phát chỉ chạy 5 phút.
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

-- 2 bài viết chu kỳ.
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

-- =====================================================================

-- =====================================================================
-- PHẦN B — CHIA SẺ GIA ĐÌNH (migration 31/10/2026)
-- =====================================================================

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

-- =====================================================================
-- PHẦN C — PATCH v2 (31/10/2026): quyền UPDATE family_links + rotate_invite
-- (trùng với supabase/snippets/20261102_update_sharing.sql)
-- =====================================================================

grant select, insert, update, delete on public.family_links to authenticated;

-- 2. HÀM TẠO LẠI MÃ MỜI (sửa nút "Tải lại mã" bấm không đổi mã).
--    Nút cũ chỉ đọc lại mã đang còn hiệu lực nên mã không bao giờ đổi.
--    Hàm này hủy các mã cũ còn hiệu lực của người gọi rồi cấp mã mới
--    (dùng lại đúng logic sinh mã của create_invite, vẫn 8 ký tự,
--    vẫn hiệu lực 24 giờ, mã cũ hết hiệu lực ngay).
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

-- =====================================================================
-- PHẦN D — AVATAR + MEDIA (04/11/2026, Dot2)
-- =====================================================================

-- 1) Cột ảnh đại diện cho bảng profiles (trước đây chưa có cột này)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2) Bucket chứa ảnh đại diện (public để app hiển thị được bằng URL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "avatars_auth_upload" ON storage.objects;
CREATE POLICY "avatars_auth_upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
DROP POLICY IF EXISTS "avatars_auth_update" ON storage.objects;
CREATE POLICY "avatars_auth_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "avatars_auth_delete" ON storage.objects;
CREATE POLICY "avatars_auth_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'avatars');

-- 3) Bucket chứa video bài tập (public; dùng cho mục 5 bên dưới)
INSERT INTO storage.buckets (id, name, public)
VALUES ('workout-videos', 'workout-videos', true)
ON CONFLICT (id) DO NOTHING;

-- 4) Ảnh bìa thật cho tất cả bài viết / bài tập (ảnh Unsplash theo chủ đề).
-- Chỉ cập nhật các bài có đúng tiêu đề như bản seed; bài nào nhóm đổi tên
-- thì sửa lại tiêu đề trong lệnh tương ứng.
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=800&q=80' WHERE title = 'Đi bộ 30 phút mỗi ngày có đủ không?';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1559825481-12a05cc00344?auto=format&fit=crop&w=800&q=80' WHERE title = 'Uống nước đúng cách trong ngày';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=800&q=80' WHERE title = 'Ngủ đủ giấc giúp phục hồi như thế nào?';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=800&q=80' WHERE title = 'Ăn sáng đủ chất mà không quá nhiều calo';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&q=80' WHERE title = 'Ngồi lâu: đứng dậy vận động mỗi giờ';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80' WHERE title = 'Bài tập giãn cơ 10 phút buổi sáng';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=800&q=80' WHERE title = 'Đi bộ nhanh 20 phút cho người mới bắt đầu';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80' WHERE title = 'Yoga nhẹ nhàng trước khi ngủ';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1588286840104-8957b019727f?auto=format&fit=crop&w=800&q=80' WHERE title = '15 phút Yoga & Giãn cơ cột sống buổi sáng';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=800&q=80' WHERE title = 'HIIT Đốt mỡ toàn thân';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=800&q=80' WHERE title = 'Siêu thực phẩm giúp tăng cường hệ miễn dịch';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80' WHERE title = 'Kỹ thuật điều hòa nhịp thở tối ưu sau khi chạy';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80' WHERE title = 'Hiểu chu kỳ kinh nguyệt: 4 pha và cách cơ thể thay đổi';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1552196563-55cd4e45efb3?auto=format&fit=crop&w=800&q=80' WHERE title = 'Đau bụng kinh và mệt mỏi trong kỳ: làm gì để dễ chịu hơn';
