-- Replace the exact-seven analysis input with the six directional bag views.
-- display_order 6 was the serial-number photo. Its analysis link is backed up
-- before removal; the media_assets row and private Storage object are retained.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.mcm_capture_six_view_backup_20260821 (
  analysis_id uuid primary key,
  media_asset_id uuid not null,
  display_order integer not null check (display_order = 6),
  backed_up_at timestamptz not null default now()
);
revoke all on private.mcm_capture_six_view_backup_20260821
from public, anon, authenticated;

do $$
begin
  if exists (
    select 1
    from private.mcm_capture_six_view_backup_20260821
  ) then
    raise exception 'capture six-view migration requires an empty private backup table';
  end if;
end;
$$;

lock table public.analysis_images in share row exclusive mode;

insert into private.mcm_capture_six_view_backup_20260821 (
  analysis_id,
  media_asset_id,
  display_order
)
select
  ai.analysis_id,
  ai.media_asset_id,
  ai.display_order
from public.analysis_images ai
where ai.display_order = 6;

delete from public.analysis_images
where display_order = 6;

alter table public.analysis_images
  drop constraint if exists analysis_images_display_order_check;

alter table public.analysis_images
  add constraint analysis_images_display_order_check
  check (display_order between 0 and 5);

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
      and ma.upload_status = 'UPLOADED'
      and (
        (ai.display_order between 0 and 1 and ma.purpose = 'SOURCE_FRONT')
        or (ai.display_order between 2 and 5 and ma.purpose = 'SOURCE_SIDE')
      );

    if uploaded_photo_count <> 6 then
      raise exception 'analysis requires exactly 6 uploaded owner photos with directional purposes';
    end if;
  end if;
  return new;
end;
$$;

commit;
