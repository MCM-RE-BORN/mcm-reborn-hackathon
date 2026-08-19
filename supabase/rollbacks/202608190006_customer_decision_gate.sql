-- Only use this rollback together with the application release rollback.
-- It reopens the operator bypass that allowed PRODUCTION_READY before the
-- customer approved changed inspection terms.

begin;

do $rollback$
declare
  transition_function regprocedure := to_regprocedure(
    'public.enforce_application_transition()'
  );
  lifecycle_function regprocedure := to_regprocedure(
    'public.advance_application_lifecycle(uuid,public.application_status,text,text,text,text)'
  );
  transition_definition text;
  lifecycle_definition text;
  transition_guard text := $$  if old.persisted_status = 'CHANGE_APPROVAL_REQUIRED'
     and new.persisted_status = 'PRODUCTION_READY'
     and not exists (
       select 1
       from public.application_change_requests acr
       where acr.application_id = new.id
         and acr.status = 'APPROVED'
     ) then
    raise exception 'PRODUCTION_READY requires customer approval of changed terms'
      using errcode = '23514';
  end if;

$$;
  lifecycle_guard text := $$  if current_status = 'CHANGE_APPROVAL_REQUIRED'
     and p_target_status = 'PRODUCTION_READY'
     and not exists (
       select 1
       from public.application_change_requests acr
       where acr.application_id = p_application_id
         and acr.status = 'APPROVED'
     ) then
    raise exception 'PRODUCTION_READY requires customer approval of changed terms'
      using errcode = '23514';
  end if;

$$;
begin
  if transition_function is null or lifecycle_function is null then
    raise exception 'v2 lifecycle functions required by customer decision rollback are missing';
  end if;

  select pg_get_functiondef(transition_function) into transition_definition;
  if position('production_ready requires customer approval of changed terms' in lower(transition_definition)) > 0 then
    transition_definition := replace(transition_definition, transition_guard, '');
    execute transition_definition;
  end if;

  select pg_get_functiondef(lifecycle_function) into lifecycle_definition;
  if position('production_ready requires customer approval of changed terms' in lower(lifecycle_definition)) > 0 then
    lifecycle_definition := replace(lifecycle_definition, lifecycle_guard, '');
    execute lifecycle_definition;
  end if;
end
$rollback$;

commit;
