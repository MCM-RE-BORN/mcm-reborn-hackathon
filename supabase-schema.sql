-- MCM RE:BORN service-demo MVP database contract v2.0.0 (BREAKING)
-- Fresh-install schema for Supabase/PostgreSQL. AI values are estimates until
-- the post-order physical inspection has been completed.

create extension if not exists pgcrypto;

create type public.user_role as enum ('CUSTOMER', 'OPERATOR');
create type public.upload_purpose as enum ('SOURCE_FRONT', 'SOURCE_SIDE', 'INTERIOR', 'ENGRAVING');
create type public.analysis_status as enum ('RECEIVED', 'ANALYZING', 'SUPPLEMENT_REQUIRED', 'COMPLETED', 'FAILED');
create type public.analysis_mode_used as enum ('DEMO_FIXTURE', 'SEEDED_ESTIMATE', 'LIVE');
create type public.authenticity_precheck_status as enum ('ORDER_ELIGIBLE', 'INELIGIBLE');
create type public.application_status as enum (
  'PENDING_PAYMENT',
  'ORDER_PLACED',
  'PICKUP_SCHEDULED',
  'PICKUP_IN_PROGRESS',
  'PRODUCT_RECEIVED',
  'EXPERT_INSPECTION',
  'PRODUCTION_READY',
  'CHANGE_APPROVAL_REQUIRED',
  'IN_PRODUCTION',
  'QUALITY_CHECK',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'PRODUCTION_UNAVAILABLE',
  'CANCELED'
);
create type public.inspection_outcome as enum ('NO_CHANGE', 'CHANGE_REQUIRED', 'PRODUCTION_UNAVAILABLE');
create type public.change_request_status as enum ('PENDING', 'APPROVED', 'REJECTED');

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

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'CUSTOMER',
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null default 'source-products' check (bucket = 'source-products'),
  path text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  purpose public.upload_purpose not null,
  upload_status text not null default 'PENDING' check (upload_status in ('PENDING', 'UPLOADED', 'FAILED')),
  created_at timestamptz not null default now(),
  constraint media_assets_owner_path check (
    path like owner_id::text || '/%'
    and path !~ '(^|/)\.{1,2}(/|$)'
  ),
  unique (bucket, path)
);

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  status public.analysis_status not null default 'RECEIVED',
  mode_used public.analysis_mode_used not null,
  category text not null,
  purchase_year integer not null check (purchase_year between 1976 and 2100),
  use_duration text not null check (length(trim(use_duration)) > 0),
  desired_use text not null check (length(trim(desired_use)) > 0),
  serial_number text,
  condition_note text,
  source_category text,
  material_type text,
  condition_grade text check (condition_grade in ('A', 'B', 'C', 'D')),
  damage_severity integer check (damage_severity between 0 and 100),
  summary text,
  estimate_confidence_percent integer check (estimate_confidence_percent between 0 and 100),
  estimate_notice text check (estimate_notice is null or length(trim(estimate_notice)) > 0),
  authenticity_precheck_status public.authenticity_precheck_status,
  authenticity_estimate_percent integer check (authenticity_estimate_percent between 0 and 100),
  authenticity_notice text check (authenticity_notice is null or length(trim(authenticity_notice)) > 0),
  estimated_reusable_material_rate integer check (estimated_reusable_material_rate between 0 and 100),
  estimated_reusable_area_cm2 integer check (estimated_reusable_area_cm2 >= 0),
  long_strip_available boolean,
  estimated_carbon_saving_kg numeric(10,2) check (estimated_carbon_saving_kg >= 0),
  methodology_version text check (methodology_version is null or methodology_version = 'DEMO_LCA_V2'),
  provider_name text,
  provider_model text,
  provider_request_id text,
  provider_result jsonb not null default '{}'::jsonb,
  damages jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint completed_analysis_payload_required check (
    status <> 'COMPLETED'
    or (
      source_category is not null
      and material_type is not null
      and condition_grade is not null
      and damage_severity is not null
      and summary is not null
      and estimate_confidence_percent is not null
      and estimate_notice is not null
      and authenticity_precheck_status is not null
      and authenticity_estimate_percent is not null
      and authenticity_notice is not null
      and estimated_reusable_material_rate is not null
      and estimated_reusable_area_cm2 is not null
      and long_strip_available is not null
      and estimated_carbon_saving_kg is not null
      and methodology_version is not null
      and provider_name is not null
      and provider_model is not null
      and completed_at is not null
    )
  )
);

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

create table public.analysis_images (
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  display_order integer not null
    constraint analysis_images_display_order_check check (display_order between 0 and 6),
  primary key (analysis_id, media_asset_id),
  unique (analysis_id, display_order)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('REBORN_PASSPORT_WALLET', 'REBORN_CARD_WALLET', 'REBORN_NAME_TAG', 'REBORN_KEYRING')),
  name text not null,
  category text not null check (category in ('PASSPORT_WALLET', 'CARD_WALLET', 'NAME_TAG', 'KEYRING')),
  description text not null,
  required_area_cm2 integer not null check (required_area_cm2 > 0),
  mock_price_krw integer not null check (mock_price_krw >= 0),
  estimated_duration text not null,
  dimensions jsonb not null,
  list_image jsonb not null,
  model_3d jsonb not null,
  model_3d_ready boolean not null default false,
  option_groups jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.analysis_recommendations (
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  eligible boolean not null,
  score integer not null check (score between 0 and 100),
  estimated_reusable_material_rate integer not null
    check (estimated_reusable_material_rate between 0 and 100),
  reason_codes jsonb not null default '[]'::jsonb,
  primary key (analysis_id, product_id)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  application_number text not null unique check (application_number ~ '^RB-[0-9]{8}-[0-9]{4}$'),
  customer_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid not null references public.analyses(id),
  product_id uuid not null references public.products(id),
  persisted_status public.application_status not null default 'PENDING_PAYMENT',
  status_override public.application_status
    check (status_override is null or status_override in ('PRODUCTION_UNAVAILABLE', 'CANCELED')),
  selected_options jsonb not null default '{}'::jsonb,
  shipping_address jsonb not null,
  pickup_schedule jsonb not null,
  consents jsonb not null,
  initial_terms jsonb not null,
  final_terms jsonb,
  inspection_completed_at timestamptz,
  demo_progress_profile text not null default 'PRIMARY_SCENARIO'
    check (demo_progress_profile in ('PRIMARY_SCENARIO', 'STATIC')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_pickup_schedule_contract check (
    jsonb_typeof(pickup_schedule) = 'object'
    and (pickup_schedule - array['requestedDate', 'timeWindow']) = '{}'::jsonb
    and pickup_schedule ? 'requestedDate'
    and jsonb_typeof(pickup_schedule->'requestedDate') = 'string'
    and pickup_schedule->>'requestedDate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    and pickup_schedule ? 'timeWindow'
    and jsonb_typeof(pickup_schedule->'timeWindow') = 'string'
    and length(trim(pickup_schedule->>'timeWindow')) > 0
    and length(trim(pickup_schedule->>'timeWindow')) <= 60
  ),
  constraint applications_consents_contract check (
    consents = '{"serviceAndPrivacyTermsAccepted":true,"aiEstimateNoticeAccepted":true,"inspectionChangeNoticeAccepted":true}'::jsonb
  ),
  constraint applications_initial_terms_contract check (
    public.is_valid_application_terms(initial_terms)
    and lower(initial_terms->>'productId') = product_id::text
  ),
  constraint applications_final_terms_contract check (
    final_terms is null
    or (
      public.is_valid_application_terms(final_terms)
      and lower(final_terms->>'productId') = product_id::text
    )
  ),
  constraint applications_analysis_id_unique unique (analysis_id)
);

create table public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  status public.application_status not null,
  actor_id uuid references auth.users(id),
  note text,
  occurred_at timestamptz not null default now()
);

create table public.mock_payments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  transaction_id text not null unique,
  method text not null default 'DEMO_CARD' check (method = 'DEMO_CARD'),
  status text not null check (status in ('PAID', 'FAILED')),
  amount_krw integer not null check (amount_krw >= 0),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.physical_inspections (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  outcome public.inspection_outcome not null,
  confirmed_reusable_material_rate integer not null check (confirmed_reusable_material_rate between 0 and 100),
  confirmed_reusable_area_cm2 integer not null check (confirmed_reusable_area_cm2 >= 0),
  reason text not null check (length(trim(reason)) between 1 and 1000),
  proposed_terms jsonb,
  inspected_by uuid not null references auth.users(id),
  inspected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint physical_inspections_proposed_terms_contract check (
    (outcome = 'CHANGE_REQUIRED' and public.is_valid_application_terms(proposed_terms))
    or (outcome <> 'CHANGE_REQUIRED' and proposed_terms is null)
  )
);

create table public.application_change_requests (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  inspection_id uuid not null unique references public.physical_inspections(id) on delete cascade,
  status public.change_request_status not null default 'PENDING',
  reason text not null check (length(trim(reason)) > 0),
  previous_terms jsonb not null,
  proposed_terms jsonb not null,
  responded_by uuid references auth.users(id),
  response_reason text,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint change_response_consistency check (
    (status = 'PENDING' and responded_at is null)
    or (status in ('APPROVED', 'REJECTED') and responded_at is not null)
  ),
  constraint application_change_requests_previous_terms_contract
    check (public.is_valid_application_terms(previous_terms)),
  constraint application_change_requests_proposed_terms_contract
    check (public.is_valid_application_terms(proposed_terms))
);

create table public.mock_shipments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  carrier_code text not null default 'MCM_REBORN_DEMO',
  carrier_name text not null default 'MCM RE:BORN Demo Logistics',
  tracking_number text not null unique,
  status text not null check (status in ('PICKUP_SCHEDULED', 'PICKUP_IN_PROGRESS', 'PRODUCT_RECEIVED', 'SHIPPED', 'DELIVERED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.esg_certificates (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  certificate_number text not null unique,
  verification_code text not null unique,
  payload jsonb not null check (payload->>'methodologyVersion' = 'DEMO_LCA_V2'),
  issued_at timestamptz not null default now()
);

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  session_id uuid not null,
  event_name text not null,
  analysis_id uuid references public.analyses(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  constraint analytics_events_event_name_check check (event_name in (
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
  ))
);

create table public.idempotency_keys (
  key text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null,
  resource_id uuid,
  request_hash text not null,
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index analyses_customer_created_idx on public.analyses(customer_id, created_at desc);
create index applications_customer_created_idx on public.applications(customer_id, created_at desc);
create index applications_status_created_idx on public.applications(persisted_status, created_at desc);
create index application_status_history_idx on public.application_status_history(application_id, occurred_at);
create index analytics_events_name_time_idx on public.analytics_events(event_name, occurred_at desc);
create index analytics_events_user_received_idx on public.analytics_events(user_id, received_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger applications_set_updated_at before update on public.applications
for each row execute function public.set_updated_at();
create trigger application_change_requests_set_updated_at before update on public.application_change_requests
for each row execute function public.set_updated_at();
create trigger mock_shipments_set_updated_at before update on public.mock_shipments
for each row execute function public.set_updated_at();

create or replace function public.enforce_analysis_photo_contract()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  uploaded_photo_count integer;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'RECEIVED' then
      raise exception 'new analysis must start at RECEIVED';
    end if;
    return new;
  end if;

  if new.status in ('ANALYZING', 'COMPLETED')
     and new.status is distinct from old.status then
    select count(*)
    into uploaded_photo_count
    from public.analysis_images ai
    join public.media_assets ma on ma.id = ai.media_asset_id
    where ai.analysis_id = new.id
      and ma.owner_id = new.customer_id
      and ma.upload_status = 'UPLOADED';

    if uploaded_photo_count <> 7 then
      raise exception 'analysis requires exactly 7 uploaded owner photos';
    end if;
  end if;
  return new;
end;
$$;

create trigger analyses_enforce_photo_contract
before insert or update of status on public.analyses
for each row execute function public.enforce_analysis_photo_contract();

create or replace function public.is_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'OPERATOR'
  );
$$;

-- v2 state-machine guard. A rejected change cancels the order. Production may
-- start only after physical inspection and, when terms changed, customer approval.
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

create trigger applications_enforce_transition
before update of persisted_status on public.applications
for each row execute function public.enforce_application_transition();

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

create trigger applications_record_status_change
after insert or update of persisted_status on public.applications
for each row execute function public.record_application_status_change();

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

create trigger mock_payments_apply_success
after insert or update of status on public.mock_payments
for each row execute function public.apply_successful_mock_payment();

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

create trigger physical_inspections_apply_result
after insert on public.physical_inspections
for each row execute function public.apply_physical_inspection();

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
    on conflict on constraint mock_shipments_application_id_key do update set
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

create or replace function public.prepare_change_request_decision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if old.status <> 'PENDING' or new.status not in ('APPROVED', 'REJECTED') then
      raise exception 'change request can be decided once from PENDING';
    end if;
    if (new.application_id, new.inspection_id, new.reason, new.previous_terms, new.proposed_terms)
       is distinct from
       (old.application_id, old.inspection_id, old.reason, old.previous_terms, old.proposed_terms) then
      raise exception 'customer decision cannot alter proposed terms';
    end if;
    new.responded_by = auth.uid();
    new.responded_at = now();
  end if;
  return new;
end;
$$;

create trigger application_change_requests_prepare_decision
before update on public.application_change_requests
for each row execute function public.prepare_change_request_decision();

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

create trigger application_change_requests_apply_decision
after update on public.application_change_requests
for each row execute function public.apply_change_request_decision();

revoke all on function public.apply_change_request_decision()
from public, anon, authenticated;

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

create trigger applications_protect_issued_certificate_state
before update of persisted_status, status_override on public.applications
for each row execute function public.protect_issued_certificate_application_state();

alter table public.profiles enable row level security;
alter table public.media_assets enable row level security;
alter table public.analyses enable row level security;
alter table public.analysis_external_ai_consents enable row level security;
alter table public.analysis_images enable row level security;
alter table public.products enable row level security;
alter table public.analysis_recommendations enable row level security;
alter table public.applications enable row level security;
alter table public.application_status_history enable row level security;
alter table public.mock_payments enable row level security;
alter table public.physical_inspections enable row level security;
alter table public.application_change_requests enable row level security;
alter table public.mock_shipments enable row level security;
alter table public.esg_certificates enable row level security;
alter table public.analytics_events enable row level security;
alter table public.idempotency_keys enable row level security;

create policy profiles_self_or_operator_read on public.profiles for select
using (id = auth.uid() or public.is_operator());
create policy products_public_read on public.products for select using (active = true or public.is_operator());
create policy media_assets_owner_read on public.media_assets for select
using (owner_id = auth.uid() or public.is_operator());
create policy analyses_owner_read on public.analyses for select
using (customer_id = auth.uid() or public.is_operator());
create policy analysis_external_ai_consents_owner_read
on public.analysis_external_ai_consents for select to authenticated
using (customer_id = auth.uid());
create policy applications_owner_read on public.applications for select
using (customer_id = auth.uid() or public.is_operator());
create policy application_history_owner_read on public.application_status_history for select
using (exists (select 1 from public.applications a where a.id = application_id and (a.customer_id = auth.uid() or public.is_operator())));
create policy payments_owner_read on public.mock_payments for select
using (exists (select 1 from public.applications a where a.id = application_id and (a.customer_id = auth.uid() or public.is_operator())));
create policy inspections_owner_read on public.physical_inspections for select
using (exists (select 1 from public.applications a where a.id = application_id and (a.customer_id = auth.uid() or public.is_operator())));
create policy change_requests_owner_read on public.application_change_requests for select
using (exists (select 1 from public.applications a where a.id = application_id and (a.customer_id = auth.uid() or public.is_operator())));
create policy shipments_owner_read on public.mock_shipments for select
using (exists (select 1 from public.applications a where a.id = application_id and (a.customer_id = auth.uid() or public.is_operator())));
create policy certificates_owner_read on public.esg_certificates for select
using (exists (select 1 from public.applications a where a.id = application_id and (a.customer_id = auth.uid() or public.is_operator())));
create policy inspections_operator_insert on public.physical_inspections for insert
with check (public.is_operator());
create policy change_requests_operator_insert on public.application_change_requests for insert
with check (public.is_operator());
create policy change_requests_customer_decide on public.application_change_requests for update
using (
  status = 'PENDING'
  and exists (
    select 1
    from public.applications a
    where a.id = application_id and a.customer_id = auth.uid()
  )
)
with check (status in ('APPROVED', 'REJECTED'));

revoke insert, update, delete on public.analyses, public.analysis_images,
  public.analysis_recommendations, public.applications, public.application_status_history,
  public.mock_payments, public.mock_shipments, public.esg_certificates,
  public.idempotency_keys from anon, authenticated;
revoke all on public.analysis_external_ai_consents
from public, anon, authenticated;
revoke all on public.analysis_external_ai_consents from service_role;
grant select on public.analysis_external_ai_consents to authenticated;
grant select, insert on public.analysis_external_ai_consents to service_role;
grant update (analysis_id) on public.analysis_external_ai_consents to service_role;
revoke insert, update, delete on public.physical_inspections from anon, authenticated;
revoke insert, update, delete on public.application_change_requests from anon, authenticated;
revoke insert on public.analytics_events
from public, anon, authenticated, service_role;
grant update (status, response_reason)
  on public.application_change_requests to authenticated;

revoke all on function public.enforce_external_ai_consent_analysis_owner()
from public, anon, authenticated;
revoke all on function public.can_delete_pending_source_product(text, text)
from public, anon, authenticated;
grant execute on function public.can_delete_pending_source_product(text, text)
to authenticated;
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

insert into public.products (
  id, code, name, category, description, required_area_cm2, mock_price_krw,
  estimated_duration, dimensions, list_image, model_3d, model_3d_ready,
  option_groups, sort_order
) values
(
  '10000000-0000-4000-8000-000000000001', 'REBORN_PASSPORT_WALLET', 'RE:BORN 여권지갑',
  'PASSPORT_WALLET', 'MCM 비세토스 패턴을 살린 여권지갑입니다.', 850, 180000, '3~4주',
  '{"widthMm":110,"heightMm":145,"depthMm":12}'::jsonb,
  '{"url":"/assets/mvp-beta/recommendation-passport-wallet.png","alt":"RE:BORN 여권지갑","width":250,"height":271,"aspectRatio":"250:271"}'::jsonb,
  '{"format":"GLB","url":"/assets/models/passport-wallet.glb","posterUrl":"/assets/products/passport-wallet/poster.webp","environmentImageUrl":"/assets/3d/studio.hdr","cameraOrbit":"0deg 75deg 105%","cameraTarget":"0m 0m 0m","fieldOfView":"30deg","autoRotate":true,"availableVariants":[{"key":"COGNAC_GOLD","label":"코냑·골드"}]}'::jsonb,
  false,
  '[{"key":"edgeColor","label":"엣지 색상","required":true,"type":"SELECT","options":[{"value":"COGNAC","label":"코냑","modelVariant":"COGNAC_GOLD"}]},{"key":"initials","label":"이니셜","required":false,"type":"TEXT","maxLength":3}]'::jsonb, 1
),
(
  '10000000-0000-4000-8000-000000000002', 'REBORN_CARD_WALLET', 'RE:BORN 카드지갑',
  'CARD_WALLET', '상태가 좋은 패턴 영역을 선별한 카드지갑입니다.', 300, 150000, '2~3주',
  '{"widthMm":105,"heightMm":75,"depthMm":8}'::jsonb,
  '{"url":"/assets/mvp-beta/recommendation-card-holder.png","alt":"RE:BORN 카드지갑","width":250,"height":271,"aspectRatio":"250:271"}'::jsonb,
  '{"format":"GLB","url":"/assets/models/card-wallet.glb","posterUrl":"/assets/products/card-wallet/poster.webp","environmentImageUrl":"/assets/3d/studio.hdr","cameraOrbit":"20deg 75deg 110%","cameraTarget":"0m 0m 0m","fieldOfView":"28deg","autoRotate":true,"availableVariants":[{"key":"COGNAC_GOLD","label":"코냑·골드"}]}'::jsonb,
  false,
  '[]'::jsonb, 2
),
(
  '10000000-0000-4000-8000-000000000003', 'REBORN_NAME_TAG', 'RE:BORN 캐리어 네임택',
  'NAME_TAG', '잔여 패턴 소재를 활용한 캐리어 네임택입니다.', 180, 95000, '약 2주',
  '{"widthMm":70,"heightMm":110,"depthMm":6}'::jsonb,
  '{"url":"/assets/mvp-beta/recommendation-luggage-name-tag-v2.webp","alt":"RE:BORN 캐리어 네임택","width":600,"height":600,"aspectRatio":"1:1"}'::jsonb,
  '{"format":"GLB","url":"/assets/models/name-tag.glb","posterUrl":"/assets/products/name-tag/poster.webp","environmentImageUrl":"/assets/3d/studio.hdr","cameraOrbit":"0deg 75deg 110%","cameraTarget":"0m 0m 0m","fieldOfView":"28deg","autoRotate":true,"availableVariants":[{"key":"GOLD","label":"골드"}]}'::jsonb,
  false,
  '[]'::jsonb, 3
),
(
  '10000000-0000-4000-8000-000000000004', 'REBORN_KEYRING', 'RE:BORN 키링',
  'KEYRING', '작은 잔여 소재까지 활용한 키링입니다.', 80, 75000, '1~2주',
  '{"widthMm":45,"heightMm":90,"depthMm":5}'::jsonb,
  '{"url":"/assets/mvp-beta/recommendation-keyring-v2.webp","alt":"RE:BORN 키링","width":600,"height":600,"aspectRatio":"1:1"}'::jsonb,
  '{"format":"GLB","url":"/assets/models/keyring.glb","posterUrl":"/assets/products/keyring/poster.webp","environmentImageUrl":"/assets/3d/studio.hdr","cameraOrbit":"0deg 75deg 115%","cameraTarget":"0m 0m 0m","fieldOfView":"25deg","autoRotate":true,"availableVariants":[{"key":"GOLD_RING","label":"골드 링"}]}'::jsonb,
  false,
  '[]'::jsonb, 4
)
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  required_area_cm2 = excluded.required_area_cm2,
  mock_price_krw = excluded.mock_price_krw,
  estimated_duration = excluded.estimated_duration,
  dimensions = excluded.dimensions,
  list_image = excluded.list_image,
  model_3d = excluded.model_3d,
  model_3d_ready = excluded.model_3d_ready,
  option_groups = excluded.option_groups,
  sort_order = excluded.sort_order,
  active = true;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('source-products', 'source-products', false, 10485760, array['image/jpeg', 'image/png']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists source_products_insert_own_folder on storage.objects;
drop policy if exists source_products_select_own_folder on storage.objects;
drop policy if exists source_products_delete_own_folder on storage.objects;

create policy source_products_insert_own_folder on storage.objects for insert to authenticated
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
create policy source_products_select_own_folder on storage.objects for select to authenticated
using (bucket_id = 'source-products' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_operator()));
create policy source_products_delete_own_folder on storage.objects for delete to authenticated
using (
  bucket_id = 'source-products'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.can_delete_pending_source_product(bucket_id, name)
);
