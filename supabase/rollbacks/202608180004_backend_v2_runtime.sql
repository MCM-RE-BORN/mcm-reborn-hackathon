-- Structural rollback for 202608180004_backend_v2_runtime.sql.
-- Stop writers first. The rollback aborts on post-migration data, product,
-- trigger, privilege, policy, or consent-evidence drift.

begin;

lock table public.products,
  public.applications,
  public.mock_payments,
  public.application_change_requests,
  public.analytics_events,
  public.media_assets,
  public.analyses,
  public.analysis_images,
  storage.objects
in share row exclusive mode;

do $$
declare
  policy_backup record;
  current_policy_sha256 text;
begin
  if to_regclass('private.mcm_backend_v2_runtime_product_backup_20260818') is null
     or to_regclass('private.mcm_backend_v2_runtime_function_backup_20260818') is null
     or to_regclass('private.mcm_backend_v2_runtime_access_backup_20260818') is null
     or to_regclass('private.mcm_backend_v2_runtime_policy_backup_20260818') is null then
    raise exception 'backend v2 runtime rollback requires all private backup tables';
  end if;

  if to_regprocedure('public.apply_successful_mock_payment()') is null
     or to_regprocedure('public.apply_change_request_decision()') is null
     or to_regprocedure('public.can_delete_pending_source_product(text,text)') is null
     or to_regprocedure(
       'public.record_analytics_event(uuid,uuid,text,timestamptz,uuid,uuid,uuid,jsonb)'
     ) is null then
    raise exception 'backend v2 runtime rollback requires the migrated runtime functions';
  end if;

  if to_regclass('public.analysis_external_ai_consents') is null
     or to_regclass('public.analytics_events_user_received_idx') is null
     or not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'products'
         and column_name = 'model_3d_ready'
     ) then
    raise exception 'backend v2 runtime rollback requires the migrated runtime structures';
  end if;

  if exists (select 1 from public.analysis_external_ai_consents) then
    raise exception 'rollback requires manual archival of external AI consent evidence';
  end if;

  if exists (select 1 from public.products where model_3d_ready) then
    raise exception 'rollback requires manual handling of products enabled for 3D after migration';
  end if;

  if (
    select count(*)
    from private.mcm_backend_v2_runtime_product_backup_20260818
    where migrated_model_3d is not null
      and migrated_option_groups is not null
      and migrated_model_3d_ready = false
  ) <> 4 then
    raise exception 'backend v2 runtime rollback requires four complete product backups';
  end if;

  if exists (
    select 1
    from private.mcm_backend_v2_runtime_product_backup_20260818 backup
    left join public.products p on p.id = backup.product_id
    where p.id is null
       or p.code <> backup.product_code
       or p.model_3d is distinct from backup.migrated_model_3d
       or p.model_3d_ready is distinct from backup.migrated_model_3d_ready
       or p.option_groups is distinct from backup.migrated_option_groups
  ) then
    raise exception 'rollback requires manual handling of product models changed after migration';
  end if;

  if (
    select count(*)
    from private.mcm_backend_v2_runtime_function_backup_20260818
    where migrated_definition_sha256 is not null
      and migrated_public_execute is not null
      and migrated_anon_execute is not null
      and migrated_authenticated_execute is not null
  ) <> 2 then
    raise exception 'backend v2 runtime rollback requires both function backups';
  end if;

  if exists (
    select 1
    from private.mcm_backend_v2_runtime_function_backup_20260818 backup
    where encode(
      digest(
        pg_get_functiondef(to_regprocedure(backup.function_signature)),
        'sha256'
      ),
      'hex'
    ) <> backup.migrated_definition_sha256
  ) then
    raise exception 'rollback requires manual handling of trigger functions changed after migration';
  end if;

  if exists (
    select 1
    from private.mcm_backend_v2_runtime_function_backup_20260818 backup
    join pg_proc p on p.oid = to_regprocedure(backup.function_signature)
    where backup.migrated_public_execute is distinct from exists (
        select 1
        from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) privilege
        where privilege.grantee = 0 and privilege.privilege_type = 'EXECUTE'
      )
      or backup.migrated_anon_execute is distinct from
        has_function_privilege('anon', p.oid, 'EXECUTE')
      or backup.migrated_authenticated_execute is distinct from
        has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) then
    raise exception 'rollback requires manual handling of trigger privileges changed after migration';
  end if;

  if not exists (
    select 1
    from private.mcm_backend_v2_runtime_access_backup_20260818
    where migrated_prepare_trigger_sha256 is not null
      and migrated_apply_trigger_sha256 is not null
      and migrated_record_event_function_sha256 is not null
  ) then
    raise exception 'backend v2 runtime rollback requires the trigger backup';
  end if;

  if (
    select encode(digest(pg_get_triggerdef(t.oid), 'sha256'), 'hex')
    from pg_trigger t
    where t.tgrelid = 'public.application_change_requests'::regclass
      and t.tgname = 'application_change_requests_prepare_decision'
      and not t.tgisinternal
  ) is distinct from (
    select migrated_prepare_trigger_sha256
    from private.mcm_backend_v2_runtime_access_backup_20260818
  ) or (
    select encode(digest(pg_get_triggerdef(t.oid), 'sha256'), 'hex')
    from pg_trigger t
    where t.tgrelid = 'public.application_change_requests'::regclass
      and t.tgname = 'application_change_requests_apply_decision'
      and not t.tgisinternal
  ) is distinct from (
    select migrated_apply_trigger_sha256
    from private.mcm_backend_v2_runtime_access_backup_20260818
  ) then
    raise exception 'rollback requires manual handling of change-decision triggers changed after migration';
  end if;

  if (
    select encode(digest(pg_get_functiondef(p.oid), 'sha256'), 'hex')
    from pg_proc p
    where p.oid = to_regprocedure(
      'public.record_analytics_event(uuid,uuid,text,timestamptz,uuid,uuid,uuid,jsonb)'
    )
  ) is distinct from (
    select migrated_record_event_function_sha256
    from private.mcm_backend_v2_runtime_access_backup_20260818
  ) then
    raise exception 'rollback requires manual handling of analytics RPC changed after migration';
  end if;

  if has_table_privilege('anon', 'public.analytics_events', 'INSERT')
     or has_table_privilege('authenticated', 'public.analytics_events', 'INSERT')
     or has_table_privilege('service_role', 'public.analytics_events', 'INSERT') then
    raise exception 'rollback requires manual handling of analytics insert grants changed after migration';
  end if;

  if has_function_privilege(
       'anon',
       'public.record_analytics_event(uuid,uuid,text,timestamptz,uuid,uuid,uuid,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.record_analytics_event(uuid,uuid,text,timestamptz,uuid,uuid,uuid,jsonb)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.record_analytics_event(uuid,uuid,text,timestamptz,uuid,uuid,uuid,jsonb)',
       'EXECUTE'
     ) then
    raise exception 'rollback requires manual handling of analytics RPC privileges changed after migration';
  end if;

  if (
    select count(*)
    from private.mcm_backend_v2_runtime_policy_backup_20260818
    where migrated_definition_sha256 is not null
  ) <> 4 then
    raise exception 'backend v2 runtime rollback requires all four policy backups';
  end if;

  for policy_backup in
    select *
    from private.mcm_backend_v2_runtime_policy_backup_20260818
    order by policy_key
  loop
    if policy_backup.migrated_definition_sha256 = 'ABSENT' then
      if exists (
        select 1
        from pg_policy policy
        where policy.polrelid = policy_backup.relation_name::regclass
          and policy.polname = policy_backup.policy_name
      ) then
        raise exception 'rollback requires manual handling of policy % changed after migration',
          policy_backup.policy_name;
      end if;
    else
      select encode(
        digest(
          concat_ws(
            '|',
            policy.polcmd,
            policy.polpermissive,
            array_to_string(policy.polroles, ','),
            coalesce(pg_get_expr(policy.polqual, policy.polrelid), ''),
            coalesce(pg_get_expr(policy.polwithcheck, policy.polrelid), '')
          ),
          'sha256'
        ),
        'hex'
      )
      into current_policy_sha256
      from pg_policy policy
      where policy.polrelid = policy_backup.relation_name::regclass
        and policy.polname = policy_backup.policy_name;

      if current_policy_sha256 is distinct from policy_backup.migrated_definition_sha256 then
        raise exception 'rollback requires manual handling of policy % changed after migration',
          policy_backup.policy_name;
      end if;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.analytics_events'::regclass
      and conname = 'analytics_events_event_name_check'
  ) or not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.applications'::regclass
      and conname = 'applications_initial_terms_contract'
  ) or not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.applications'::regclass
      and conname = 'applications_final_terms_contract'
  ) or not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.applications'::regclass
      and conname = 'applications_analysis_id_unique'
  ) then
    raise exception 'rollback requires the backend v2 runtime constraints';
  end if;
end;
$$;

do $$
declare
  restored_count integer;
begin
  update public.products p
  set model_3d = backup.previous_model_3d,
      option_groups = backup.previous_option_groups
  from private.mcm_backend_v2_runtime_product_backup_20260818 backup
  where p.id = backup.product_id
    and p.code = backup.product_code;

  get diagnostics restored_count = row_count;
  if restored_count <> 4 then
    raise exception 'backend v2 runtime rollback restored % product models instead of 4', restored_count;
  end if;
end;
$$;

do $$
declare
  backup record;
begin
  for backup in
    select *
    from private.mcm_backend_v2_runtime_function_backup_20260818
    order by function_signature
  loop
    execute backup.previous_definition;
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      backup.function_signature
    );

    if backup.previous_public_execute then
      execute format(
        'grant execute on function %s to public',
        backup.function_signature
      );
    else
      if backup.previous_anon_execute then
        execute format(
          'grant execute on function %s to anon',
          backup.function_signature
        );
      end if;
      if backup.previous_authenticated_execute then
        execute format(
          'grant execute on function %s to authenticated',
          backup.function_signature
        );
      end if;
    end if;
  end loop;
end;
$$;

drop trigger application_change_requests_prepare_decision
on public.application_change_requests;
drop trigger application_change_requests_apply_decision
on public.application_change_requests;

do $$
declare
  access_backup record;
begin
  select *
  into strict access_backup
  from private.mcm_backend_v2_runtime_access_backup_20260818;

  execute access_backup.previous_prepare_trigger_definition;
  execute access_backup.previous_apply_trigger_definition;
end;
$$;

do $$
declare
  policy_backup record;
  using_clause text;
  check_clause text;
begin
  for policy_backup in
    select *
    from private.mcm_backend_v2_runtime_policy_backup_20260818
    order by policy_key
  loop
    execute format(
      'drop policy if exists %I on %s',
      policy_backup.policy_name,
      policy_backup.relation_name
    );

    using_clause := case
      when policy_backup.previous_using_expression is null then ''
      else format(' using (%s)', policy_backup.previous_using_expression)
    end;
    check_clause := case
      when policy_backup.previous_check_expression is null then ''
      else format(' with check (%s)', policy_backup.previous_check_expression)
    end;

    execute format(
      'create policy %I on %s as %s for %s to %s%s%s',
      policy_backup.policy_name,
      policy_backup.relation_name,
      case when policy_backup.previous_permissive then 'permissive' else 'restrictive' end,
      policy_backup.previous_command,
      policy_backup.previous_roles,
      using_clause,
      check_clause
    );
  end loop;
end;
$$;

do $$
declare
  access_backup record;
begin
  select *
  into strict access_backup
  from private.mcm_backend_v2_runtime_access_backup_20260818;

  revoke insert on public.analytics_events
  from public, anon, authenticated, service_role;
  if access_backup.previous_analytics_public_insert then
    grant insert on public.analytics_events to public;
  else
    if access_backup.previous_analytics_anon_insert then
      grant insert on public.analytics_events to anon;
    end if;
    if access_backup.previous_analytics_authenticated_insert then
      grant insert on public.analytics_events to authenticated;
    end if;
    if access_backup.previous_analytics_service_insert then
      grant insert on public.analytics_events to service_role;
    end if;
  end if;
end;
$$;

drop table public.analysis_external_ai_consents;
drop function public.enforce_external_ai_consent_analysis_owner();
drop function public.can_delete_pending_source_product(text, text);
drop function public.record_analytics_event(
  uuid,
  uuid,
  text,
  timestamptz,
  uuid,
  uuid,
  uuid,
  jsonb
);
drop index public.analytics_events_user_received_idx;

alter table public.analytics_events
  drop constraint analytics_events_event_name_check;
alter table public.applications
  drop constraint applications_initial_terms_contract,
  drop constraint applications_final_terms_contract,
  drop constraint applications_analysis_id_unique;
alter table public.products
  drop column model_3d_ready;

drop table private.mcm_backend_v2_runtime_policy_backup_20260818;
drop table private.mcm_backend_v2_runtime_access_backup_20260818;
drop table private.mcm_backend_v2_runtime_function_backup_20260818;
drop table private.mcm_backend_v2_runtime_product_backup_20260818;

commit;
