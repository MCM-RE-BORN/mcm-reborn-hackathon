-- Align an existing v2 database with the runtime contract consumed by the
-- v2 ProductDetail, Mock payment, event, storage, consent, and customer
-- change-decision endpoints. Previous product JSON, function definitions,
-- privileges, and policy state are retained for the paired safe rollback.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.mcm_backend_v2_runtime_product_backup_20260818 (
  product_id uuid primary key,
  product_code text not null,
  previous_model_3d jsonb not null,
  previous_option_groups jsonb not null,
  migrated_model_3d jsonb,
  migrated_option_groups jsonb,
  migrated_model_3d_ready boolean,
  backed_up_at timestamptz not null default now()
);
revoke all on private.mcm_backend_v2_runtime_product_backup_20260818
from public, anon, authenticated;

create table if not exists private.mcm_backend_v2_runtime_function_backup_20260818 (
  function_signature text primary key,
  previous_definition text not null,
  previous_public_execute boolean not null,
  previous_anon_execute boolean not null,
  previous_authenticated_execute boolean not null,
  migrated_definition_sha256 text,
  migrated_public_execute boolean,
  migrated_anon_execute boolean,
  migrated_authenticated_execute boolean,
  backed_up_at timestamptz not null default now()
);
revoke all on private.mcm_backend_v2_runtime_function_backup_20260818
from public, anon, authenticated;

create table if not exists private.mcm_backend_v2_runtime_access_backup_20260818 (
  singleton boolean primary key default true check (singleton),
  previous_analytics_public_insert boolean not null,
  previous_analytics_anon_insert boolean not null,
  previous_analytics_authenticated_insert boolean not null,
  previous_analytics_service_insert boolean not null,
  previous_prepare_trigger_definition text not null,
  previous_apply_trigger_definition text not null,
  migrated_prepare_trigger_sha256 text,
  migrated_apply_trigger_sha256 text,
  migrated_record_event_function_sha256 text,
  backed_up_at timestamptz not null default now()
);
revoke all on private.mcm_backend_v2_runtime_access_backup_20260818
from public, anon, authenticated;

create table if not exists private.mcm_backend_v2_runtime_policy_backup_20260818 (
  policy_key text primary key,
  relation_name text not null,
  policy_name text not null,
  previous_command text not null,
  previous_permissive boolean not null,
  previous_roles text not null,
  previous_using_expression text,
  previous_check_expression text,
  migrated_definition_sha256 text,
  backed_up_at timestamptz not null default now(),
  unique (relation_name, policy_name)
);
revoke all on private.mcm_backend_v2_runtime_policy_backup_20260818
from public, anon, authenticated;

do $$
begin
  if exists (select 1 from private.mcm_backend_v2_runtime_product_backup_20260818)
     or exists (select 1 from private.mcm_backend_v2_runtime_function_backup_20260818)
     or exists (select 1 from private.mcm_backend_v2_runtime_access_backup_20260818)
     or exists (select 1 from private.mcm_backend_v2_runtime_policy_backup_20260818) then
    raise exception 'backend v2 runtime migration requires empty private backup tables';
  end if;
end;
$$;

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
begin
  if to_regprocedure('public.apply_successful_mock_payment()') is null
     or to_regprocedure('public.apply_change_request_decision()') is null then
    raise exception 'backend v2 runtime migration requires the existing payment and change-decision triggers';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.application_change_requests'::regclass
      and tgname = 'application_change_requests_prepare_decision'
      and not tgisinternal
  ) or not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.application_change_requests'::regclass
      and tgname = 'application_change_requests_apply_decision'
      and not tgisinternal
  ) then
    raise exception 'backend v2 runtime migration requires both existing change-decision triggers';
  end if;

  if exists (
    with expected(product_id, product_code) as (
      values
        ('10000000-0000-4000-8000-000000000001'::uuid, 'REBORN_PASSPORT_WALLET'),
        ('10000000-0000-4000-8000-000000000002'::uuid, 'REBORN_CARD_WALLET'),
        ('10000000-0000-4000-8000-000000000003'::uuid, 'REBORN_NAME_TAG'),
        ('10000000-0000-4000-8000-000000000004'::uuid, 'REBORN_KEYRING')
    )
    select 1
    from expected e
    left join public.products p on p.id = e.product_id
    where p.id is null or p.code <> e.product_code
  ) then
    raise exception 'backend v2 runtime migration requires the four canonical product IDs and codes';
  end if;

  if exists (
    select 1
    from public.analytics_events ae
    where ae.event_name not in (
      'ANALYSIS_STARTED',
      'ANALYSIS_COMPLETED',
      'ANALYSIS_FALLBACK_USED',
      'PRODUCT_LIST_VIEWED',
      'PRODUCT_DETAIL_VIEWED',
      'APPLICATION_CREATED',
      'MOCK_PAYMENT_COMPLETED',
      'PHYSICAL_INSPECTION_COMPLETED',
      'APPLICATION_CHANGE_APPROVED',
      'APPLICATION_CHANGE_REJECTED',
      'CERTIFICATE_VIEWED'
    )
  ) then
    raise exception 'analytics event-name migration requires manual review of unknown values';
  end if;

  if exists (
    select 1
    from public.applications a
    where not public.is_valid_application_terms(a.initial_terms)
       or lower(a.initial_terms->>'productId') <> a.product_id::text
       or (
         a.final_terms is not null
         and (
           not public.is_valid_application_terms(a.final_terms)
           or lower(a.final_terms->>'productId') <> a.product_id::text
         )
       )
  ) then
    raise exception 'application terms migration requires manual review of invalid or mismatched product terms';
  end if;

  if exists (
    select 1
    from public.applications a
    group by a.analysis_id
    having count(*) > 1
  ) then
    raise exception 'application analysis uniqueness requires manual review of duplicate orders';
  end if;

  if not exists (
    select 1
    from pg_policy
    where polrelid = 'public.analytics_events'::regclass
      and polname = 'analytics_events_insert'
  ) or not exists (
    select 1
    from pg_policy
    where polrelid = 'storage.objects'::regclass
      and polname = 'source_products_insert_own_folder'
  ) or not exists (
    select 1
    from pg_policy
    where polrelid = 'storage.objects'::regclass
      and polname = 'source_products_delete_own_folder'
  ) or not exists (
    select 1
    from pg_policy
    where polrelid = 'public.application_change_requests'::regclass
      and polname = 'change_requests_customer_decide'
  ) then
    raise exception 'backend v2 runtime migration requires the existing event, storage, and change policies';
  end if;

  if to_regclass('public.analysis_external_ai_consents') is not null
     or to_regprocedure('public.enforce_external_ai_consent_analysis_owner()') is not null
     or to_regprocedure('public.can_delete_pending_source_product(text,text)') is not null
     or to_regprocedure(
       'public.record_analytics_event(uuid,uuid,text,timestamptz,uuid,uuid,uuid,jsonb)'
     ) is not null
     or exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'products'
         and column_name = 'model_3d_ready'
     )
     or to_regclass('public.analytics_events_user_received_idx') is not null then
    raise exception 'backend v2 runtime structures already exist and require manual version review';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid in (
      'public.applications'::regclass,
      'public.analytics_events'::regclass
    )
      and conname in (
        'applications_initial_terms_contract',
        'applications_final_terms_contract',
        'applications_analysis_id_unique',
        'analytics_events_event_name_check'
      )
  ) then
    raise exception 'backend v2 runtime constraints already exist and require manual version review';
  end if;
end;
$$;

insert into private.mcm_backend_v2_runtime_product_backup_20260818 (
  product_id,
  product_code,
  previous_model_3d,
  previous_option_groups
)
select p.id, p.code, p.model_3d, p.option_groups
from public.products p
where p.id in (
  '10000000-0000-4000-8000-000000000001'::uuid,
  '10000000-0000-4000-8000-000000000002'::uuid,
  '10000000-0000-4000-8000-000000000003'::uuid,
  '10000000-0000-4000-8000-000000000004'::uuid
);

with target(function_signature, function_oid) as (
  values
    (
      'public.apply_successful_mock_payment()',
      to_regprocedure('public.apply_successful_mock_payment()')
    ),
    (
      'public.apply_change_request_decision()',
      to_regprocedure('public.apply_change_request_decision()')
    )
)
insert into private.mcm_backend_v2_runtime_function_backup_20260818 (
  function_signature,
  previous_definition,
  previous_public_execute,
  previous_anon_execute,
  previous_authenticated_execute
)
select t.function_signature,
       pg_get_functiondef(p.oid),
       exists (
         select 1
         from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) privilege
         where privilege.grantee = 0 and privilege.privilege_type = 'EXECUTE'
       ),
       has_function_privilege('anon', p.oid, 'EXECUTE'),
       has_function_privilege('authenticated', p.oid, 'EXECUTE')
from target t
join pg_proc p on p.oid = t.function_oid;

insert into private.mcm_backend_v2_runtime_access_backup_20260818 (
  singleton,
  previous_analytics_public_insert,
  previous_analytics_anon_insert,
  previous_analytics_authenticated_insert,
  previous_analytics_service_insert,
  previous_prepare_trigger_definition,
  previous_apply_trigger_definition
)
select true,
       exists (
         select 1
         from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) privilege
         where privilege.grantee = 0 and privilege.privilege_type = 'INSERT'
       ),
       has_table_privilege('anon', c.oid, 'INSERT'),
       has_table_privilege('authenticated', c.oid, 'INSERT'),
       has_table_privilege('service_role', c.oid, 'INSERT'),
       (
         select pg_get_triggerdef(t.oid)
         from pg_trigger t
         where t.tgrelid = 'public.application_change_requests'::regclass
           and t.tgname = 'application_change_requests_prepare_decision'
           and not t.tgisinternal
       ),
       (
         select pg_get_triggerdef(t.oid)
         from pg_trigger t
         where t.tgrelid = 'public.application_change_requests'::regclass
           and t.tgname = 'application_change_requests_apply_decision'
           and not t.tgisinternal
       )
from pg_class c
where c.oid = 'public.analytics_events'::regclass;

with target(policy_key, relation_name, relation_oid, policy_name) as (
  values
    (
      'analytics_insert',
      'public.analytics_events',
      'public.analytics_events'::regclass,
      'analytics_events_insert'
    ),
    (
      'source_insert',
      'storage.objects',
      'storage.objects'::regclass,
      'source_products_insert_own_folder'
    ),
    (
      'source_delete',
      'storage.objects',
      'storage.objects'::regclass,
      'source_products_delete_own_folder'
    ),
    (
      'change_decide',
      'public.application_change_requests',
      'public.application_change_requests'::regclass,
      'change_requests_customer_decide'
    )
)
insert into private.mcm_backend_v2_runtime_policy_backup_20260818 (
  policy_key,
  relation_name,
  policy_name,
  previous_command,
  previous_permissive,
  previous_roles,
  previous_using_expression,
  previous_check_expression
)
select target.policy_key,
       target.relation_name,
       target.policy_name,
       case policy.polcmd
         when 'r' then 'select'
         when 'a' then 'insert'
         when 'w' then 'update'
         when 'd' then 'delete'
         when '*' then 'all'
       end,
       policy.polpermissive,
       array_to_string(
         array(
           select case
             when role_entry.role_oid = 0 then 'public'
             else quote_ident(pg_get_userbyid(role_entry.role_oid))
           end
           from unnest(policy.polroles) as role_entry(role_oid)
           order by role_entry.role_oid
         ),
         ', '
       ),
       pg_get_expr(policy.polqual, policy.polrelid),
       pg_get_expr(policy.polwithcheck, policy.polrelid)
from target
join pg_policy policy
  on policy.polrelid = target.relation_oid
 and policy.polname = target.policy_name;

alter table public.products
  add column model_3d_ready boolean not null default false;

with canonical(product_id, product_code, model_3d, option_groups) as (
  values
    (
      '10000000-0000-4000-8000-000000000001'::uuid,
      'REBORN_PASSPORT_WALLET',
      '{"format":"GLB","url":"/assets/models/passport-wallet.glb","posterUrl":"/assets/products/passport-wallet/poster.webp","environmentImageUrl":"/assets/3d/studio.hdr","cameraOrbit":"0deg 75deg 105%","cameraTarget":"0m 0m 0m","fieldOfView":"30deg","autoRotate":true,"availableVariants":[{"key":"COGNAC_GOLD","label":"코냑·골드"}]}'::jsonb,
      '[{"key":"edgeColor","label":"엣지 색상","required":true,"type":"SELECT","options":[{"value":"COGNAC","label":"코냑","modelVariant":"COGNAC_GOLD"}]},{"key":"initials","label":"이니셜","required":false,"type":"TEXT","maxLength":3}]'::jsonb
    ),
    (
      '10000000-0000-4000-8000-000000000002'::uuid,
      'REBORN_CARD_WALLET',
      '{"format":"GLB","url":"/assets/models/card-wallet.glb","posterUrl":"/assets/products/card-wallet/poster.webp","environmentImageUrl":"/assets/3d/studio.hdr","cameraOrbit":"20deg 75deg 110%","cameraTarget":"0m 0m 0m","fieldOfView":"28deg","autoRotate":true,"availableVariants":[{"key":"COGNAC_GOLD","label":"코냑·골드"}]}'::jsonb,
      '[]'::jsonb
    ),
    (
      '10000000-0000-4000-8000-000000000003'::uuid,
      'REBORN_NAME_TAG',
      '{"format":"GLB","url":"/assets/models/name-tag.glb","posterUrl":"/assets/products/name-tag/poster.webp","environmentImageUrl":"/assets/3d/studio.hdr","cameraOrbit":"0deg 75deg 110%","cameraTarget":"0m 0m 0m","fieldOfView":"28deg","autoRotate":true,"availableVariants":[{"key":"GOLD","label":"골드"}]}'::jsonb,
      '[]'::jsonb
    ),
    (
      '10000000-0000-4000-8000-000000000004'::uuid,
      'REBORN_KEYRING',
      '{"format":"GLB","url":"/assets/models/keyring.glb","posterUrl":"/assets/products/keyring/poster.webp","environmentImageUrl":"/assets/3d/studio.hdr","cameraOrbit":"0deg 75deg 115%","cameraTarget":"0m 0m 0m","fieldOfView":"25deg","autoRotate":true,"availableVariants":[{"key":"GOLD_RING","label":"골드 링"}]}'::jsonb,
      '[]'::jsonb
    )
)
update public.products p
set model_3d = canonical.model_3d,
    model_3d_ready = false,
    option_groups = canonical.option_groups
from canonical
where p.id = canonical.product_id
  and p.code = canonical.product_code;

update private.mcm_backend_v2_runtime_product_backup_20260818 backup
set migrated_model_3d = p.model_3d,
    migrated_option_groups = p.option_groups,
    migrated_model_3d_ready = p.model_3d_ready
from public.products p
where p.id = backup.product_id;

create table public.analysis_external_ai_consents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  request_hash text not null
    constraint analysis_external_ai_consents_request_hash_check
    check (request_hash ~ '^[0-9a-f]{64}$'),
  privacy_notice_version text not null
    constraint analysis_external_ai_consents_notice_version_check
    check (
      length(trim(privacy_notice_version)) between 1 and 100
      and privacy_notice_version = trim(privacy_notice_version)
    ),
  accepted_at timestamptz not null,
  analysis_id uuid references public.analyses(id) on delete restrict,
  unique (customer_id, request_hash)
);

create or replace function public.enforce_external_ai_consent_analysis_owner()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' and new.analysis_id is not null then
    raise exception 'external AI consent must be recorded before analysis creation'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if (
      new.customer_id,
      new.request_hash,
      new.privacy_notice_version,
      new.accepted_at
    ) is distinct from (
      old.customer_id,
      old.request_hash,
      old.privacy_notice_version,
      old.accepted_at
    ) then
      raise exception 'external AI consent evidence is immutable'
        using errcode = '23514';
    end if;

    if old.analysis_id is not null or new.analysis_id is null then
      raise exception 'external AI consent analysis can be linked exactly once'
        using errcode = '23514';
    end if;
  end if;

  if new.analysis_id is not null and not exists (
    select 1
    from public.analyses a
    where a.id = new.analysis_id
      and a.customer_id = new.customer_id
      and a.status = 'COMPLETED'
  ) then
    raise exception 'external AI consent analysis must be completed and belong to the same customer'
      using errcode = '23503';
  end if;

  return new;
end;
$$;

create trigger analysis_external_ai_consents_enforce_owner
before insert or update
on public.analysis_external_ai_consents
for each row execute function public.enforce_external_ai_consent_analysis_owner();

alter table public.analysis_external_ai_consents enable row level security;
create policy analysis_external_ai_consents_owner_read
on public.analysis_external_ai_consents for select to authenticated
using (customer_id = auth.uid());

revoke all on public.analysis_external_ai_consents
from public, anon, authenticated;
revoke all on public.analysis_external_ai_consents from service_role;
grant select on public.analysis_external_ai_consents to authenticated;
grant select, insert on public.analysis_external_ai_consents to service_role;
grant update (analysis_id) on public.analysis_external_ai_consents to service_role;
revoke all on function public.enforce_external_ai_consent_analysis_owner()
from public, anon, authenticated;

create index analytics_events_user_received_idx
on public.analytics_events(user_id, received_at desc);

create or replace function public.record_analytics_event(
  p_user_id uuid,
  p_session_id uuid,
  p_event_name text,
  p_occurred_at timestamptz,
  p_analysis_id uuid default null,
  p_product_id uuid default null,
  p_application_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recent_event_count integer;
  created_event_id uuid;
begin
  if p_user_id is null then
    raise exception 'analytics event user is required'
      using errcode = '22004';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select count(*)
  into recent_event_count
  from public.analytics_events ae
  where ae.user_id = p_user_id
    and ae.received_at >= clock_timestamp() - interval '60 seconds';

  if recent_event_count >= 60 then
    raise exception 'analytics event rate limit exceeded'
      using errcode = 'P0001';
  end if;

  insert into public.analytics_events (
    user_id,
    session_id,
    event_name,
    analysis_id,
    product_id,
    application_id,
    metadata,
    occurred_at,
    received_at
  ) values (
    p_user_id,
    p_session_id,
    p_event_name,
    p_analysis_id,
    p_product_id,
    p_application_id,
    coalesce(p_metadata, '{}'::jsonb),
    p_occurred_at,
    clock_timestamp()
  )
  returning id into created_event_id;

  return created_event_id;
end;
$$;

revoke all on function public.record_analytics_event(
  uuid,
  uuid,
  text,
  timestamptz,
  uuid,
  uuid,
  uuid,
  jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.record_analytics_event(
  uuid,
  uuid,
  text,
  timestamptz,
  uuid,
  uuid,
  uuid,
  jsonb
) to service_role;

alter table public.applications
  add constraint applications_initial_terms_contract check (
    public.is_valid_application_terms(initial_terms)
    and lower(initial_terms->>'productId') = product_id::text
  ) not valid,
  add constraint applications_final_terms_contract check (
    final_terms is null
    or (
      public.is_valid_application_terms(final_terms)
      and lower(final_terms->>'productId') = product_id::text
    )
  ) not valid,
  add constraint applications_analysis_id_unique unique (analysis_id);

alter table public.applications
  validate constraint applications_initial_terms_contract;
alter table public.applications
  validate constraint applications_final_terms_contract;

alter table public.analytics_events
  add constraint analytics_events_event_name_check check (event_name in (
    'ANALYSIS_STARTED',
    'ANALYSIS_COMPLETED',
    'ANALYSIS_FALLBACK_USED',
    'PRODUCT_LIST_VIEWED',
    'PRODUCT_DETAIL_VIEWED',
    'APPLICATION_CREATED',
    'MOCK_PAYMENT_COMPLETED',
    'PHYSICAL_INSPECTION_COMPLETED',
    'APPLICATION_CHANGE_APPROVED',
    'APPLICATION_CHANGE_REJECTED',
    'CERTIFICATE_VIEWED'
  )) not valid;

alter table public.analytics_events
  validate constraint analytics_events_event_name_check;

drop policy analytics_events_insert on public.analytics_events;
revoke insert on public.analytics_events
from public, anon, authenticated, service_role;

drop policy change_requests_customer_decide on public.application_change_requests;
create policy change_requests_customer_decide
on public.application_change_requests for update
using (
  status = 'PENDING'
  and exists (
    select 1
    from public.applications a
    where a.id = application_id and a.customer_id = auth.uid()
  )
)
with check (status in ('APPROVED', 'REJECTED'));

create or replace function public.can_delete_pending_source_product(
  p_bucket text,
  p_path text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.media_assets ma
      where ma.owner_id = auth.uid()
        and ma.bucket = p_bucket
        and ma.path = p_path
        and ma.upload_status = 'PENDING'
        and not exists (
          select 1
          from public.analysis_images ai
          where ai.media_asset_id = ma.id
        )
    );
$$;

revoke all on function public.can_delete_pending_source_product(text, text)
from public, anon, authenticated;
grant execute on function public.can_delete_pending_source_product(text, text)
to authenticated;

drop policy source_products_insert_own_folder on storage.objects;
create policy source_products_insert_own_folder
on storage.objects for insert to authenticated
with check (
  bucket_id = 'source-products'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png')
  and exists (
    select 1
    from public.media_assets ma
    where ma.owner_id = auth.uid()
      and ma.bucket = bucket_id
      and ma.path = name
      and ma.upload_status = 'PENDING'
      and (
        (ma.mime_type = 'image/jpeg' and lower(storage.extension(name)) in ('jpg', 'jpeg'))
        or (ma.mime_type = 'image/png' and lower(storage.extension(name)) = 'png')
      )
  )
);

drop policy source_products_delete_own_folder on storage.objects;
create policy source_products_delete_own_folder
on storage.objects for delete to authenticated
using (
  bucket_id = 'source-products'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.can_delete_pending_source_product(bucket_id, name)
);

do $$
begin
  if has_table_privilege('anon', 'public.analytics_events', 'INSERT')
     or has_table_privilege('authenticated', 'public.analytics_events', 'INSERT') then
    raise exception 'analytics event inserts must be restricted to the validated server route';
  end if;
end;
$$;

create or replace function public.apply_successful_mock_payment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'PAID' then
    update public.applications
    set persisted_status = 'ORDER_PLACED'
    where id = new.application_id and persisted_status = 'PENDING_PAYMENT';

    if not found then
      raise exception 'successful mock payment requires a PENDING_PAYMENT application'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.apply_change_request_decision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  decision_user_id uuid := auth.uid();
begin
  if decision_user_id is null then
    raise exception 'authenticated customer required for change decision'
      using errcode = '42501';
  end if;

  if old.status <> 'PENDING'
     or new.status not in ('APPROVED', 'REJECTED')
     or new.status is not distinct from old.status then
    raise exception 'change request decision requires the first PENDING transition'
      using errcode = '23514';
  end if;

  if new.application_id is distinct from old.application_id
     or new.responded_by is distinct from decision_user_id then
    raise exception 'change request decision identity mismatch'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.applications a
    where a.id = new.application_id
      and a.customer_id = decision_user_id
  ) then
    raise exception 'change request decision requires application ownership'
      using errcode = '42501';
  end if;

  update public.applications a
  set persisted_status = case new.status
      when 'APPROVED' then 'PRODUCTION_READY'::public.application_status
      else 'CANCELED'::public.application_status
    end,
    final_terms = case when new.status = 'APPROVED' then new.proposed_terms else a.final_terms end
  where a.id = new.application_id
    and a.customer_id = decision_user_id
    and a.persisted_status = 'CHANGE_APPROVAL_REQUIRED';

  if not found then
    raise exception 'change decision requires CHANGE_APPROVAL_REQUIRED status';
  end if;
  return new;
end;
$$;

drop trigger application_change_requests_prepare_decision
on public.application_change_requests;
create trigger application_change_requests_prepare_decision
before update on public.application_change_requests
for each row execute function public.prepare_change_request_decision();

drop trigger application_change_requests_apply_decision
on public.application_change_requests;
create trigger application_change_requests_apply_decision
after update on public.application_change_requests
for each row execute function public.apply_change_request_decision();

revoke all on function public.apply_change_request_decision()
from public, anon, authenticated;

update private.mcm_backend_v2_runtime_function_backup_20260818 backup
set migrated_definition_sha256 = encode(
  digest(
    pg_get_functiondef(p.oid),
    'sha256'
  ),
  'hex'
),
    migrated_public_execute = exists (
      select 1
      from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) privilege
      where privilege.grantee = 0 and privilege.privilege_type = 'EXECUTE'
    ),
    migrated_anon_execute = has_function_privilege('anon', p.oid, 'EXECUTE'),
    migrated_authenticated_execute = has_function_privilege(
      'authenticated',
      p.oid,
      'EXECUTE'
    )
from pg_proc p
where p.oid = to_regprocedure(backup.function_signature);

update private.mcm_backend_v2_runtime_access_backup_20260818 backup
set migrated_prepare_trigger_sha256 = (
      select encode(digest(pg_get_triggerdef(t.oid), 'sha256'), 'hex')
      from pg_trigger t
      where t.tgrelid = 'public.application_change_requests'::regclass
        and t.tgname = 'application_change_requests_prepare_decision'
        and not t.tgisinternal
    ),
    migrated_apply_trigger_sha256 = (
      select encode(digest(pg_get_triggerdef(t.oid), 'sha256'), 'hex')
      from pg_trigger t
      where t.tgrelid = 'public.application_change_requests'::regclass
        and t.tgname = 'application_change_requests_apply_decision'
        and not t.tgisinternal
    ),
    migrated_record_event_function_sha256 = (
      select encode(digest(pg_get_functiondef(p.oid), 'sha256'), 'hex')
      from pg_proc p
      where p.oid = to_regprocedure(
        'public.record_analytics_event(uuid,uuid,text,timestamptz,uuid,uuid,uuid,jsonb)'
      )
    );

update private.mcm_backend_v2_runtime_policy_backup_20260818 backup
set migrated_definition_sha256 = case
  when backup.policy_key = 'analytics_insert' then 'ABSENT'
  else (
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
    from pg_policy policy
    where policy.polrelid = backup.relation_name::regclass
      and policy.polname = backup.policy_name
  )
end;

do $$
begin
  if (
    select count(*)
    from private.mcm_backend_v2_runtime_product_backup_20260818
    where migrated_model_3d is not null
      and migrated_option_groups is not null
      and migrated_model_3d_ready = false
  ) <> 4 then
    raise exception 'backend v2 runtime migration did not preserve all four product models';
  end if;

  if (
    select count(*)
    from private.mcm_backend_v2_runtime_function_backup_20260818
    where migrated_definition_sha256 is not null
      and migrated_public_execute is not null
      and migrated_anon_execute is not null
      and migrated_authenticated_execute is not null
  ) <> 2 then
    raise exception 'backend v2 runtime migration did not preserve both trigger definitions';
  end if;

  if not exists (
    select 1
    from private.mcm_backend_v2_runtime_access_backup_20260818
    where migrated_prepare_trigger_sha256 is not null
      and migrated_apply_trigger_sha256 is not null
      and migrated_record_event_function_sha256 is not null
  ) then
    raise exception 'backend v2 runtime migration did not preserve trigger state';
  end if;

  if (
    select count(*)
    from private.mcm_backend_v2_runtime_policy_backup_20260818
    where migrated_definition_sha256 is not null
  ) <> 4 then
    raise exception 'backend v2 runtime migration did not preserve all policy state';
  end if;

  if has_table_privilege('service_role', 'public.analytics_events', 'INSERT')
     or has_table_privilege('anon', 'public.analytics_events', 'INSERT')
     or has_table_privilege('authenticated', 'public.analytics_events', 'INSERT') then
    raise exception 'backend v2 runtime migration produced invalid analytics insert privileges';
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
    raise exception 'backend v2 runtime migration produced invalid analytics RPC privileges';
  end if;

  if exists (
    select 1
    from pg_policy
    where polrelid = 'public.analytics_events'::regclass
      and polname = 'analytics_events_insert'
  ) then
    raise exception 'backend v2 runtime migration retained the direct analytics insert policy';
  end if;

  if has_table_privilege('authenticated', 'public.analysis_external_ai_consents', 'INSERT')
     or has_table_privilege('authenticated', 'public.analysis_external_ai_consents', 'UPDATE')
     or has_table_privilege('authenticated', 'public.analysis_external_ai_consents', 'DELETE')
     or not has_table_privilege('authenticated', 'public.analysis_external_ai_consents', 'SELECT')
     or not has_table_privilege('service_role', 'public.analysis_external_ai_consents', 'INSERT')
     or not has_column_privilege(
       'service_role',
       'public.analysis_external_ai_consents',
       'analysis_id',
       'UPDATE'
     )
     or has_column_privilege(
       'service_role',
       'public.analysis_external_ai_consents',
       'accepted_at',
       'UPDATE'
     )
     or has_table_privilege('service_role', 'public.analysis_external_ai_consents', 'DELETE') then
    raise exception 'backend v2 runtime migration produced invalid consent-evidence privileges';
  end if;
end;
$$;

commit;
