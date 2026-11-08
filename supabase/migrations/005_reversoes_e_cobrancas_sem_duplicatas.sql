-- Migração aplicada ao projeto Supabase em 08/11/2026. Reproduzir somente em banco novo.

-- Reversões imutáveis em vez de apagar recebimentos.
create table public.receipt_reversals (
 id uuid primary key default gen_random_uuid(),
 receipt_id uuid not null unique references public.receipts(id),
 reason text not null check(length(btrim(reason)) between 5 and 500),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now()
);
create index receipt_reversals_created_by_idx on public.receipt_reversals(created_by);
alter table public.receipt_reversals enable row level security;
revoke all on public.receipt_reversals from anon,authenticated;
grant select,insert on public.receipt_reversals to authenticated;
create policy receipt_reversals_read on public.receipt_reversals
 for select to authenticated using(exists(select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active));
create policy receipt_reversals_admin_insert on public.receipt_reversals
 for insert to authenticated with check (
   created_by=(select auth.uid()) and
   exists(select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active and m.role='admin')
 );
-- O recebimento original permanece inalterado.
create or replace function public.check_receipt_total() returns trigger
language plpgsql set search_path = '' as $$
declare expected numeric(12,2);
declare collected numeric(12,2);
begin
  select r.amount into expected from public.receivables r
   where r.id=new.receivable_id and r.active for update;
  if expected is null then raise exception 'Cobrança não encontrada ou inativa'; end if;
  select coalesce(sum(p.amount),0) into collected from public.receipts p
   where p.receivable_id=new.receivable_id and not exists (
    select 1 from public.receipt_reversals x where x.receipt_id=p.id
   );
  if collected+new.amount>expected then
   raise exception 'Recebimentos efetivos ultrapassam o valor da cobrança';
  end if;
  return new;
end;
$$;
create or replace function public.prevent_underpaid_invoice() returns trigger
language plpgsql set search_path = '' as $$
declare collected numeric(12,2);
begin
  select coalesce(sum(p.amount),0) into collected from public.receipts p
  where p.receivable_id=old.id and not exists (
    select 1 from public.receipt_reversals x where x.receipt_id=p.id
  );
  if new.amount<collected then raise exception 'Valor menor que os recebimentos válidos'; end if;
  if collected>0 and (new.patient_id is distinct from old.patient_id or
   new.contract_id is distinct from old.contract_id or not new.active) then
   raise exception 'Cobrança com recebimentos não pode mudar vínculo ou ser inativada';
  end if;
  return new;
end;
$$;
-- Só administrador pode marcar pagamentos a profissionais.
drop policy payouts_insert on public.payouts;
drop policy payouts_update on public.payouts;
create policy payouts_admin_insert on public.payouts for insert to authenticated
 with check(exists(select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active and m.role='admin'));
create policy payouts_admin_update on public.payouts for update to authenticated
 using(exists(select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active and m.role='admin'))
 with check(exists(select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active and m.role='admin'));
-- Associar a cobrança a origem única, sem refazer histórico quando botão for clicado duas vezes.
alter table public.receivables add column origin_key text;
create unique index receivables_origin_key_uq on public.receivables(origin_key) where origin_key is not null;
create or replace function public.generate_contract_receivable(
  p_contract_id uuid,
  p_period date default current_date,
  p_appointment_id uuid default null
) returns uuid language plpgsql security invoker set search_path='' as $$
declare c public.contracts%rowtype;
declare ap public.appointments%rowtype;
declare v_date date;
declare v_due date;
declare v_key text;
declare v_desc text;
declare v_id uuid;
declare v_end date;
begin
 if not exists(select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active) then
  raise exception 'Acesso não autorizado';
 end if;
 select * into c from public.contracts where id=p_contract_id and active;
 if not found then raise exception 'Contrato inexistente ou inativo'; end if;
 if p_period is null then raise exception 'Período obrigatório'; end if;
 if c.billing_model='por_sessao' then
  if p_appointment_id is null then raise exception 'Selecione a sessão realizada'; end if;
  select * into ap from public.appointments where id=p_appointment_id and
   contract_id=c.id and patient_id=c.patient_id and professional_id=c.professional_id
   and status='realizado' and active;
  if not found then raise exception 'Sessão não realizada ou não vinculada ao contrato'; end if;
  v_date=(ap.starts_at at time zone 'America/Sao_Paulo')::date;
  v_due=v_date;
  v_key='session:'||ap.id;
  v_desc='Sessão de '||to_char(v_date,'DD/MM/YYYY');
 elsif c.billing_model='pacote' then
  v_date=c.starts_on;
  v_due=c.starts_on;
  v_key='package:'||c.id;
  v_desc='Pacote contratado em '||to_char(c.starts_on,'MM/YYYY');
 else
  v_date=date_trunc('month',p_period)::date;
  v_end=(date_trunc('month',p_period)+interval '1 month - 1 day')::date;
  if v_end<c.starts_on or (c.ends_on is not null and v_date>c.ends_on) then
    raise exception 'Período fora da vigência contratual';
  end if;
  v_due=make_date(extract(year from v_date)::int,extract(month from v_date)::int,
    least(coalesce(c.due_day,10),extract(day from v_end)::int));
  v_key='monthly:'||c.id||':'||to_char(v_date,'YYYY-MM');
  v_desc='Mensalidade de '||to_char(v_date,'MM/YYYY');
 end if;
 insert into public.receivables(patient_id,contract_id,description,amount,due_on,origin_key)
 values(c.patient_id,c.id,v_desc,c.amount,v_due,v_key)
 on conflict(origin_key) do nothing
 returning id into v_id;
 if v_id is null then
   select id into v_id from public.receivables where origin_key=v_key;
 end if;
 return v_id;
end;
$$;
revoke all on function public.generate_contract_receivable(uuid,date,uuid) from public,anon;
grant execute on function public.generate_contract_receivable(uuid,date,uuid) to authenticated;
