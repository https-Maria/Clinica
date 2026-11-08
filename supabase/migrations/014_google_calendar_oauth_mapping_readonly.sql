-- Esta migração já foi aplicada em 08/11/2026 no projeto clinica-anacris.
-- Reexecutar apenas em um projeto novo, após migrações anteriores.
alter table public.appointments
  add column google_title text,
  add column google_last_seen_at timestamptz;
alter table public.appointments
  add constraint google_identity_pair check(
    (google_event_id is null and google_calendar_id is null) or
    (google_event_id is not null and google_calendar_id is not null)
  );
create table public.calendar_links (
  google_calendar_id text primary key check(length(btrim(google_calendar_id)) between 3 and 500),
  display_name text not null check(length(btrim(display_name)) between 2 and 255),
  professional_id uuid not null references public.professionals(id),
  service_id uuid references public.services(id),
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index calendar_links_professional_idx on public.calendar_links(professional_id);
create index calendar_links_service_idx on public.calendar_links(service_id);
create index calendar_links_created_by_idx on public.calendar_links(created_by);
create trigger calendar_links_metadata before insert or update on public.calendar_links
 for each row execute function public.set_row_metadata();
alter table public.calendar_links enable row level security;
revoke all on public.calendar_links from anon, authenticated;
grant select, insert, update on public.calendar_links to authenticated;
create policy calendar_links_member_select on public.calendar_links
for select to authenticated using(exists(
  select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active
));
create policy calendar_links_admin_insert on public.calendar_links
for insert to authenticated with check(exists(
  select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active and m.role='admin'
));
create policy calendar_links_admin_update on public.calendar_links
for update to authenticated using(exists(
  select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active and m.role='admin'
))
with check(exists(
  select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active and m.role='admin'
));
create table public.google_calendar_settings (
 id smallint primary key default 1 check(id=1),
 oauth_client_id text not null
 check(oauth_client_id ~ '^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$'),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index google_calendar_settings_created_by_idx on public.google_calendar_settings(created_by);
create trigger google_calendar_settings_metadata before insert or update on public.google_calendar_settings
 for each row execute function public.set_row_metadata();
alter table public.google_calendar_settings enable row level security;
revoke all on public.google_calendar_settings from anon, authenticated;
grant select, insert, update on public.google_calendar_settings to authenticated;
create policy calendar_settings_member_select on public.google_calendar_settings
for select to authenticated using(exists(
  select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active
));
create policy calendar_settings_admin_insert on public.google_calendar_settings
for insert to authenticated with check(exists(
  select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active and m.role='admin'
));
create policy calendar_settings_admin_update on public.google_calendar_settings
for update to authenticated using(exists(
  select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active and m.role='admin'
))
with check(exists(
  select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active and m.role='admin'
));
