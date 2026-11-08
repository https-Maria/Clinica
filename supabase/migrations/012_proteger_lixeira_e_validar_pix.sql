-- Registrada no histórico de migrações do Supabase.

-- Pacientes excluídos permanecem consultáveis somente para a administração.
drop policy patients_member_select on public.patients;
create policy patients_member_select on public.patients for select to authenticated
using(exists(
  select 1 from public.clinic_members m where m.user_id=(select auth.uid())
  and m.active and (deleted_at is null or m.role='admin')
));
drop policy patients_member_update on public.patients;
create policy patients_member_update on public.patients for update to authenticated
using(exists(
  select 1 from public.clinic_members m where m.user_id=(select auth.uid())
  and m.active and (deleted_at is null or m.role='admin')
))
with check(exists(
  select 1 from public.clinic_members m where m.user_id=(select auth.uid()) and m.active
  and (deleted_at is null or m.role='admin')
));
alter table public.professionals add constraint professional_pix_key_format check(
 pix_key is null or pix_key_type is null or
 (pix_key_type='cpf' and pix_key ~ '^[0-9]{11}$') or
 (pix_key_type='cnpj' and pix_key ~ '^[0-9]{14}$') or
 (pix_key_type='celular' and pix_key ~ '^\+55[0-9]{11}$') or
 (pix_key_type='email' and pix_key ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') or
 (pix_key_type='aleatoria' and pix_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
);
