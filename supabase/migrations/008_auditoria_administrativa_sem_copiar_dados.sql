-- Já executada no Supabase. Não repetir na mesma instância.

create table public.audit_events (
 id bigint generated always as identity primary key,
 table_name text not null,
 record_id uuid not null,
 operation text not null check(operation in ('INSERT','UPDATE')),
 changed_columns text[] not null default array[]::text[],
 actor_id uuid,
 happened_at timestamptz not null default now()
);
create index audit_events_record_idx on public.audit_events(table_name,record_id,happened_at desc);
create index audit_events_time_idx on public.audit_events(happened_at desc);
alter table public.audit_events enable row level security;
revoke all on public.audit_events from anon,authenticated;
grant select on public.audit_events to authenticated;
create policy audit_admin_read on public.audit_events for select to authenticated
 using(exists(select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active and m.role='admin'));
create schema if not exists clinic_internal;
revoke all on schema clinic_internal from public,anon,authenticated;
create function clinic_internal.record_audit() returns trigger
language plpgsql security definer set search_path='' as $$
declare ids uuid;
declare changed text[];
begin
 if TG_TABLE_SCHEMA<>'public' or TG_OP not in ('INSERT','UPDATE') then
  raise exception 'Auditoria disponível apenas para tabelas administrativas';
 end if;
 ids=NEW.id;
 if TG_OP='INSERT' then
  select coalesce(array_agg(key),array[]::text[]) into changed
  from jsonb_each(to_jsonb(NEW)) where key not in ('created_at','updated_at','created_by');
 else
  select coalesce(array_agg(n.key),array[]::text[]) into changed
  from jsonb_each(to_jsonb(NEW)) n
  where n.value is distinct from to_jsonb(OLD)->n.key
   and n.key not in ('updated_at');
  if cardinality(changed)=0 then return NEW; end if;
 end if;
 insert into public.audit_events(table_name,record_id,operation,changed_columns,actor_id)
 values(TG_TABLE_NAME,ids,TG_OP,changed,(select auth.uid()));
 return NEW;
end;
$$;
revoke all on function clinic_internal.record_audit() from public,anon,authenticated;
do $$
declare name text;
begin
 foreach name in array array['patients','professionals','services','contracts','appointments','receivables','receipts','receipt_reversals','expenses','payouts'] loop
  execute format('create trigger %I after insert or update on public.%I for each row execute function clinic_internal.record_audit()',name||'_audit',name);
 end loop;
end;
$$;
