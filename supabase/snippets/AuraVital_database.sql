drop schema public cascade;
create schema public;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm  with schema extensions;

-- ---------------------------------------------------------------------
-- 1. ENUM (gom toàn bộ về đầu file)
-- ---------------------------------------------------------------------
create type public.meal_type    as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type public.food_source  as enum ('seed', 'manual', 'ai', 'barcode');
create type public.meal_source  as enum ('manual', 'library', 'ai', 'barcode');
create type public.steps_source as enum ('auto', 'manual');
-- (V4) ĐÃ XÓA enum public.post_kind ('article','workout'): posts không
-- còn cột kind; phân loại bài viết/bài tập chỉ dùng cột topic (xem mục 8).
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
  avatar_url       text,  -- (V5) ảnh đại diện, inline từ đầu (code updateAvatarUrl dùng cột này)
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
  nickname   text check (nickname is null or char_length(btrim(nickname)) between 1 and 30),  -- (V5) biệt danh, inline từ đầu
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
  -- (V4) Không còn cột kind / enum post_kind (đã xóa ở mục 1).
  -- topic phân loại bài viết theo màn hình: dinh dưỡng (Home),
  -- chu kỳ (Cycle), giấc ngủ (Explore), vận động (fitness),
  -- bài tập có video/bước tập (workout), còn lại (general).
  -- Gộp migration 20261107220000_add_topic_to_posts.sql (thêm cột
  -- topic) + 20261107230000_drop_kind_add_workout_topic.sql (xóa cột
  -- kind, nới check topic thêm giá trị 'workout').
  topic        text not null default 'general'
               check (topic in ('nutrition', 'cycle', 'sleep', 'general', 'fitness', 'workout')),
  title        text not null,
  summary      text,
  body         text,
  cover_url    text,
  video_url    text,
  duration_min smallint check (duration_min > 0),
  level        public.post_level,
  kcal_estimate integer check (kcal_estimate is null or kcal_estimate >= 0),
  published_at timestamptz not null default now(),
  -- (V4) Thay check cũ "kind <> 'article' or body is not null":
  -- bài viết (topic != 'workout') bắt buộc có body; bài tập
  -- (topic = 'workout') có thể chỉ có video + workout_steps.
  check (topic = 'workout' or body is not null)
);
create index posts_topic_published_idx on public.posts (topic, published_at desc);

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
  -- (V4) Gộp từ migration 20261107213100_add_deep_sleep_to_sleep_sessions.sql.
  -- NULL khi chưa có dữ liệu (phiên cũ / app chưa ghi được giai đoạn ngủ).
  deep_sleep_minutes int check (deep_sleep_minutes is null or (deep_sleep_minutes >= 0 and deep_sleep_minutes <= duration_minutes)),
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
-- 13b. ĐƠN GÓI ĐĂNG KÝ — AuraVital Gold (V4, gộp từ migration v1
-- 20261107213000_create_subscription_orders.sql + migration
-- 20261107220100_allow_cancelled_subscription_orders.sql).
-- Đơn demo: app ghi 1 dòng lúc tạo đơn (status 'pending_demo') và
-- chuyển thành 'paid_demo' lúc người dùng bấm "Tôi đã thanh toán";
-- 'cancelled' khi người dùng hủy gói. Gói đang dùng vẫn đọc từ
-- AsyncStorage (xem subscriptionService.ts) để không vỡ flow demo.
-- Đặt ở đây (sau sleep_sessions/workout_logs, trước view mục 14) vì
-- đây là bảng nghiệp vụ mới, có RLS + grant đi kèm ngay dưới.
-- ---------------------------------------------------------------------
create table public.subscription_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null check (plan_id in ('free', 'pro', 'family')),
  order_code text not null unique,
  customer_name text,
  phone text,
  payment_method text check (payment_method in ('bank', 'momo')),
  total_vnd int not null check (total_vnd >= 0),
  status text not null default 'pending_demo'
    check (status in ('pending_demo', 'paid_demo', 'cancelled')),
  activated_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index subscription_orders_user_created_idx
  on public.subscription_orders (user_id, created_at desc);
alter table public.subscription_orders enable row level security;
create policy subscription_orders_owner on public.subscription_orders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Chỉ chủ đơn được đọc/ghi đơn của mình; KHÔNG cấp delete (hủy gói chỉ
-- đổi status thành 'cancelled', không xóa dòng để còn lịch sử).
grant select, insert, update on public.subscription_orders to authenticated;

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

-- V6 FIX 2 — policy này tồn tại từ lần chạy trước (schema storage không bị
-- drop schema public xóa), nên phải DROP trước rồi mới CREATE (xem lỗi 2 ở header).
drop policy if exists meal_photos_own on storage.objects;
create policy meal_photos_own on storage.objects for all to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------
-- 18. SEED — món ăn, bài viết/bài tập, bước tập
-- ---------------------------------------------------------------------
-- Số liệu dinh dưỡng của 10 món thêm mới bên dưới là ƯỚC TÍNH THAM KHẢO
-- theo khẩu phần ghi ở serving_label (không phải số liệu đo phòng lab);
-- nhóm kiểm tra lại trước khi dùng làm căn cứ tư vấn dinh dưỡng.
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
  ('Bánh mì trứng ốp la',  '1 ổ',    300, 38.0, 12.0, 10.0),
  ('Cơm tấm sườn',         '1 đĩa',  650, 70.0, 30.0, 25.0),
  ('Bún bò Huế',           '1 tô',   480, 60.0, 28.0, 14.0),
  ('Cháo gà',              '1 tô',   250, 35.0, 18.0,  4.0),
  ('Gỏi cuốn',             '2 cuốn', 150, 20.0,  8.0,  3.0),
  ('Thịt bò xào',          '1 đĩa',  320,  8.0, 30.0, 18.0),
  ('Cá kho',               '1 đĩa',  280,  6.0, 26.0, 16.0),
  ('Trứng chiên',          '1 quả',  110,  1.0,  7.0,  8.0),
  ('Khoai lang luộc',      '1 củ',   130, 30.0,  2.0,  0.2),
  ('Đậu hũ non',           '1 hộp',   90,  4.0,  8.0,  5.0),
  ('Nước cam',             '1 ly',   110, 26.0,  1.0,  0.5)
) AS v(name, serving, kcal, carb, protein, fat)
WHERE NOT EXISTS (
  SELECT 1 FROM public.foods f
  WHERE f.name = v.name AND f.owner_id IS NULL
);

-- Seed posts V4 — viết lại toàn bộ thành đúng 15 bài (nutrition 3,
-- cycle 3, sleep 3, fitness 2, general 1, workout 3). Giữ nguyên văn
-- title của 10 bài gốc còn lại + body dài của 2 bài chu kỳ trong file
-- gốc; 2 bài ngủ mới lấy nguyên văn title/summary/body từ
-- supabase/seed_sleep_articles.sql (v2); 3 bài mới còn lại (1 nutrition,
-- 1 cycle, 1 general) viết mới. BỎ 4 bài của file gốc: '15 phút Yoga &
-- Giãn cơ cột sống buổi sáng', 'HIIT Đốt mỡ toàn thân', 'Siêu thực phẩm
-- giúp tăng cường hệ miễn dịch', 'Kỹ thuật điều hòa nhịp thở tối ưu sau
-- khi chạy' (và bỏ luôn workout_steps của 2 bài workout bị bỏ này).
-- published_at rải theo ngày khác nhau (bài mới hơn thì ngày mới hơn).
INSERT INTO public.posts
  (topic, title, summary, body, cover_url, video_url, duration_min, level, kcal_estimate, published_at)
SELECT v.topic, v.title, v.summary, v.body, v.cover_url, v.video_url,
       v.duration_min, v.level, v.kcal_estimate, v.published_at
FROM (VALUES
  ('nutrition',
   'Uống nước đúng cách trong ngày',
   'Chia đều lượng nước theo các khung giờ.',
   'Cơ thể cần nước đều đặn trong ngày chứ không phải dồn một lúc vào buổi tối. Hãy uống từng ngụm nhỏ vào các mốc cố định như sau khi thức dậy, trước bữa ăn và sau khi vận động. Mang theo bình nước và đặt nhắc trong app sẽ giúp bạn duy trì thói quen này dễ hơn.',
   'https://images.unsplash.com/photo-1559825481-12a05cc00344?auto=format&fit=crop&w=800&q=80', NULL,
   4, 'beginner'::public.post_level, NULL, now() - interval '13 days'),
  ('nutrition',
   'Ăn sáng đủ chất mà không quá nhiều calo',
   'Bữa sáng có đạm và rau, hạn chế đồ chiên.',
   'Bữa sáng đủ chất nên có đạm như trứng hoặc sữa chua, kèm rau hoặc trái cây và một phần tinh bột vừa phải. Hạn chế đồ chiên nhiều dầu vào buổi sáng vì dễ gây nặng bụng và thừa calo. Ghi lại bữa ăn trong app để theo dõi tổng calo trong ngày.',
   'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=800&q=80', NULL,
   4, 'beginner'::public.post_level, NULL, now() - interval '11 days'),
  ('nutrition',
   'Ăn rau xanh mỗi ngày: bao nhiêu là đủ?',
   'Một nửa đĩa ăn là rau củ: cách ước lượng nhanh mà không cần cân đo.',
   'Người trưởng thành nên ăn khoảng 300–400 g rau củ mỗi ngày, tương đương 2–3 phần ăn kèm trong các bữa chính. Cách nhớ nhanh là một nửa đĩa ăn dành cho rau củ, một phần tư cho tinh bột và một phần tư cho đạm. Ưu tiên rau theo mùa, đổi món thường xuyên để đủ vitamin và chất xơ.',
   'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80', NULL,
   4, 'beginner'::public.post_level, NULL, now() - interval '6 days'),
  ('cycle',
   'Hiểu chu kỳ kinh nguyệt: 4 pha và cách cơ thể thay đổi',
   'Chu kỳ không chỉ là những ngày có kinh: mỗi pha đều đi kèm thay đổi về năng lượng, giấc ngủ và cảm xúc.',
   'Chu kỳ kinh nguyệt được tính từ ngày đầu tiên có kinh đến ngày trước kỳ kinh sau. Ở người trưởng thành, chu kỳ thường dài từ 21 đến 35 ngày, và độ dài có thể thay đổi đôi chút theo từng tháng.

Trong pha kinh nguyệt, cơ thể mất máu nên nhiều người thấy mệt, đau bụng dưới và năng lượng thấp. Đây là lúc nên nghỉ ngơi nhiều hơn, vận động nhẹ và ngủ đủ giấc thay vì cố tập nặng.

Sau kỳ kinh là pha nang noãn. Nồng độ estrogen tăng dần, năng lượng và tâm trạng thường hồi phục. Nhiều người thấy dễ vận động hơn trong giai đoạn này, có thể tăng dần cường độ tập nếu cơ thể cho phép.

Khoảng giữa chu kỳ là thời điểm rụng trứng. Một số người cảm thấy đau nhẹ một bên bụng dưới trong thời gian ngắn hoặc thấy dịch nhầy thay đổi. Đây là những thay đổi thường gặp, nhưng mức độ khác nhau ở mỗi người.

Pha hoàng thể là giai đoạn sau rụng trứng, khi progesterone tăng lên. Nhiều người dễ đầy hơi, mệt mỏi, thèm ăn và ngủ nông hơn. Giữ giờ ngủ cố định, ăn đủ bữa và vận động vừa sức thường giúp giai đoạn này dễ chịu hơn.

Bài viết chỉ mang tính tham khảo, không thay thế tư vấn y tế. Nếu chu kỳ thay đổi đột ngột, đau dữ dội hoặc ra máu nhiều bất thường, bạn nên đi khám để được kiểm tra trực tiếp.',
   'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80', NULL,
   5, 'beginner'::public.post_level, NULL, now()),
  ('cycle',
   'Đau bụng kinh và mệt mỏi trong kỳ: làm gì để dễ chịu hơn',
   'Vận động nhẹ, chườm ấm, ngủ đủ và ăn uống đều đặn thường giúp cơ thể dễ chịu hơn trong những ngày có kinh.',
   'Đau bụng kinh xảy ra khi tử cung co bóp để đẩy lớp niêm mạc ra ngoài. Cơn đau thường âm ỉ trong 1 đến 2 ngày đầu của kỳ kinh, có thể kèm theo mệt mỏi, đau lưng hoặc buồn nôn nhẹ ở một số người.

Vận động nhẹ như đi bộ chậm, giãn cơ và yoga nhẹ giúp máu lưu thông tốt hơn và nhiều người thấy đỡ đau hơn. Khi đang đau nhiều thì không nên tập nặng, và cần dừng lại ngay nếu thấy chóng mặt hoặc khó thở.

Chườm ấm vùng bụng dưới, tắm nước ấm và nghỉ ngơi cũng là những cách đơn giản thường được dùng trong kỳ kinh. Giữ ấm cơ thể và tránh làm việc quá sức trong những ngày này.

Giấc ngủ và ăn uống cũng ảnh hưởng rõ rệt đến cảm giác mệt mỏi. Bạn nên giữ giờ ngủ cố định, uống đủ nước và ăn đủ bữa, vì bỏ bữa khi đang mất máu thường làm cơ thể mệt thêm.

Ghi nhận ngày có kinh, lượng kinh và triệu chứng trong app giúp bạn thấy xu hướng của chính mình theo từng tháng. Ghi nhận này chỉ để theo dõi, không dùng để tự chẩn đoán bệnh.

Bạn nên đi khám sớm nếu đau dữ dội không giảm, phải thay băng liên tục vì ra máu rất nhiều, bị sốt, ngất, hoặc chu kỳ thay đổi đột ngột. Bài viết chỉ mang tính tham khảo, không thay thế tư vấn y tế.',
   'https://images.unsplash.com/photo-1552196563-55cd4e45efb3?auto=format&fit=crop&w=800&q=80', NULL,
   4, 'beginner'::public.post_level, NULL, now() - interval '1 day'),
  ('cycle',
   'Theo dõi chu kỳ trong app: ghi lại gì mỗi tháng?',
   'Chỉ cần ghi ngày có kinh, lượng kinh và triệu chứng nổi bật là đủ để thấy xu hướng của chính mình.',
   'Để theo dõi chu kỳ, bạn chỉ cần ghi ngày bắt đầu có kinh, số ngày kéo dài và lượng kinh ước lượng mỗi ngày. Thêm các triệu chứng nổi bật như đau bụng, mệt mỏi hay thay đổi giấc ngủ để thấy xu hướng theo từng tháng. Dữ liệu này chỉ giúp bạn hiểu cơ thể mình hơn, không dùng để tự chẩn đoán bệnh.',
   'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=800&q=80', NULL,
   4, 'beginner'::public.post_level, NULL, now() - interval '3 days'),
  ('sleep',
   'Ngủ đủ giấc giúp phục hồi như thế nào?',
   'Giấc ngủ sâu và giờ ngủ cố định.',
   'Giấc ngủ đủ và đều đặn giúp cơ thể phục hồi sau một ngày vận động và làm việc. Người trưởng thành thường cần khoảng 7–9 giờ ngủ mỗi đêm, kèm giờ đi ngủ và thức dậy cố định. Hạn chế màn hình và caffeine vào buổi tối để dễ đi vào giấc ngủ hơn.',
   'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=800&q=80', NULL,
   4, 'beginner'::public.post_level, NULL, now() - interval '12 days'),
  ('sleep',
   'Giữ giờ ngủ cố định mỗi ngày',
   'Đi ngủ và thức dậy cùng một giờ mỗi ngày giúp cơ thể quen với nhịp sinh học ổn định.',
   'Cơ thể quen dần với một khung giờ ngủ cố định, nhờ đó bạn dễ buồn ngủ vào buổi tối và tỉnh táo hơn vào buổi sáng. Hãy chọn một giờ đi ngủ và giờ thức dậy mà bạn duy trì được cả ngày thường lẫn cuối tuần, thay vì xê dịch quá nhiều. Nếu muốn đổi giờ ngủ, hãy dịch dần từng chút một trong vài ngày để cơ thể kịp thích nghi. Một lịch ngủ đều đặn cũng giúp bạn dễ theo dõi xem mình ngủ có đủ giấc hay không.',
   'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80', NULL,
   4, 'beginner'::public.post_level, NULL, now() - interval '4 days'),
  ('sleep',
   'Hạn chế màn hình trước khi ngủ',
   'Đặt điện thoại xuống trước giờ ngủ giúp đầu óc thư giãn và dễ chìm vào giấc ngủ hơn.',
   'Ánh sáng màn hình và các thông báo liên tục khiến đầu óc khó thư giãn trước giờ ngủ. Hãy dành khoảng thời gian trước khi ngủ để làm những việc nhẹ nhàng như đọc sách, giãn cơ hoặc chuẩn bị đồ cho ngày hôm sau. Đặt điện thoại ra xa giường và để chế độ im lặng để không bị đánh thức giữa đêm. Nếu khó bỏ thói quen lướt điện thoại, bạn có thể nhờ người thân nhắc hoặc đặt báo thức làm dấu hiệu bắt đầu giờ nghỉ ngơi.',
   'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=800&q=80', NULL,
   4, 'beginner'::public.post_level, NULL, now() - interval '5 days'),
  ('fitness',
   'Đi bộ 30 phút mỗi ngày có đủ không?',
   'Đi bộ đều đặn và cách tăng dần thời lượng.',
   'Đi bộ 30 phút mỗi ngày là mức vận động vừa sức với đa số người trưởng thành, giúp tim mạch khỏe hơn và ngủ ngon hơn. Bạn có thể chia thành 2–3 lần đi ngắn trong ngày thay vì đi một mạch. Tăng dần tốc độ hoặc thời lượng theo từng tuần, và mang giày êm để tránh đau chân.',
   'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=800&q=80', NULL,
   5, 'beginner'::public.post_level, NULL, now() - interval '14 days'),
  ('fitness',
   'Ngồi lâu: đứng dậy vận động mỗi giờ',
   'Nhắc mỗi giờ để đứng dậy, đi lại vài phút.',
   'Ngồi liên tục nhiều giờ khiến cổ, vai và lưng mỏi, đồng thời làm chậm trao đổi chất. Hãy đặt nhắc mỗi giờ để đứng dậy, đi lại và vươn vai vài phút. Những lần vận động ngắn này cộng dồn lại cũng tạo ra khác biệt rõ rệt trong ngày.',
   'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&q=80', NULL,
   4, 'beginner'::public.post_level, NULL, now() - interval '10 days'),
  ('general',
   'Bắt đầu thói quen khỏe mạnh từ những thay đổi nhỏ',
   'Không cần thay đổi mọi thứ cùng lúc: chọn một thói quen nhỏ, duy trì đều rồi mới thêm thói quen tiếp theo.',
   'Nhiều người bỏ cuộc vì đặt mục tiêu quá lớn ngay từ đầu, như tập mỗi ngày hay cắt hẳn đồ ngọt. Cách bền hơn là chọn một thay đổi nhỏ — đi bộ thêm 10 phút, uống đủ nước, hoặc đi ngủ sớm hơn 30 phút — và duy trì đều trong vài tuần. Khi thói quen đầu tiên đã thành nếp, bạn mới thêm thói quen tiếp theo.',
   'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80', NULL,
   4, 'beginner'::public.post_level, NULL, now() - interval '2 days'),
  ('workout',
   'Bài tập giãn cơ 10 phút buổi sáng',
   'Giãn cơ nhẹ nhàng trước khi bắt đầu ngày mới.',
   'Chuỗi động tác giãn cơ nhẹ nhàng giúp cổ, vai, lưng và chân thả lỏng sau một đêm ngủ. Tập chậm theo nhịp thở, giữ mỗi tư thế vài nhịp rồi mới chuyển sang động tác tiếp theo.',
   'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80', NULL,
   10, 'beginner'::public.post_level, 40, now() - interval '9 days'),
  ('workout',
   'Đi bộ nhanh 20 phút cho người mới bắt đầu',
   'Khởi động, đi bộ nhanh, thả lỏng.',
   'Bài tập gồm khởi động nhẹ, đi bộ nhanh 20 phút rồi thả lỏng, phù hợp với người mới bắt đầu vận động. Giữ nhịp thở đều, vung tay tự nhiên và dừng lại nếu thấy chóng mặt hoặc khó thở.',
   'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=800&q=80', NULL,
   20, 'beginner'::public.post_level, 110, now() - interval '8 days'),
  ('workout',
   'Yoga nhẹ nhàng trước khi ngủ',
   'Thư giãn nhẹ, thở chậm trước giờ ngủ.',
   'Chuỗi yoga nhẹ với các tư thế thư giãn và thở chậm giúp cơ thể thả lỏng trước giờ ngủ. Tập trên thảm, mặc đồ thoải mái và không ăn no ngay trước khi tập.',
   'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80', NULL,
   15, 'beginner'::public.post_level, 60, now() - interval '7 days')
) AS v(topic, title, summary, body, cover_url, video_url, duration_min, level, kcal_estimate, published_at)
WHERE NOT EXISTS (
  SELECT 1 FROM public.posts p WHERE p.title = v.title
);

-- Bước tập cho 3 bài workout gốc còn lại (giữ nguyên 9 bước trong file gốc,
-- chỉ đổi điều kiện join sang topic = 'workout').
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
WHERE p.topic = 'workout'
ON CONFLICT (post_id, step_order) DO UPDATE SET
  title = EXCLUDED.title,
  instruction = EXCLUDED.instruction,
  duration_sec = EXCLUDED.duration_sec,
  start_at_sec = EXCLUDED.start_at_sec;

-- (V5) Kcal ước tính cho 3 bài tập gốc (40/110/60) đã nằm trong INSERT posts ở trên — không UPDATE sau seed nữa.

-- =====================================================================

-- =====================================================================
-- PHẦN B — CHIA SẺ GIA ĐÌNH (migration 31/10/2026)
-- =====================================================================

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

-- 1) Cột ảnh đại diện avatar_url đã nằm trong CREATE TABLE profiles ở Phần A — không ALTER nữa.

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




alter table public.sharing_settings
  add column if not exists share_kcal boolean not null default true,
  add column if not exists share_cycle boolean not null default true;

-- Kcal hom nay: doc meals cua nguoi duoc chia se.
create policy meals_read_shared on public.meals for select to authenticated
  using (exists (
    select 1 from public.family_links fl
    where fl.owner_id = meals.user_id
      and fl.viewer_id = (select auth.uid())
  ));

-- Chi tiet mon trong bua (de cong kcal): doc qua bang meals.
create policy meal_items_read_shared on public.meal_items for select to authenticated
  using (exists (
    select 1 from public.meals m
    join public.family_links fl on fl.owner_id = m.user_id
    where m.id = meal_items.meal_id
      and fl.viewer_id = (select auth.uid())
  ));

-- So ngay toi ky kinh tiep theo: doc cycles cua nguoi duoc chia se.
create policy cycles_read_shared on public.cycles for select to authenticated
  using (exists (
    select 1 from public.family_links fl
    where fl.owner_id = cycles.user_id
      and fl.viewer_id = (select auth.uid())
  ));



UPDATE public.posts
SET video_url = 'https://tzubghomkogmendtxgfk.supabase.co/storage/v1/object/public/workout-videos/giancobuoisang-10phut.mp4',
    body = 'Video 10 phút giãn cơ buổi sáng của Coach Sky: các động tác giãn cơ nhẹ nhàng giúp giảm stress, làm được vào buổi sáng hoặc sau khi tập xong.',
    kcal_estimate = 25
WHERE title = 'Bài tập giãn cơ 10 phút buổi sáng';



INSERT INTO public.workout_steps (post_id, step_order, title, instruction, duration_sec, start_at_sec)
SELECT p.id, v.step_order, v.title, v.instruction, v.duration_sec, v.start_at_sec
FROM public.posts p
JOIN (VALUES
  ('Bài tập giãn cơ 10 phút buổi sáng', 1, 'Hít thở thiền định', 'Ngồi thẳng lưng, hít sâu bằng mũi rồi thở chậm bằng miệng.', 45, 22),
  ('Bài tập giãn cơ 10 phút buổi sáng', 2, 'Giãn vùng cơ lưng xô cổ', 'Kéo giãn lưng xô và cổ, giữ vai thả lỏng.', 73, 68),
  ('Bài tập giãn cơ 10 phút buổi sáng', 3, 'Giãn vùng cơ xung quanh cổ', 'Xoay cổ chậm rãi, nghiêng đầu sang hai bên.', 62, 142),
  ('Bài tập giãn cơ 10 phút buổi sáng', 4, 'Giãn vùng cơ cổ tay', 'Xoay cổ tay, duỗi và gập bàn tay nhẹ nhàng.', 55, 205),
  ('Bài tập giãn cơ 10 phút buổi sáng', 5, 'Giãn vùng cơ lưng xô và hông', 'Vươn tay nghiêng người, mở rộng lưng xô và hông.', 62, 261),
  ('Bài tập giãn cơ 10 phút buổi sáng', 6, 'Giãn vùng cơ mông đùi', 'Gập người kéo giãn mông và đùi sau, giữ lưng thẳng.', 170, 324),
  ('Bài tập giãn cơ 10 phút buổi sáng', 7, 'Giãn vùng cơ vai tay và lưng xô', 'Xoay vai, vươn tay qua đầu, giãn vai và lưng xô.', 76, 495)
) AS v(post_title, step_order, title, instruction, duration_sec, start_at_sec)
  ON p.title = v.post_title
WHERE p.topic = 'workout'
ON CONFLICT (post_id, step_order) DO UPDATE SET
  title = EXCLUDED.title,
  instruction = EXCLUDED.instruction,
  duration_sec = EXCLUDED.duration_sec,
  start_at_sec = EXCLUDED.start_at_sec;

-- Kiểm tra (phải ra đúng 7 dòng, tổng duration_sec = 543 giây = 9:03;
-- 22 giây đầu và ~37 giây cuối video là mở đầu / kết thúc, không phải động tác):
SELECT step_order, title, duration_sec, start_at_sec
FROM public.workout_steps
WHERE post_id = (SELECT id FROM public.posts WHERE title = 'Bài tập giãn cơ 10 phút buổi sáng')
ORDER BY step_order;
