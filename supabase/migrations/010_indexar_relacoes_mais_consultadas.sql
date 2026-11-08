-- Migração aplicada ao projeto existente.
create index if not exists appointments_contract_id_idx on public.appointments(contract_id);
create index if not exists appointments_created_by_idx on public.appointments(created_by);
create index if not exists appointments_patient_id_idx on public.appointments(patient_id);
create index if not exists appointments_service_id_idx on public.appointments(service_id);
create index if not exists contracts_created_by_idx on public.contracts(created_by);
create index if not exists contracts_service_id_idx on public.contracts(service_id);
create index if not exists expenses_created_by_idx on public.expenses(created_by);
create index if not exists expenses_parent_expense_id_idx on public.expenses(parent_expense_id);
create index if not exists payouts_created_by_idx on public.payouts(created_by);
create index if not exists receipts_created_by_idx on public.receipts(created_by);
create index if not exists receivables_contract_id_idx on public.receivables(contract_id);
create index if not exists receivables_created_by_idx on public.receivables(created_by);
create index if not exists services_created_by_idx on public.services(created_by);
