-- Já aplicada no banco: integridade_relacoes_e_repasses (08/11/2026).
-- Esta é uma cópia histórica; não reaplicar na mesma instância.
create function public.validate_appointment_contract() returns trigger language plpgsql set search_path = '' as $$
declare linked_patient uuid;
declare linked_professional uuid;
begin
 if new.contract_id is not null then
  select c.patient_id,c.professional_id into linked_patient,linked_professional
  from public.contracts c where c.id=new.contract_id and c.active;
  if linked_patient is null then raise exception 'Contrato não encontrado ou inativo'; end if;
  if new.patient_id is null then new.patient_id=linked_patient; end if;
  if new.patient_id <> linked_patient or new.professional_id <> linked_professional then
   raise exception 'Paciente e profissional devem corresponder ao contrato';
  end if;
 end if;
 return new;
end;
$$;
create trigger appointments_contract_guard before insert or update on public.appointments
for each row execute function public.validate_appointment_contract();
create function public.validate_receivable_contract() returns trigger language plpgsql set search_path = '' as $$
declare owner_id uuid;
begin
 if new.contract_id is not null then
  select c.patient_id into owner_id from public.contracts c where c.id=new.contract_id and c.active;
  if owner_id is null or owner_id <> new.patient_id then
   raise exception 'Paciente da cobrança deve ser o mesmo do contrato ativo';
  end if;
 end if;
 return new;
end;
$$;
create trigger receivables_contract_guard before insert or update on public.receivables
for each row execute function public.validate_receivable_contract();
create function public.lock_paid_payout() returns trigger language plpgsql set search_path = '' as $$
begin
 if old.status='pago' then raise exception 'Repasse já pago não pode ser alterado; registrar ajuste separado'; end if;
 return new;
end;
$$;
create trigger payouts_paid_guard before update on public.payouts for each row execute function public.lock_paid_payout();
create unique index appointments_one_start_per_professional on public.appointments(professional_id,starts_at)
 where active and status <> 'cancelado';
