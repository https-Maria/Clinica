-- Aplicada no projeto Supabase: operacao_contratos_agenda_financeiro (08/11/2026).
-- Histórico de migração: não executar novamente no mesmo projeto.
create table public.services (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 2 and 100),
 active boolean not null default true,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index services_name_unique on public.services(lower(btrim(name)));
create table public.contracts (
 id uuid primary key default gen_random_uuid(),
 patient_id uuid not null references public.patients(id),
 professional_id uuid not null references public.professionals(id),
 service_id uuid references public.services(id),
 billing_model text not null check(billing_model in ('mensalidade','por_sessao','pacote')),
 term text not null default 'mensal' check(term in ('avulso','mensal','trimestral','semestral','personalizado')),
 amount numeric(12,2) not null check(amount >= 0),
 session_count int check(session_count > 0),
 share_pct numeric(5,2) check(share_pct between 0 and 100),
 starts_on date not null,
 ends_on date,
 due_day int check(due_day between 1 and 31),
 active boolean not null default true,
 notes text,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint contract_dates check(ends_on is null or ends_on >= starts_on)
);
create index contracts_patient_idx on public.contracts(patient_id);
create index contracts_professional_idx on public.contracts(professional_id);
create table public.appointments (
 id uuid primary key default gen_random_uuid(),
 patient_id uuid references public.patients(id),
 professional_id uuid not null references public.professionals(id),
 service_id uuid references public.services(id),
 contract_id uuid references public.contracts(id),
 starts_at timestamptz not null, ends_at timestamptz,
 status text not null default 'agendado' check(status in ('agendado','realizado','falta','cancelado')),
 source text not null default 'manual' check(source in ('manual','google')),
 google_calendar_id text, google_event_id text, notes text, active boolean not null default true,
 created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint appointment_dates check(ends_at is null or ends_at > starts_at)
);
create index appointments_date_idx on public.appointments(starts_at);
create index appointments_professional_idx on public.appointments(professional_id);
create unique index appointments_google_uid on public.appointments(google_calendar_id,google_event_id)
 where google_event_id is not null and google_calendar_id is not null;
create table public.receivables (
 id uuid primary key default gen_random_uuid(),
 patient_id uuid not null references public.patients(id),
 contract_id uuid references public.contracts(id),
 description text not null check(length(btrim(description)) between 2 and 255),
 amount numeric(12,2) not null check(amount > 0),
 due_on date not null, active boolean not null default true, notes text,
 created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index receivables_due_idx on public.receivables(due_on);
create index receivables_patient_idx on public.receivables(patient_id);
create table public.receipts (
 id uuid primary key default gen_random_uuid(),
 receivable_id uuid not null references public.receivables(id),
 amount numeric(12,2) not null check(amount > 0),
 received_on date not null,
 method text not null default 'pix' check(method in ('pix','dinheiro','transferencia','cartao','outro')),
 notes text, created_by uuid references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index receipts_receivable_idx on public.receipts(receivable_id);
create index receipts_received_idx on public.receipts(received_on);
create table public.expenses (
 id uuid primary key default gen_random_uuid(),
 description text not null check(length(btrim(description)) between 2 and 255),
 category text not null default 'Geral',
 amount numeric(12,2) not null check(amount > 0),
 due_on date not null, paid_on date,
 recurrence text not null default 'unica' check(recurrence in ('unica','mensal','anual')),
 active boolean not null default true, notes text,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index expenses_due_idx on public.expenses(due_on);
create table public.payouts (
 id uuid primary key default gen_random_uuid(),
 professional_id uuid not null references public.professionals(id),
 reference_on date not null,
 amount numeric(12,2) not null check(amount > 0),
 status text not null default 'pendente' check(status in ('pendente','pago')),
 paid_on date, notes text, active boolean not null default true,
 created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint payout_paid_date check((status='pago' and paid_on is not null) or (status='pendente' and paid_on is null))
);
create index payouts_professional_idx on public.payouts(professional_id);
create function public.check_receipt_total() returns trigger
language plpgsql set search_path = '' as $$
declare expected numeric(12,2);
declare collected numeric(12,2);
begin
  select r.amount into expected from public.receivables r where r.id = new.receivable_id and r.active for update;
  if expected is null then raise exception 'Cobrança não encontrada ou inativa'; end if;
  select coalesce(sum(amount),0) into collected from public.receipts where receivable_id = new.receivable_id;
  if collected + new.amount > expected then raise exception 'Valor recebido ultrapassa o valor da cobrança'; end if;
  return new;
end;
$$;
create trigger receipts_total_guard before insert on public.receipts for each row execute function public.check_receipt_total();
create function public.prevent_underpaid_invoice() returns trigger
language plpgsql set search_path = '' as $$
declare collected numeric(12,2);
begin
 select coalesce(sum(amount),0) into collected from public.receipts where receivable_id = old.id;
 if new.amount < collected then raise exception 'Valor da cobrança menor que o total recebido'; end if;
 if collected > 0 and (new.patient_id is distinct from old.patient_id or new.contract_id is distinct from old.contract_id or not new.active) then
  raise exception 'Cobrança com recebimentos não pode mudar paciente/contrato ou ser inativada';
 end if;
 return new;
end;
$$;
create trigger receivable_paid_guard before update on public.receivables for each row execute function public.prevent_underpaid_invoice();
create function public.receipt_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
 raise exception 'Recebimentos são imutáveis; correções exigem procedimento de estorno auditado';
end;
$$;
create trigger receipts_no_update before update or delete on public.receipts for each row execute function public.receipt_immutable();
do $$
declare tab text;
begin
 foreach tab in array array['services','contracts','appointments','receivables','receipts','expenses','payouts'] loop
  execute format('create trigger %I before insert or update on public.%I for each row execute function public.set_row_metadata()',tab||'_metadata',tab);
  execute format('alter table public.%I enable row level security',tab);
  execute format('create policy %I on public.%I for select to authenticated using (exists (select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active))',tab||'_read',tab);
  execute format('create policy %I on public.%I for insert to authenticated with check (exists (select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active))',tab||'_insert',tab);
  if tab <> 'receipts' then
   execute format('create policy %I on public.%I for update to authenticated using (exists (select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active)) with check (exists (select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active))',tab||'_update',tab);
  end if;
  execute format('revoke all on public.%I from anon, authenticated',tab);
  if tab = 'receipts' then
    execute format('grant select, insert on public.%I to authenticated',tab);
  else
    execute format('grant select, insert, update on public.%I to authenticated',tab);
  end if;
 end loop;
end;
$$;
