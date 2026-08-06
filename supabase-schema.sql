-- MCM RE:BORN 2-week hackathon schema
-- Run in Supabase SQL Editor. All business values are demo-only.

create extension if not exists pgcrypto;

create type public.user_role as enum ('CUSTOMER', 'OPERATOR');
create type public.analysis_status as enum ('COMPLETED', 'FAILED');
create type public.analysis_mode_used as enum ('LIVE', 'FIXTURE', 'FIXTURE_FALLBACK');
create type public.application_status as enum (
  'PENDING_PAYMENT',
  'PENDING_APPROVAL',
  'APPROVED',
  'RECEIVING_PRODUCT',
  'PRODUCT_RECEIVED',
  'IN_PRODUCTION',
  'QUALITY_CHECK',
  'SHIPPED',
  'COMPLETED',
  'ADDITIONAL_REVIEW_REQUIRED',
  'AUTHENTICITY_REVIEW_REQUIRED',
  'PRODUCTION_UNAVAILABLE',
  'CANCELED'
);

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
  bucket text not null,
  path text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 6291456),
  purpose text not null check (purpose in ('SOURCE_PRODUCT', 'DAMAGE_CLOSEUP', 'INTERIOR', 'SERIAL')),
  upload_status text not null default 'PENDING' check (upload_status in ('PENDING', 'UPLOADED', 'FAILED')),
  created_at timestamptz not null default now(),
  unique (bucket, path)
);

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  status public.analysis_status not null,
  mode_used public.analysis_mode_used not null,
  source_category text not null,
  material_type text not null,
  condition_grade text not null check (condition_grade in ('A', 'B', 'C', 'D')),
  damage_severity integer not null check (damage_severity between 0 and 100),
  summary text not null,
  authenticity_signal text not null check (authenticity_signal in ('NOT_EVALUATED', 'REVIEW_REQUIRED')),
  reusable_rate integer not null check (reusable_rate between 0 and 100),
  reusable_area_cm2 integer not null check (reusable_area_cm2 >= 0),
  long_strip_available boolean not null default false,
  estimated_carbon_saving_kg numeric(10,2) not null default 0,
  methodology_version text not null default 'DEMO_LCA_V1',
  provider_name text not null,
  provider_model text not null,
  provider_request_id text,
  provider_result jsonb not null default '{}'::jsonb,
  damages jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);

create table public.analysis_images (
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  display_order integer not null default 0,
  primary key (analysis_id, media_asset_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null,
  description text not null,
  required_area_cm2 integer not null check (required_area_cm2 > 0),
  mock_price_krw integer not null check (mock_price_krw >= 0),
  dimensions jsonb not null,
  list_image jsonb not null,
  model_3d jsonb not null,
  option_groups jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint active_product_assets_present check (
    active = false or (
      coalesce(list_image->>'url', '') <> '' and
      coalesce(model_3d->>'url', '') <> '' and
      coalesce(model_3d->>'posterUrl', '') <> ''
    )
  )
);

create table public.analysis_recommendations (
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  eligible boolean not null,
  score integer not null check (score between 0 and 100),
  reason_codes jsonb not null default '[]'::jsonb,
  primary key (analysis_id, product_id)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  application_number text not null unique,
  customer_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid not null references public.analyses(id),
  product_id uuid not null references public.products(id),
  persisted_status public.application_status not null default 'PENDING_PAYMENT',
  status_override public.application_status,
  selected_options jsonb not null default '{}'::jsonb,
  shipping_address jsonb not null,
  consents jsonb not null,
  mock_price_krw integer not null check (mock_price_krw >= 0),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  approval_note text,
  progress_profile text not null default 'FAST_DEMO' check (progress_profile in ('FAST_DEMO', 'STATIC')),
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
  method text not null default 'DEMO_CARD',
  status text not null check (status in ('PAID', 'FAILED')),
  amount_krw integer not null check (amount_krw >= 0),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.mock_shipments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  carrier_code text not null default 'MCM_REBORN_DEMO',
  carrier_name text not null default 'MCM RE:BORN Demo Logistics',
  tracking_number text not null unique,
  created_at timestamptz not null default now()
);

create table public.esg_certificates (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  certificate_number text not null unique,
  verification_code text not null unique,
  payload jsonb not null,
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

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

create or replace function public.is_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'OPERATOR'
  );
$$;

alter table public.profiles enable row level security;
alter table public.media_assets enable row level security;
alter table public.analyses enable row level security;
alter table public.analysis_images enable row level security;
alter table public.products enable row level security;
alter table public.analysis_recommendations enable row level security;
alter table public.applications enable row level security;
alter table public.application_status_history enable row level security;
alter table public.mock_payments enable row level security;
alter table public.mock_shipments enable row level security;
alter table public.esg_certificates enable row level security;
alter table public.analytics_events enable row level security;
alter table public.idempotency_keys enable row level security;

create policy profiles_self_read on public.profiles
for select using (id = auth.uid() or public.is_operator());

create policy media_assets_owner_all on public.media_assets
for all using (owner_id = auth.uid() or public.is_operator())
with check (owner_id = auth.uid() or public.is_operator());

create policy analyses_owner_read on public.analyses
for select using (customer_id = auth.uid() or public.is_operator());

create policy analyses_owner_insert on public.analyses
for insert with check (customer_id = auth.uid());

create policy analysis_images_read on public.analysis_images
for select using (
  exists (
    select 1 from public.analyses a
    where a.id = analysis_id
      and (a.customer_id = auth.uid() or public.is_operator())
  )
);

create policy products_authenticated_read on public.products
for select to authenticated using (active = true or public.is_operator());

create policy recommendations_read on public.analysis_recommendations
for select using (
  exists (
    select 1 from public.analyses a
    where a.id = analysis_id
      and (a.customer_id = auth.uid() or public.is_operator())
  )
);

create policy applications_owner_read on public.applications
for select using (customer_id = auth.uid() or public.is_operator());

create policy applications_owner_insert on public.applications
for insert with check (customer_id = auth.uid());

create policy application_history_read on public.application_status_history
for select using (
  exists (
    select 1 from public.applications a
    where a.id = application_id
      and (a.customer_id = auth.uid() or public.is_operator())
  )
);

create policy payments_read on public.mock_payments
for select using (
  exists (
    select 1 from public.applications a
    where a.id = application_id
      and (a.customer_id = auth.uid() or public.is_operator())
  )
);

create policy shipments_read on public.mock_shipments
for select using (
  exists (
    select 1 from public.applications a
    where a.id = application_id
      and (a.customer_id = auth.uid() or public.is_operator())
  )
);

create policy certificates_read on public.esg_certificates
for select using (
  exists (
    select 1 from public.applications a
    where a.id = application_id
      and (a.customer_id = auth.uid() or public.is_operator())
  )
);

create policy analytics_insert on public.analytics_events
for insert with check (user_id is null or user_id = auth.uid());

create policy idempotency_owner on public.idempotency_keys
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Product seed: replace asset paths with the supplied GLB/glTF files.
insert into public.products (
  id, code, name, category, description, required_area_cm2, mock_price_krw,
  dimensions, list_image, model_3d, option_groups, active, sort_order
) values
(
  '10000000-0000-4000-8000-000000000001',
  'REBORN_POUCH',
  'RE:BORN 클러치 파우치',
  'CLUTCH_POUCH',
  '기존 가방의 패턴 원단을 넓게 살리는 클러치형 파우치입니다.',
  1000,
  280000,
  '{"widthMm":260,"heightMm":180,"depthMm":45}'::jsonb,
  '{"url":"/assets/products/reborn-pouch/list.webp","alt":"RE:BORN 클러치 파우치 전체 이미지","width":1200,"height":1500,"aspectRatio":"4:5"}'::jsonb,
  '{"format":"GLB","url":"/assets/models/reborn-pouch.glb","posterUrl":"/assets/products/reborn-pouch/poster.webp","environmentImageUrl":"/assets/3d/studio.hdr","cameraOrbit":"0deg 75deg 105%","cameraTarget":"0m 0m 0m","fieldOfView":"30deg","autoRotate":true,"availableVariants":[{"key":"BLACK_GOLD","label":"블랙·골드"},{"key":"BLACK_SILVER","label":"블랙·실버"}]}'::jsonb,
  '[{"key":"hardwareColor","label":"금속 색상","required":true,"type":"SELECT","options":[{"value":"GOLD","label":"골드","modelVariant":"BLACK_GOLD"},{"value":"SILVER","label":"실버","modelVariant":"BLACK_SILVER"}]},{"key":"initials","label":"이니셜","required":false,"type":"TEXT","maxLength":3}]'::jsonb,
  true,
  10
),
(
  '10000000-0000-4000-8000-000000000002',
  'REBORN_CARD_WALLET',
  'RE:BORN 카드지갑',
  'CARD_WALLET',
  '상태가 좋은 패턴 영역을 선별해 제작하는 소형 카드지갑입니다.',
  300,
  180000,
  '{"widthMm":105,"heightMm":75,"depthMm":8}'::jsonb,
  '{"url":"/assets/products/reborn-card-wallet/list.webp","alt":"RE:BORN 카드지갑 전체 이미지","width":1200,"height":1500,"aspectRatio":"4:5"}'::jsonb,
  '{"format":"GLB","url":"/assets/models/reborn-card-wallet.glb","posterUrl":"/assets/products/reborn-card-wallet/poster.webp","environmentImageUrl":"/assets/3d/studio.hdr","cameraOrbit":"20deg 75deg 110%","cameraTarget":"0m 0m 0m","fieldOfView":"28deg","autoRotate":true,"availableVariants":[{"key":"BLACK_GOLD","label":"블랙·골드"},{"key":"COGNAC_GOLD","label":"코냑·골드"}]}'::jsonb,
  '[{"key":"edgeColor","label":"엣지 색상","required":true,"type":"SELECT","options":[{"value":"BLACK","label":"블랙","modelVariant":"BLACK_GOLD"},{"value":"COGNAC","label":"코냑","modelVariant":"COGNAC_GOLD"}]},{"key":"initials","label":"이니셜","required":false,"type":"TEXT","maxLength":3}]'::jsonb,
  true,
  20
),
(
  '10000000-0000-4000-8000-000000000003',
  'REBORN_KEYRING',
  'RE:BORN 키링',
  'KEYRING',
  '작은 잔여 원단까지 활용하는 가죽 키링입니다.',
  80,
  90000,
  '{"widthMm":45,"heightMm":90,"depthMm":5}'::jsonb,
  '{"url":"/assets/products/reborn-keyring/list.webp","alt":"RE:BORN 키링 전체 이미지","width":1200,"height":1500,"aspectRatio":"4:5"}'::jsonb,
  '{"format":"GLB","url":"/assets/models/reborn-keyring.glb","posterUrl":"/assets/products/reborn-keyring/poster.webp","environmentImageUrl":"/assets/3d/studio.hdr","cameraOrbit":"0deg 75deg 115%","cameraTarget":"0m 0m 0m","fieldOfView":"25deg","autoRotate":true,"availableVariants":[{"key":"GOLD_RING","label":"골드 링"},{"key":"SILVER_RING","label":"실버 링"}]}'::jsonb,
  '[{"key":"ringColor","label":"링 색상","required":true,"type":"SELECT","options":[{"value":"GOLD","label":"골드","modelVariant":"GOLD_RING"},{"value":"SILVER","label":"실버","modelVariant":"SILVER_RING"}]}]'::jsonb,
  true,
  30
)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  required_area_cm2 = excluded.required_area_cm2,
  mock_price_krw = excluded.mock_price_krw,
  dimensions = excluded.dimensions,
  list_image = excluded.list_image,
  model_3d = excluded.model_3d,
  option_groups = excluded.option_groups,
  active = excluded.active,
  sort_order = excluded.sort_order;

-- Storage buckets are normally created in the Supabase dashboard or Storage API.
-- source-products: private, max file size 6MB, MIME image/jpeg,image/png,image/webp
-- catalog-assets: public, contains list images, posters, GLB/glTF and HDR assets
