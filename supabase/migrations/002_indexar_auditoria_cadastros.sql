-- Histórico: já aplicada ao Supabase em 08/11/2026.
create index patients_created_by_idx on public.patients(created_by);
create index professionals_created_by_idx on public.professionals(created_by);
