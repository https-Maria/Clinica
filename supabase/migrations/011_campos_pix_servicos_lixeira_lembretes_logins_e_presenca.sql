-- Fonte de verdade: Supabase migration "campos_pix_servicos_lixeira_lembretes_logins_e_presenca".
-- Já executada no projeto clinica-anacris; não execute novamente no mesmo banco.


-- Dados adicionais; preserva a base existente sem sobrescrever cadastros.
alter table public.professionals
  add column pix_key_type text check(pix_key_type in ('cpf','cnpj','celular','email','aleatoria')),
  add constraint professional_pix_type_pair check(
    (nullif(btrim(coalesce(pix_key,'')),'') is null and pix_key_type is null) or
    (nullif(btrim(coalesce(pix_key,'')),'') is not null and pix_key_type is not null)
  );

alter table public.services
  add column description text,
  add column specialty text not null default 'Fisioterapia'
    check(specialty in ('Fisioterapia','Pilates','Nutrição','Outro')),
  add column duration_minutes integer check(duration_minutes between 5 and 480),
  add column delivery_mode text not null default 'clinica'
    check(delivery_mode in ('clinica','domicilio','online','misto')),
  add column reference_price numeric(12,2) check(reference_price >= 0),
  add column notes text;

alter table public.expenses
  add column expense_type text not null default 'variavel'
  check(expense_type in ('fixa','variavel','sazonal'));

alter table public.contracts
  add constraint custom_term_requires_end_date
  check(term <> 'personalizado' or ends_on is not null);

alter table public.patients
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users(id);
create index patients_deleted_at_idx on public.patients(deleted_at);
create index patients_deleted_by_idx on public.patients(deleted_by);

create or replace function public.protect_patient_deletion()
returns trigger language plpgsql set search_path = '' as $$
declare permitted boolean;
begin
  if new.deleted_at is distinct from old.deleted_at
     or new.deleted_by is distinct from old.deleted_by then
    select exists(
      select 1 from public.clinic_members m
      where m.user_id=(select auth.uid()) and m.active and m.role='admin'
    ) into permitted;
    if not permitted then raise exception 'Só administradores podem excluir ou restaurar pacientes'; end if;
    if new.deleted_at is not null then
      new.deleted_by=(select auth.uid());
      new.active=false;
    else
      new.deleted_by=null;
    end if;
  elsif old.deleted_at is not null and to_jsonb(new) is distinct from to_jsonb(old) then
    -- Ignora os campos de atualização automática, alterados por outro gatilho.
    if (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at') then
      raise exception 'Paciente excluído: restaure antes de editar';
    end if;
  end if;
  return new;
end;
$$;
create trigger patients_deletion_guard before update on public.patients
for each row execute function public.protect_patient_deletion();

-- Lembretes pessoais: cada usuário acessa apenas os próprios registros.
create table public.personal_reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  title text not null check(length(btrim(title)) between 2 and 160),
  body text,
  due_at timestamptz,
  priority text not null default 'normal' check(priority in ('baixa','normal','alta')),
  completed_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reminders_owner_due_idx on public.personal_reminders(owner_id,due_at);
alter table public.personal_reminders enable row level security;
revoke all on public.personal_reminders from anon,authenticated;
grant select,insert,update on public.personal_reminders to authenticated;
create policy reminders_read on public.personal_reminders for select to authenticated
using(owner_id=(select auth.uid()) and exists(
 select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active
));
create policy reminders_insert on public.personal_reminders for insert to authenticated
with check(owner_id=(select auth.uid()) and exists(
 select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active
));
create policy reminders_update on public.personal_reminders for update to authenticated
using(owner_id=(select auth.uid()) and exists(
 select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active
))
with check(owner_id=(select auth.uid()) and exists(
 select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active
));
create function public.protect_reminder_owner() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' then new.owner_id=old.owner_id; new.created_at=old.created_at; end if;
  new.updated_at=now();
  return new;
end; $$;
create trigger reminders_metadata before insert or update on public.personal_reminders
for each row execute function public.protect_reminder_owner();

-- Registro de abertura de sessão no aplicativo: não é uma trilha imutável de Auth.
create table public.app_login_events (
 id bigint generated always as identity primary key,
 user_id uuid not null default auth.uid() references auth.users(id),
 logged_at timestamptz not null default now(),
 event_type text not null default 'login' check(event_type='login')
);
create index app_login_events_user_time_idx on public.app_login_events(user_id,logged_at desc);
alter table public.app_login_events enable row level security;
revoke all on public.app_login_events from anon,authenticated;
grant select,insert on public.app_login_events to authenticated;
create policy logins_admin_read on public.app_login_events for select to authenticated
using(exists(
 select 1 from public.clinic_members m
 where m.user_id=(select auth.uid()) and m.active and m.role='admin'
));
create policy logins_self_insert on public.app_login_events for insert to authenticated
with check(user_id=(select auth.uid()) and exists(
 select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active
));

-- Gerar cobrança por sessão quando comparecimento é confirmado.
create function public.create_receivable_from_attendance() returns trigger
language plpgsql set search_path='' as $$
declare c public.contracts%rowtype;
declare v_date date;
begin
 if new.status<>'realizado' or not new.active or new.contract_id is null then return new; end if;
 select * into c from public.contracts where id=new.contract_id and active;
 if not found or c.billing_model<>'por_sessao' then return new; end if;
 if new.patient_id is distinct from c.patient_id or
    new.professional_id is distinct from c.professional_id then
   raise exception 'Profissional/paciente não corresponde ao contrato';
 end if;
 v_date=(new.starts_at at time zone 'America/Sao_Paulo')::date;
 insert into public.receivables(patient_id,contract_id,description,amount,due_on,origin_key)
 values(c.patient_id,c.id,'Sessão realizada '||to_char(v_date,'DD/MM/YYYY'),
        c.amount,v_date,'session:'||new.id)
 on conflict do nothing;
 return new;
end;
$$;
create trigger attendance_billable_insert after insert on public.appointments
for each row execute function public.create_receivable_from_attendance();
create trigger attendance_billable_update after update of status on public.appointments
for each row execute function public.create_receivable_from_attendance();
create function public.prevent_billed_session_change() returns trigger
language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.receivables r where r.origin_key='session:'||old.id)
 and (new.status is distinct from old.status or new.starts_at is distinct from old.starts_at
 or new.patient_id is distinct from old.patient_id or
 new.professional_id is distinct from old.professional_id or
 new.contract_id is distinct from old.contract_id or new.active is distinct from old.active)
 then raise exception 'Sessão com cobrança: ajuste financeiro deve ser conferido antes de alterar';
 end if;
 return new;
end;
$$;
create trigger appointments_billing_guard before update on public.appointments
for each row execute function public.prevent_billed_session_change();

-- Auditoria também cobre lembretes, sem armazenar o conteúdo.
create trigger reminders_audit after insert or update on public.personal_reminders
for each row execute function clinic_internal.record_audit();

