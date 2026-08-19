-- Expand analysis photo ordering and require the seven approved capture views.
-- Existing completed analyses remain historical records. An in-flight analysis
-- with fewer than seven uploaded owner photos must receive the missing photos;
-- this migration does not fabricate capture assets or direction metadata.

begin;

alter table public.analysis_images
  drop constraint if exists analysis_images_display_order_check;

alter table public.analysis_images
  add constraint analysis_images_display_order_check
  check (display_order between 0 and 6);

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

commit;
