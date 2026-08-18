-- Structural rollback for 202608180001_lifecycle_integrity.sql.
-- Run only after stopping writers. Applications created after the up migration
-- require a product-approved consent mapping or point-in-time restore.

begin;

do $$
begin
  if exists (
    select 1
    from public.applications a
    left join private.mcm_lifecycle_alignment_backup_20260818 b
      on b.application_id = a.id
    where b.application_id is null
  ) then
    raise exception 'rollback requires manual handling of applications created after migration';
  end if;
end;
$$;

revoke all on function public.advance_application_lifecycle(
  uuid,
  public.application_status,
  text,
  text,
  text,
  text
) from public, anon, authenticated;
drop function public.advance_application_lifecycle(
  uuid,
  public.application_status,
  text,
  text,
  text,
  text
);

revoke all on function public.submit_physical_inspection(
  uuid,
  public.inspection_outcome,
  integer,
  integer,
  text,
  jsonb
) from public, anon, authenticated;
drop function public.submit_physical_inspection(
  uuid,
  public.inspection_outcome,
  integer,
  integer,
  text,
  jsonb
);

drop trigger if exists applications_protect_issued_certificate_state on public.applications;
drop function if exists public.protect_issued_certificate_application_state();
drop trigger if exists esg_certificates_enforce_issuance_state on public.esg_certificates;
drop function if exists public.enforce_certificate_issuance_state();

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

delete from public.application_status_history
where note = 'MIGRATION_BACKFILL_INITIAL_STATUS'
  and status = 'PENDING_PAYMENT'
  and actor_id is null;

drop trigger if exists applications_record_status_change on public.applications;
create trigger applications_record_status_change
after update of persisted_status on public.applications
for each row execute function public.record_application_status_change();

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

alter table public.physical_inspections
  drop constraint if exists physical_inspections_proposed_terms_contract,
  drop constraint if exists physical_inspections_reason_contract;

alter table public.physical_inspections
  add constraint physical_inspections_reason_check check (length(trim(reason)) > 0);

alter table public.application_change_requests
  drop constraint if exists application_change_requests_previous_terms_contract,
  drop constraint if exists application_change_requests_proposed_terms_contract;

alter table public.physical_inspections
  drop column if exists proposed_terms;

alter table public.applications
  drop constraint if exists applications_pickup_schedule_contract,
  drop constraint if exists applications_consents_contract;

update public.applications a
set consents = b.consents
from private.mcm_lifecycle_alignment_backup_20260818 b
where b.application_id = a.id;

alter table public.applications
  drop column if exists pickup_schedule;

drop function if exists public.is_valid_application_terms(jsonb);

grant insert on public.physical_inspections to anon, authenticated;

drop table private.mcm_lifecycle_alignment_backup_20260818;

commit;
