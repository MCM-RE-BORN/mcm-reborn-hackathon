-- Structural rollback for 202608210008_capture_six_views.sql.
-- Stop writes first. The backed-up serial-photo links are restored without
-- fabricating assets. Six-view analyses created after migration remain
-- historical, while subsequent state transitions again require seven photos.

begin;

do $$
begin
  if to_regclass('private.mcm_capture_six_view_backup_20260821') is null then
    raise exception 'capture six-view rollback requires the private serial-photo backup';
  end if;
end;
$$;

lock table public.analysis_images in share row exclusive mode;

do $$
begin
  if exists (
    select 1
    from private.mcm_capture_six_view_backup_20260821 backup
    left join public.analyses a on a.id = backup.analysis_id
    left join public.media_assets ma on ma.id = backup.media_asset_id
    where a.id is null or ma.id is null
  ) then
    raise exception 'rollback requires manual handling of deleted analyses or serial-photo assets';
  end if;

  if exists (
    select 1
    from private.mcm_capture_six_view_backup_20260821 backup
    join public.analysis_images ai
      on ai.analysis_id = backup.analysis_id
     and (
       ai.display_order = backup.display_order
       or ai.media_asset_id = backup.media_asset_id
     )
  ) then
    raise exception 'rollback requires manual handling of conflicting serial-photo links';
  end if;
end;
$$;

alter table public.analysis_images
  drop constraint if exists analysis_images_display_order_check;

alter table public.analysis_images
  add constraint analysis_images_display_order_check
  check (display_order between 0 and 6);

insert into public.analysis_images (
  analysis_id,
  media_asset_id,
  display_order
)
select
  backup.analysis_id,
  backup.media_asset_id,
  backup.display_order
from private.mcm_capture_six_view_backup_20260821 backup;

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

drop table private.mcm_capture_six_view_backup_20260821;

commit;
