-- Aplicada no Supabase; não reaplicar no mesmo projeto.

alter table public.app_login_events add column email_snapshot text;
create function clinic_internal.stamp_app_login() returns trigger
language plpgsql set search_path='' as $$
begin
  new.user_id=(select auth.uid());
  new.logged_at=now();
  new.event_type='login';
  new.email_snapshot=nullif((select auth.jwt()->>'email'),'');
  return new;
end;
$$;
revoke all on function clinic_internal.stamp_app_login() from public,anon,authenticated;
create trigger app_login_stamp before insert on public.app_login_events
for each row execute function clinic_internal.stamp_app_login();
