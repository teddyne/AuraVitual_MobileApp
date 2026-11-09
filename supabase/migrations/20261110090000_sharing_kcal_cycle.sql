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
