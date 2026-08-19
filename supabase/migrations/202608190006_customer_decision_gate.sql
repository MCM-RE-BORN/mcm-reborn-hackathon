-- Prevent an operator lifecycle command from bypassing the customer's decision
-- after a physical inspection produced changed terms.

begin;

do $migration$
declare
  transition_function regprocedure := to_regprocedure(
    'public.enforce_application_transition()'
  );
  lifecycle_function regprocedure := to_regprocedure(
    'public.advance_application_lifecycle(uuid,public.application_status,text,text,text,text)'
  );
  transition_definition text;
  lifecycle_definition text;
  transition_marker text := $$  if new.persisted_status = 'IN_PRODUCTION' then$$;
  lifecycle_marker text := $$  if p_target_status = 'PRODUCTION_UNAVAILABLE'$$;
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
    raise exception 'v2 lifecycle functions required by customer decision gate are missing';
  end if;

  select pg_get_functiondef(transition_function) into transition_definition;
  if position('production_ready requires customer approval of changed terms' in lower(transition_definition)) = 0 then
    if position(transition_marker in transition_definition) = 0 then
      raise exception 'enforce_application_transition has an unknown v2 shape';
    end if;
    transition_definition := replace(
      transition_definition,
      transition_marker,
      transition_guard || transition_marker
    );
    execute transition_definition;
  end if;

  select pg_get_functiondef(lifecycle_function) into lifecycle_definition;
  if position('production_ready requires customer approval of changed terms' in lower(lifecycle_definition)) = 0 then
    if position(lifecycle_marker in lifecycle_definition) = 0 then
      raise exception 'advance_application_lifecycle has an unknown v2 shape';
    end if;
    lifecycle_definition := replace(
      lifecycle_definition,
      lifecycle_marker,
      lifecycle_guard || lifecycle_marker
    );
    execute lifecycle_definition;
  end if;
end
$migration$;

commit;
