-- Histórico: migration 001 aplicada ao projeto clinica-anacris em 08/11/2026.
-- NÃO executar novamente no mesmo banco.
create extension if not exists pgcrypto;
create table public.clinic_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'staff' check(role in ('admin','staff')),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.patients (
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(btrim(name)) between 2 and 200),
 birth_date date, phone text, guardian_name text, guardian_phone text,
 email text, address text, start_date date, end_date date,
 notes text, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id),
 constraint patients_date_range check(end_date is null or start_date is null or end_date >= start_date)
);
create index patients_name_idx on public.patients(name);
create table public.professionals (
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(btrim(name)) between 2 and 200),
 phone text, email text, council_type text, council_number text, council_state text,
 specialty text, pix_key text,
 default_share_pct numeric(5,2) not null default 40 check(default_share_pct between 0 and 100),
 notes text, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id)
);
create index professionals_name_idx on public.professionals(name);
create function public.set_row_metadata() returns trigger language plpgsql set search_path = '' as $$
begin
 if TG_OP = 'INSERT' then
  new.created_by := (select auth.uid());
  new.created_at := now();
 else
  new.created_by := old.created_by;
  new.created_at := old.created_at;
 end if;
 new.updated_at := now();
 return new;
end;
$$;
create trigger patients_metadata before insert or update on public.patients for each row execute function public.set_row_metadata();
create trigger professionals_metadata before insert or update on public.professionals for each row execute function public.set_row_metadata();

alter table public.clinic_members enable row level security;
alter table public.patients enable row level security;
alter table public.professionals enable row level security;
create policy members_self_read on public.clinic_members
 for select to authenticated using(user_id=(select auth.uid()));
create policy patients_member_select on public.patients
 for select to authenticated using(exists(select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active));
create policy patients_member_insert on public.patients
 for insert to authenticated with check(exists(select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active));
create policy patients_member_update on public.patients
 for update to authenticated
 using(exists(select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active))
 with check(exists(select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active));
create policy professionals_member_select on public.professionals
 for select to authenticated using(exists(select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active));
create policy professionals_member_insert on public.professionals
 for insert to authenticated with check(exists(select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active));
create policy professionals_member_update on public.professionals
 for update to authenticated
 using(exists(select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active))
 with check(exists(select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active));
revoke all on public.clinic_members,public.patients,public.professionals from anon,authenticated;
grant select on public.clinic_members to authenticated;
grant select,insert,update on public.patients,public.professionals to authenticated;
