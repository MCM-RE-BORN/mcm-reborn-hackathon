-- Align an existing v2 demo database with the lifecycle-integrity contract.
-- This migration intentionally fails instead of inventing inspection terms,
-- operator identity, or certificate eligibility that cannot be proven. Consent
-- key conversion is limited to the exact all-true PRIMARY_SCENARIO demo fixture.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.mcm_lifecycle_alignment_backup_20260818 (
  application_id uuid primary key,
  consents jsonb not null,
  backed_up_at timestamptz not null default now()
);
revoke all on private.mcm_lifecycle_alignment_backup_20260818 from public, anon, authenticated;

insert into private.mcm_lifecycle_alignment_backup_20260818 (application_id, consents)
select a.id, a.consents
from public.applications a
on conflict (application_id) do nothing;

create or replace function public.is_valid_application_terms(terms jsonb)
returns boolean
language plpgsql
immutable
parallel safe
set search_path = public, pg_temp
as $$
declare
  amount_value numeric;
  reusable_rate numeric;
begin
  if terms is null
     or jsonb_typeof(terms) <> 'object'
     or (terms - array['productId', 'amount', 'estimatedDuration', 'estimatedReusableMaterialRate']) <> '{}'::jsonb
     or not (terms ?& array['productId', 'amount', 'estimatedDuration', 'estimatedReusableMaterialRate'])
     or jsonb_typeof(terms->'productId') <> 'string'
     or terms->>'productId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or jsonb_typeof(terms->'amount') <> 'object'
     or ((terms->'amount') - array['amount', 'currency']) <> '{}'::jsonb
     or not ((terms->'amount') ?& array['amount', 'currency'])
     or jsonb_typeof(terms->'amount'->'amount') <> 'number'
     or terms->'amount'->>'currency' <> 'KRW'
     or jsonb_typeof(terms->'estimatedDuration') <> 'string'
     or length(trim(terms->>'estimatedDuration')) = 0
     or jsonb_typeof(terms->'estimatedReusableMaterialRate') <> 'number' then
    return false;
  end if;

  amount_value := (terms->'amount'->>'amount')::numeric;
  reusable_rate := (terms->>'estimatedReusableMaterialRate')::numeric;

  return coalesce(amount_value >= 0
    and amount_value = trunc(amount_value)
    and reusable_rate between 0 and 100
    and reusable_rate = trunc(reusable_rate), false);
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return false;
end;
$$;

alter table public.applications
  add column if not exists pickup_schedule jsonb;

update public.applications a
set pickup_schedule = jsonb_build_object(
  'requestedDate', to_char((a.created_at at time zone 'Asia/Seoul')::date + 2, 'YYYY-MM-DD'),
  'timeWindow', '14:00-16:00'
)
where a.pickup_schedule is null;

do $$
begin
  if exists (
    select 1
    from public.applications a
    where a.consents not in (
      '{"demoTermsAccepted":true,"aiEstimateNoticeAccepted":true,"esgEstimateNoticeAccepted":true}'::jsonb,
      '{"serviceAndPrivacyTermsAccepted":true,"aiEstimateNoticeAccepted":true,"inspectionChangeNoticeAccepted":true}'::jsonb
    )
  ) then
    raise exception 'consent backfill requires manual review for non-canonical rows';
  end if;

  if exists (
    select 1
    from public.applications a
    where a.consents = '{"demoTermsAccepted":true,"aiEstimateNoticeAccepted":true,"esgEstimateNoticeAccepted":true}'::jsonb
      and a.demo_progress_profile <> 'PRIMARY_SCENARIO'
  ) then
    raise exception 'legacy consent conversion is limited to PRIMARY_SCENARIO demo rows';
  end if;
end;
$$;

create or replace function public.enforce_application_transition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  transition_allowed boolean := false;
  production_cleared boolean := false;
begin
  if new.persisted_status = old.persisted_status then
    return new;
  end if;

  transition_allowed := case old.persisted_status
    when 'PENDING_PAYMENT' then new.persisted_status in ('ORDER_PLACED', 'CANCELED')
    when 'ORDER_PLACED' then new.persisted_status in ('PICKUP_SCHEDULED', 'CANCELED')
    when 'PICKUP_SCHEDULED' then new.persisted_status in ('PICKUP_IN_PROGRESS', 'CANCELED')
    when 'PICKUP_IN_PROGRESS' then new.persisted_status in ('PRODUCT_RECEIVED', 'CANCELED')
    when 'PRODUCT_RECEIVED' then new.persisted_status in ('EXPERT_INSPECTION', 'CANCELED')
    when 'EXPERT_INSPECTION' then new.persisted_status in ('PRODUCTION_READY', 'CHANGE_APPROVAL_REQUIRED', 'PRODUCTION_UNAVAILABLE', 'CANCELED')
    when 'CHANGE_APPROVAL_REQUIRED' then new.persisted_status in ('PRODUCTION_READY', 'CANCELED')
    when 'PRODUCTION_READY' then new.persisted_status in ('IN_PRODUCTION', 'CANCELED')
    when 'IN_PRODUCTION' then new.persisted_status in ('QUALITY_CHECK', 'PRODUCTION_UNAVAILABLE', 'CANCELED')
    when 'QUALITY_CHECK' then new.persisted_status in ('SHIPPED', 'PRODUCTION_UNAVAILABLE', 'CANCELED')
    when 'SHIPPED' then new.persisted_status = 'DELIVERED'
    when 'DELIVERED' then new.persisted_status = 'COMPLETED'
    when 'PRODUCTION_UNAVAILABLE' then new.persisted_status = 'CANCELED'
    else false
  end;

  if not transition_allowed then
    raise exception 'invalid application status transition: % -> %', old.persisted_status, new.persisted_status;
  end if;

  if new.persisted_status = 'IN_PRODUCTION' then
    select exists (
      select 1
      from public.physical_inspections pi
      where pi.application_id = new.id
        and (
          pi.outcome = 'NO_CHANGE'
          or (
            pi.outcome = 'CHANGE_REQUIRED'
            and exists (
              select 1
              from public.application_change_requests acr
              where acr.application_id = new.id and acr.status = 'APPROVED'
            )
          )
        )
    ) into production_cleared;

    if not production_cleared then
      raise exception 'IN_PRODUCTION requires completed inspection and approved changed terms';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.record_application_status_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  lifecycle_note text;
  status_changed boolean := false;
begin
  if tg_op = 'INSERT' then
    status_changed := true;
  elsif tg_op = 'UPDATE' then
    status_changed := new.persisted_status is distinct from old.persisted_status;
  end if;

  if status_changed then
    lifecycle_note := nullif(current_setting('mcm.lifecycle_note', true), '');
    insert into public.application_status_history (application_id, status, actor_id, note)
    values (new.id, new.persisted_status, auth.uid(), lifecycle_note);
  end if;
  return new;
end;
$$;

drop trigger if exists applications_record_status_change on public.applications;
create trigger applications_record_status_change
after insert or update of persisted_status on public.applications
for each row execute function public.record_application_status_change();

insert into public.application_status_history (
  application_id,
  status,
  actor_id,
  note,
  occurred_at
)
select a.id,
       'PENDING_PAYMENT'::public.application_status,
       null,
       'MIGRATION_BACKFILL_INITIAL_STATUS',
       a.created_at
from public.applications a
where not exists (
  select 1
  from public.application_status_history ash
  where ash.application_id = a.id
    and ash.status = 'PENDING_PAYMENT'
);

create or replace function public.apply_physical_inspection()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  application_terms jsonb;
  application_product_id uuid;
  current_status public.application_status;
begin
  select a.initial_terms, a.product_id, a.persisted_status
  into application_terms, application_product_id, current_status
  from public.applications a
  where a.id = new.application_id
  for update;

  if not found then
    raise exception 'application not found for physical inspection' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = new.inspected_by and p.role = 'OPERATOR'
  ) then
    raise exception 'physical inspection requires an operator' using errcode = '42501';
  end if;

  update public.applications
  set persisted_status = 'EXPERT_INSPECTION'
  where id = new.application_id and persisted_status = 'PRODUCT_RECEIVED';

  if new.outcome = 'CHANGE_REQUIRED' then
    if not public.is_valid_application_terms(application_terms)
       or lower(application_terms->>'productId') <> application_product_id::text
       or lower(new.proposed_terms->>'productId') <> application_product_id::text then
      raise exception 'inspection terms must match the application product' using errcode = '23514';
    end if;

    insert into public.application_change_requests (
      application_id,
      inspection_id,
      reason,
      previous_terms,
      proposed_terms
    ) values (
      new.application_id,
      new.id,
      new.reason,
      application_terms,
      new.proposed_terms
    );
  end if;

  update public.applications
  set persisted_status = case new.outcome
      when 'NO_CHANGE' then 'PRODUCTION_READY'::public.application_status
      when 'CHANGE_REQUIRED' then 'CHANGE_APPROVAL_REQUIRED'::public.application_status
      else 'PRODUCTION_UNAVAILABLE'::public.application_status
    end,
    inspection_completed_at = new.inspected_at,
    final_terms = case
      when new.outcome = 'NO_CHANGE' then initial_terms
      else final_terms
    end
  where id = new.application_id and persisted_status = 'EXPERT_INSPECTION';

  if not found then
    raise exception 'physical inspection requires PRODUCT_RECEIVED or EXPERT_INSPECTION status';
  end if;
  return new;
end;
$$;


update public.applications a
set consents = '{"serviceAndPrivacyTermsAccepted":true,"aiEstimateNoticeAccepted":true,"inspectionChangeNoticeAccepted":true}'::jsonb
where a.consents = '{"demoTermsAccepted":true,"aiEstimateNoticeAccepted":true,"esgEstimateNoticeAccepted":true}'::jsonb
  and a.demo_progress_profile = 'PRIMARY_SCENARIO';

alter table public.applications
  alter column pickup_schedule set not null,
  drop constraint if exists applications_pickup_schedule_contract,
  drop constraint if exists applications_consents_contract;

alter table public.applications
  add constraint applications_pickup_schedule_contract check (
    jsonb_typeof(pickup_schedule) = 'object'
    and (pickup_schedule - array['requestedDate', 'timeWindow']) = '{}'::jsonb
    and pickup_schedule ? 'requestedDate'
    and jsonb_typeof(pickup_schedule->'requestedDate') = 'string'
    and pickup_schedule->>'requestedDate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    and pickup_schedule ? 'timeWindow'
    and jsonb_typeof(pickup_schedule->'timeWindow') = 'string'
    and length(trim(pickup_schedule->>'timeWindow')) > 0
    and length(trim(pickup_schedule->>'timeWindow')) <= 60
  ) not valid,
  add constraint applications_consents_contract check (
    consents = '{"serviceAndPrivacyTermsAccepted":true,"aiEstimateNoticeAccepted":true,"inspectionChangeNoticeAccepted":true}'::jsonb
  ) not valid;

alter table public.applications validate constraint applications_pickup_schedule_contract;
alter table public.applications validate constraint applications_consents_contract;

alter table public.physical_inspections
  add column if not exists proposed_terms jsonb;

update public.physical_inspections pi
set proposed_terms = acr.proposed_terms
from public.application_change_requests acr
where acr.inspection_id = pi.id
  and pi.outcome = 'CHANGE_REQUIRED'
  and pi.proposed_terms is null;

do $$
begin
  if exists (
    select 1
    from public.physical_inspections pi
    left join public.application_change_requests acr on acr.inspection_id = pi.id
    where pi.outcome = 'CHANGE_REQUIRED'
      and (pi.proposed_terms is null or acr.id is null)
  ) then
    raise exception 'CHANGE_REQUIRED backfill requires an existing change request with proposed terms';
  end if;

  if exists (
    select 1
    from public.physical_inspections pi
    left join public.profiles p on p.id = pi.inspected_by
    where p.id is null or p.role <> 'OPERATOR'
  ) then
    raise exception 'existing physical inspections require an OPERATOR profile';
  end if;
end;
$$;

alter table public.physical_inspections
  drop constraint if exists physical_inspections_reason_check,
  drop constraint if exists physical_inspections_reason_contract,
  drop constraint if exists physical_inspections_proposed_terms_contract;

alter table public.physical_inspections
  add constraint physical_inspections_reason_contract
    check (length(trim(reason)) between 1 and 1000) not valid,
  add constraint physical_inspections_proposed_terms_contract check (
    (outcome = 'CHANGE_REQUIRED' and public.is_valid_application_terms(proposed_terms))
    or (outcome <> 'CHANGE_REQUIRED' and proposed_terms is null)
  ) not valid;

alter table public.application_change_requests
  drop constraint if exists application_change_requests_previous_terms_contract,
  drop constraint if exists application_change_requests_proposed_terms_contract;

alter table public.application_change_requests
  add constraint application_change_requests_previous_terms_contract
    check (public.is_valid_application_terms(previous_terms)) not valid,
  add constraint application_change_requests_proposed_terms_contract
    check (public.is_valid_application_terms(proposed_terms)) not valid;

alter table public.physical_inspections validate constraint physical_inspections_reason_contract;
alter table public.physical_inspections validate constraint physical_inspections_proposed_terms_contract;
alter table public.application_change_requests validate constraint application_change_requests_previous_terms_contract;
alter table public.application_change_requests validate constraint application_change_requests_proposed_terms_contract;

do $$
begin
  if exists (
    select 1
    from public.esg_certificates ec
    join public.applications a on a.id = ec.application_id
    where a.persisted_status <> 'COMPLETED' or a.status_override is not null
  ) then
    raise exception 'existing certificate violates COMPLETED/no-override issuance rule';
  end if;
end;
$$;

create or replace function public.submit_physical_inspection(
  p_application_id uuid,
  p_outcome public.inspection_outcome,
  p_confirmed_reusable_material_rate integer,
  p_confirmed_reusable_area_cm2 integer,
  p_reason text,
  p_proposed_terms jsonb default null
)
returns table (
  inspection_id uuid,
  application_id uuid,
  inspection_outcome public.inspection_outcome,
  application_status public.application_status,
  change_request_id uuid,
  inspected_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_status public.application_status;
  application_product_id uuid;
  created_inspection_id uuid;
  created_change_request_id uuid;
  inspection_time timestamptz := clock_timestamp();
begin
  if auth.uid() is null or not public.is_operator() then
    raise exception 'operator role required' using errcode = '42501';
  end if;

  if p_outcome is null
     or p_confirmed_reusable_material_rate is null
     or p_confirmed_reusable_material_rate not between 0 and 100
     or p_confirmed_reusable_area_cm2 is null
     or p_confirmed_reusable_area_cm2 < 0
     or p_reason is null
     or length(trim(p_reason)) not between 1 and 1000 then
    raise exception 'invalid physical inspection payload' using errcode = '22023';
  end if;

  if (p_outcome = 'CHANGE_REQUIRED' and not public.is_valid_application_terms(p_proposed_terms))
     or (p_outcome <> 'CHANGE_REQUIRED' and p_proposed_terms is not null) then
    raise exception 'proposed terms are required only for CHANGE_REQUIRED' using errcode = '22023';
  end if;

  select a.persisted_status, a.product_id
  into current_status, application_product_id
  from public.applications a
  where a.id = p_application_id
  for update;

  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;

  if current_status not in ('PRODUCT_RECEIVED', 'EXPERT_INSPECTION') then
    raise exception 'physical inspection requires PRODUCT_RECEIVED or EXPERT_INSPECTION status'
      using errcode = '23514';
  end if;

  if p_outcome = 'CHANGE_REQUIRED'
     and lower(p_proposed_terms->>'productId') <> application_product_id::text then
    raise exception 'proposed terms must use the application product' using errcode = '23514';
  end if;

  insert into public.physical_inspections (
    application_id,
    outcome,
    confirmed_reusable_material_rate,
    confirmed_reusable_area_cm2,
    reason,
    proposed_terms,
    inspected_by,
    inspected_at
  ) values (
    p_application_id,
    p_outcome,
    p_confirmed_reusable_material_rate,
    p_confirmed_reusable_area_cm2,
    trim(p_reason),
    p_proposed_terms,
    auth.uid(),
    inspection_time
  )
  returning id into created_inspection_id;

  select acr.id
  into created_change_request_id
  from public.application_change_requests acr
  where acr.inspection_id = created_inspection_id;

  select a.persisted_status
  into current_status
  from public.applications a
  where a.id = p_application_id;

  return query
  select created_inspection_id,
         p_application_id,
         p_outcome,
         current_status,
         created_change_request_id,
         inspection_time;
end;
$$;

create or replace function public.advance_application_lifecycle(
  p_application_id uuid,
  p_target_status public.application_status,
  p_note text default null,
  p_tracking_number text default null,
  p_carrier_code text default null,
  p_carrier_name text default null
)
returns table (
  application_id uuid,
  previous_status public.application_status,
  application_status public.application_status,
  occurred_at timestamptz,
  shipment_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_status public.application_status;
  current_override public.application_status;
  changed_at timestamptz := now();
  changed_shipment_id uuid;
  normalized_note text;
  normalized_tracking_number text;
  normalized_carrier_code text;
  normalized_carrier_name text;
begin
  if auth.uid() is null or not public.is_operator() then
    raise exception 'operator role required' using errcode = '42501';
  end if;

  if p_target_status is null or p_target_status not in (
    'PICKUP_SCHEDULED',
    'PICKUP_IN_PROGRESS',
    'PRODUCT_RECEIVED',
    'EXPERT_INSPECTION',
    'IN_PRODUCTION',
    'QUALITY_CHECK',
    'SHIPPED',
    'DELIVERED',
    'COMPLETED',
    'PRODUCTION_UNAVAILABLE',
    'CANCELED'
  ) then
    raise exception 'unsupported lifecycle target status' using errcode = '22023';
  end if;

  normalized_note := case when p_note is null then null else trim(p_note) end;
  if normalized_note is not null and length(normalized_note) not between 1 and 500 then
    raise exception 'lifecycle note must contain 1 to 500 characters' using errcode = '22023';
  end if;

  normalized_tracking_number := case when p_tracking_number is null then null else trim(p_tracking_number) end;
  normalized_carrier_code := coalesce(nullif(trim(p_carrier_code), ''), 'MCM_REBORN_DEMO');
  normalized_carrier_name := coalesce(nullif(trim(p_carrier_name), ''), 'MCM RE:BORN Demo Logistics');

  if p_target_status = 'SHIPPED' then
    if normalized_tracking_number is null
       or length(normalized_tracking_number) not between 1 and 120
       or length(normalized_carrier_code) not between 1 and 40
       or length(normalized_carrier_name) not between 1 and 100 then
      raise exception 'SHIPPED requires valid tracking and carrier values' using errcode = '22023';
    end if;
  elsif p_tracking_number is not null or p_carrier_code is not null or p_carrier_name is not null then
    raise exception 'shipping fields are accepted only for SHIPPED' using errcode = '22023';
  end if;

  select a.persisted_status, a.status_override
  into current_status, current_override
  from public.applications a
  where a.id = p_application_id
  for update;

  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;

  if current_override is not null then
    raise exception 'application status override must be cleared before lifecycle commands'
      using errcode = '23514';
  end if;

  if p_target_status = current_status then
    raise exception 'lifecycle command target must be the next status'
      using errcode = '23514';
  end if;

  if p_target_status = 'PRODUCTION_UNAVAILABLE'
     and current_status not in ('IN_PRODUCTION', 'QUALITY_CHECK') then
    raise exception 'PRODUCTION_UNAVAILABLE requires IN_PRODUCTION or QUALITY_CHECK status'
      using errcode = '23514';
  end if;

  if p_target_status = 'CANCELED' and current_status <> 'PRODUCTION_UNAVAILABLE' then
    raise exception 'CANCELED lifecycle command requires PRODUCTION_UNAVAILABLE status'
      using errcode = '23514';
  end if;

  perform set_config('mcm.lifecycle_note', coalesce(normalized_note, ''), true);

  update public.applications a
  set persisted_status = p_target_status
  where a.id = p_application_id;

  perform set_config('mcm.lifecycle_note', '', true);

  -- Carrier allocation is optional during pickup. A preallocated shipment is
  -- kept in sync; SHIPPED creates/upserts the required tracked shipment.
  if p_target_status in ('PICKUP_SCHEDULED', 'PICKUP_IN_PROGRESS', 'PRODUCT_RECEIVED') then
    update public.mock_shipments ms
    set status = p_target_status::text,
        updated_at = now()
    where ms.application_id = p_application_id
    returning ms.id into changed_shipment_id;
  elsif p_target_status = 'SHIPPED' then
    insert into public.mock_shipments (
      application_id,
      carrier_code,
      carrier_name,
      tracking_number,
      status
    ) values (
      p_application_id,
      normalized_carrier_code,
      normalized_carrier_name,
      normalized_tracking_number,
      'SHIPPED'
    )
    on conflict (application_id) do update set
      carrier_code = excluded.carrier_code,
      carrier_name = excluded.carrier_name,
      tracking_number = excluded.tracking_number,
      status = excluded.status,
      updated_at = now()
    returning id into changed_shipment_id;
  elsif p_target_status = 'DELIVERED' then
    update public.mock_shipments ms
    set status = 'DELIVERED',
        updated_at = now()
    where ms.application_id = p_application_id
      and ms.status = 'SHIPPED'
    returning ms.id into changed_shipment_id;

    if not found then
      raise exception 'DELIVERED requires an existing SHIPPED shipment' using errcode = '23514';
    end if;
  end if;

  if changed_shipment_id is null then
    select ms.id
    into changed_shipment_id
    from public.mock_shipments ms
    where ms.application_id = p_application_id;
  end if;

  return query
  select p_application_id,
         current_status,
         p_target_status,
         changed_at,
         changed_shipment_id;
end;
$$;

create or replace function public.enforce_certificate_issuance_state()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  certificate_allowed boolean;
begin
  select a.persisted_status = 'COMPLETED' and a.status_override is null
  into certificate_allowed
  from public.applications a
  where a.id = new.application_id
  for share;

  if certificate_allowed is distinct from true then
    raise exception 'certificate issuance requires a completed application without a status override'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists esg_certificates_enforce_issuance_state on public.esg_certificates;
create trigger esg_certificates_enforce_issuance_state
before insert or update on public.esg_certificates
for each row execute function public.enforce_certificate_issuance_state();

create or replace function public.protect_issued_certificate_application_state()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (new.persisted_status <> 'COMPLETED' or new.status_override is not null)
     and exists (
       select 1
       from public.esg_certificates ec
       where ec.application_id = new.id
     ) then
    raise exception 'an issued certificate requires a completed application without a status override'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists applications_protect_issued_certificate_state on public.applications;
create trigger applications_protect_issued_certificate_state
before update of persisted_status, status_override on public.applications
for each row execute function public.protect_issued_certificate_application_state();

revoke insert, update, delete on public.physical_inspections from anon, authenticated;

revoke all on function public.submit_physical_inspection(
  uuid,
  public.inspection_outcome,
  integer,
  integer,
  text,
  jsonb
) from public, anon, authenticated;
grant execute on function public.submit_physical_inspection(
  uuid,
  public.inspection_outcome,
  integer,
  integer,
  text,
  jsonb
) to authenticated;

revoke all on function public.advance_application_lifecycle(
  uuid,
  public.application_status,
  text,
  text,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.advance_application_lifecycle(
  uuid,
  public.application_status,
  text,
  text,
  text,
  text
) to authenticated;

commit;
