-- Aplicada no Supabase; não reaplicar no mesmo projeto.
alter table public.patients add column end_reason text check(end_reason in ('alta','interrupcao','outro'));
