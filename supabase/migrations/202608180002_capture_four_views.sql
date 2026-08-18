-- Tighten the v2 analysis input contract to the four approved bag views.
-- Existing completed analyses remain historical records. An in-flight analysis
-- with fewer than four uploaded owner photos must receive the missing photo
-- before it can move to ANALYZING or COMPLETED.

begin;

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

    if uploaded_photo_count <> 4 then
      raise exception 'analysis requires exactly 4 uploaded owner photos';
    end if;
  end if;
  return new;
end;
$$;

commit;
