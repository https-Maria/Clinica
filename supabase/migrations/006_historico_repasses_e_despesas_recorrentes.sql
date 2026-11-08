-- Aplicada ao projeto Supabase. Não executar de novo no mesmo banco.

-- Percentual histórico congelado no recebimento.
alter table public.receipts add column share_pct_snapshot numeric(5,2) check(share_pct_snapshot between 0 and 100);
create or replace function public.capture_receipt_share() returns trigger
language plpgsql set search_path='' as $$
declare share numeric(5,2);
begin
 if new.receivable_id is null then raise exception 'Cobrança necessária'; end if;
 select coalesce(c.share_pct,p.default_share_pct,40)
   into share
 from public.receivables r
 left join public.contracts c on c.id=r.contract_id
 left join public.professionals p on p.id=c.professional_id
 where r.id=new.receivable_id;
 new.share_pct_snapshot=case when share is null then null else share end;
 return new;
end;
$$;
create trigger receipts_share_snapshot before insert on public.receipts
 for each row execute function public.capture_receipt_share();
-- Uma cobrança já emitida impede mudar condições financeiras do contrato retroativamente.
create or replace function public.prevent_contract_repricing() returns trigger
language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.receivables r where r.contract_id=old.id)
   and (
      new.patient_id is distinct from old.patient_id or
      new.professional_id is distinct from old.professional_id or
      new.amount is distinct from old.amount or
      new.billing_model is distinct from old.billing_model or
      new.share_pct is distinct from old.share_pct or
      new.starts_on is distinct from old.starts_on or
      new.ends_on is distinct from old.ends_on
   ) then
   raise exception 'Contrato com cobranças: crie novo contrato para alterar condições financeiras';
 end if;
 return new;
end;
$$;
create trigger contracts_no_repricing before update on public.contracts
for each row execute function public.prevent_contract_repricing();

-- Despesa recorrente gerada sob demanda, com chave que evita repetir mês/ano.
alter table public.expenses add column parent_expense_id uuid references public.expenses(id);
alter table public.expenses add column generation_key text;
create unique index expenses_generation_key_uq on public.expenses(generation_key) where generation_key is not null;

create or replace function public.generate_recurring_expense(p_expense_id uuid,p_next_date date)
returns uuid language plpgsql security invoker set search_path='' as $$
declare e public.expenses%rowtype;
declare target_date date;
declare v_key text;
declare v_id uuid;
declare month_last int;
begin
 if not exists(select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active) then
   raise exception 'Acesso não autorizado';
 end if;
 select * into e from public.expenses where id=p_expense_id and active;
 if not found then raise exception 'Despesa original inexistente ou inativa'; end if;
 if e.recurrence not in ('mensal','anual') then raise exception 'Esta despesa não é recorrente'; end if;
 if p_next_date is null then raise exception 'Selecione o mês/ano'; end if;
 if e.recurrence='mensal' then
  month_last=extract(day from (date_trunc('month',p_next_date)+interval '1 month - 1 day'))::int;
  target_date=make_date(extract(year from p_next_date)::int,extract(month from p_next_date)::int,least(extract(day from e.due_on)::int,month_last));
  v_key='monthly:'||coalesce(e.parent_expense_id,e.id)||':'||to_char(target_date,'YYYY-MM');
 else
  month_last=extract(day from (make_date(extract(year from p_next_date)::int,extract(month from e.due_on)::int,1)+interval '1 month - 1 day'))::int;
  target_date=make_date(extract(year from p_next_date)::int,extract(month from e.due_on)::int,least(extract(day from e.due_on)::int,month_last));
  v_key='annual:'||coalesce(e.parent_expense_id,e.id)||':'||to_char(target_date,'YYYY');
 end if;
 if target_date <= e.due_on then raise exception 'A próxima competência deve ser posterior ao vencimento original'; end if;
 insert into public.expenses(description,category,amount,due_on,paid_on,recurrence,notes,parent_expense_id,generation_key)
 values(e.description,e.category,e.amount,target_date,null,e.recurrence,e.notes,coalesce(e.parent_expense_id,e.id),v_key)
 on conflict(generation_key) do nothing returning id into v_id;
 if v_id is null then select id into v_id from public.expenses where generation_key=v_key; end if;
 return v_id;
end;
$$;
revoke all on function public.generate_recurring_expense(uuid,date) from public,anon;
grant execute on function public.generate_recurring_expense(uuid,date) to authenticated;
