-- Migração aplicada ao banco, não executar duas vezes.

do $$
declare def text;
begin
 select pg_get_functiondef('public.generate_contract_receivable(uuid,date,uuid)'::regprocedure) into def;
 if position('on conflict(origin_key) do nothing' in lower(def))=0 then
   raise exception 'Função de cobrança fora da versão esperada';
 end if;
 execute replace(def,'on conflict(origin_key) do nothing','on conflict do nothing');
 select pg_get_functiondef('public.generate_recurring_expense(uuid,date)'::regprocedure) into def;
 if position('on conflict(generation_key) do nothing' in lower(def))=0 then
   raise exception 'Função de despesas fora da versão esperada';
 end if;
 execute replace(def,'on conflict(generation_key) do nothing','on conflict do nothing');
end;
$$;
create or replace function public.protect_generated_invoice() returns trigger
language plpgsql set search_path = '' as $$
begin
 if old.origin_key is not null and
  (new.amount is distinct from old.amount or
   new.patient_id is distinct from old.patient_id or
   new.contract_id is distinct from old.contract_id or
   new.origin_key is distinct from old.origin_key)
  then raise exception 'Cobrança gerada automaticamente: valor e vínculos não são editáveis';
 end if;
 return new;
end;
$$;
create trigger receivables_generated_lock before update on public.receivables
for each row execute function public.protect_generated_invoice();
