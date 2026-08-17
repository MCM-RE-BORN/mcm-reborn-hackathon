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

create table public.analysis_images (
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  display_order integer not null check (display_order between 0 and 3),
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
  consents jsonb not null,
  initial_terms jsonb not null,
  final_terms jsonb,
  inspection_completed_at timestamptz,
  demo_progress_profile text not null default 'PRIMARY_SCENARIO'
    check (demo_progress_profile in ('PRIMARY_SCENARIO', 'STATIC')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
  reason text not null check (length(trim(reason)) > 0),
  inspected_by uuid not null references auth.users(id),
  inspected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
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
  )
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
  received_at timestamptz not null default now()
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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
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

    if uploaded_photo_count not between 3 and 4 then
      raise exception 'analysis requires 3 to 4 uploaded owner photos';
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
set search_path = public
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
              select 1 from public.application_change_requests acr
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
set search_path = public
as $$
begin
  if new.persisted_status is distinct from old.persisted_status then
    insert into public.application_status_history (application_id, status, actor_id)
    values (new.id, new.persisted_status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger applications_record_status_change
after update of persisted_status on public.applications
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
set search_path = public
as $$
begin
  update public.applications
  set persisted_status = 'EXPERT_INSPECTION'
  where id = new.application_id and persisted_status = 'PRODUCT_RECEIVED';

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
before update of status on public.application_change_requests
for each row execute function public.prepare_change_request_decision();

create or replace function public.apply_change_request_decision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'PENDING' and new.status in ('APPROVED', 'REJECTED') then
    update public.applications
    set persisted_status = case new.status
        when 'APPROVED' then 'PRODUCTION_READY'::public.application_status
        else 'CANCELED'::public.application_status
      end,
      final_terms = case when new.status = 'APPROVED' then new.proposed_terms else final_terms end
    where id = new.application_id and persisted_status = 'CHANGE_APPROVAL_REQUIRED';

    if not found then
      raise exception 'change decision requires CHANGE_APPROVAL_REQUIRED status';
    end if;
  end if;
  return new;
end;
$$;

create trigger application_change_requests_apply_decision
after update of status on public.application_change_requests
for each row execute function public.apply_change_request_decision();

alter table public.profiles enable row level security;
alter table public.media_assets enable row level security;
alter table public.analyses enable row level security;
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
using (exists (select 1 from public.applications a where a.id = application_id and a.customer_id = auth.uid()))
with check (status in ('APPROVED', 'REJECTED'));
create policy analytics_events_insert on public.analytics_events for insert
with check (user_id is null or user_id = auth.uid());

revoke insert, update, delete on public.analyses, public.analysis_images,
  public.analysis_recommendations, public.applications, public.application_status_history,
  public.mock_payments, public.mock_shipments, public.esg_certificates,
  public.idempotency_keys from anon, authenticated;
revoke update, delete on public.physical_inspections from anon, authenticated;
revoke insert, update, delete on public.application_change_requests from anon, authenticated;
grant update (status, response_reason)
  on public.application_change_requests to authenticated;

insert into public.products (
  id, code, name, category, description, required_area_cm2, mock_price_krw,
  estimated_duration, dimensions, list_image, model_3d, option_groups, sort_order
) values
(
  '10000000-0000-4000-8000-000000000001', 'REBORN_PASSPORT_WALLET', 'RE:BORN 여권지갑',
  'PASSPORT_WALLET', 'MCM 비세토스 패턴을 살린 여권지갑입니다.', 850, 180000, '3~4주',
  '{"widthMm":110,"heightMm":145,"depthMm":12}'::jsonb,
  '{"url":"/assets/mvp-beta/recommendation-passport-wallet.png","alt":"RE:BORN 여권지갑","width":250,"height":271,"aspectRatio":"250:271"}'::jsonb,
  '{"format":"GLB","url":"/assets/models/passport-wallet.glb","posterUrl":"/assets/products/passport-wallet/poster.webp"}'::jsonb,
  '[]'::jsonb, 1
),
(
  '10000000-0000-4000-8000-000000000002', 'REBORN_CARD_WALLET', 'RE:BORN 카드지갑',
  'CARD_WALLET', '상태가 좋은 패턴 영역을 선별한 카드지갑입니다.', 300, 150000, '2~3주',
  '{"widthMm":105,"heightMm":75,"depthMm":8}'::jsonb,
  '{"url":"/assets/mvp-beta/recommendation-card-holder.png","alt":"RE:BORN 카드지갑","width":250,"height":271,"aspectRatio":"250:271"}'::jsonb,
  '{"format":"GLB","url":"/assets/models/card-wallet.glb","posterUrl":"/assets/products/card-wallet/poster.webp"}'::jsonb,
  '[]'::jsonb, 2
),
(
  '10000000-0000-4000-8000-000000000003', 'REBORN_NAME_TAG', 'RE:BORN 캐리어 네임택',
  'NAME_TAG', '잔여 패턴 소재를 활용한 캐리어 네임택입니다.', 180, 95000, '약 2주',
  '{"widthMm":70,"heightMm":110,"depthMm":6}'::jsonb,
  '{"url":"/assets/mvp-beta/recommendation-luggage-name-tag-v2.webp","alt":"RE:BORN 캐리어 네임택","width":600,"height":600,"aspectRatio":"1:1"}'::jsonb,
  '{"format":"GLB","url":"/assets/models/name-tag.glb","posterUrl":"/assets/products/name-tag/poster.webp"}'::jsonb,
  '[]'::jsonb, 3
),
(
  '10000000-0000-4000-8000-000000000004', 'REBORN_KEYRING', 'RE:BORN 키링',
  'KEYRING', '작은 잔여 소재까지 활용한 키링입니다.', 80, 75000, '1~2주',
  '{"widthMm":45,"heightMm":90,"depthMm":5}'::jsonb,
  '{"url":"/assets/mvp-beta/recommendation-keyring-v2.webp","alt":"RE:BORN 키링","width":600,"height":600,"aspectRatio":"1:1"}'::jsonb,
  '{"format":"GLB","url":"/assets/models/keyring.glb","posterUrl":"/assets/products/keyring/poster.webp"}'::jsonb,
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
);
create policy source_products_select_own_folder on storage.objects for select to authenticated
using (bucket_id = 'source-products' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_operator()));
create policy source_products_delete_own_folder on storage.objects for delete to authenticated
using (bucket_id = 'source-products' and (storage.foldername(name))[1] = auth.uid()::text);
