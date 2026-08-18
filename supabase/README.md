# Supabase migration notes

## Migration order for an existing v2 database

Apply the forward migrations in filename order: `202608180001` → `202608180002`
→ `202608180003` → `202608180004`. A fresh, empty database uses the root
`supabase-schema.sql` bootstrap only and must not replay these migrations.

## 202608180004 backend v2 runtime

`migrations/202608180004_backend_v2_runtime.sql` aligns an existing v2 database
with the hardened runtime used after the seven-view migration:

1. Replaces each canonical product's `model_3d` with the complete Product3D
   object from `mock-data.json`, including camera settings, auto-rotation, and
   variants required by `openapi.yaml`. The canonical option rules are aligned,
   while `model_3d_ready=false` prevents the API from advertising missing GLB,
   poster, or HDR assets.
2. Makes a PAID Mock payment fail atomically when its guarded application
   update cannot move `PENDING_PAYMENT` to `ORDER_PLACED`.
3. Runs the customer change-decision trigger as `SECURITY DEFINER` so its
   application and status-history writes can succeed, while rechecking
   `auth.uid()`, application ownership, and the one-time `PENDING` decision.
   Direct execute is revoked from `public`, `anon`, and `authenticated`.
4. Adds database contracts for initial/final order terms and one application per
   analysis. Duplicate analysis orders abort the migration for manual review.
5. Revokes direct analytics inserts from every API role. A service-role-only
   `record_analytics_event` RPC takes a per-user advisory transaction lock,
   enforces the 60-events/60-seconds limit atomically, constrains event names to
   the OpenAPI enum, and uses the `(user_id, received_at desc)` rate-limit index.
6. Requires a matching owner/PENDING `media_assets` row before object upload.
   Source deletion is allowed only while that metadata is still PENDING and no
   `analysis_images` row references the asset.
7. Adds `analysis_external_ai_consents`. The service role inserts a receipt
   before a LIVE provider call and may update only `analysis_id`, once, after a
   same-customer analysis exists. Consent identity, notice version, acceptance
   time, and receipt hash are immutable; authenticated customers have owner-only
   read access and no direct write access.

Before changing anything, 004 requires the four canonical product IDs, both
existing trigger functions/triggers, the prior named RLS policies, valid terms,
no duplicate application analysis IDs, and no conflicting 004 structures. It
saves the exact previous product JSON/option rules, function and trigger
definitions, effective privileges, and RLS policy expressions in private backup
tables. The tables are inaccessible to `anon` and `authenticated` and remain
until the rollback window closes.

## 202608180001 lifecycle integrity

`migrations/202608180001_lifecycle_integrity.sql` upgrades an existing v2 demo
database. The root `supabase-schema.sql` remains the fresh-install bootstrap.

The migration is transactional and performs these steps in order:

1. Saves the existing application consent JSON in the RLS-inaccessible
   `private.mcm_lifecycle_alignment_backup_20260818` table.
2. Adds and deterministically backfills `pickup_schedule`. Existing rows use the
   application creation date plus two days and the demo window `14:00-16:00`.
3. Converts only the exact legacy all-true consent object on
   `PRIMARY_SCENARIO` demo rows. `STATIC`, unknown, or partially accepted legacy
   consent shapes abort the migration for manual review.
4. Backfills `physical_inspections.proposed_terms` only from its already-linked
   change request. A `CHANGE_REQUIRED` inspection without that evidence aborts.
5. Backfills a missing initial `PENDING_PAYMENT` history row at the application
   creation time with the note `MIGRATION_BACKFILL_INITIAL_STATUS`.
6. Validates existing inspection operators, application terms, and certificate
   eligibility before enabling constraints, triggers, and operator-only RPCs.

The carrier row is optional during pickup. If a shipment was preallocated, the
lifecycle RPC keeps its pickup status synchronized. `SHIPPED` is the mandatory
shipment creation boundary and requires a tracking number; `DELIVERED` requires
that tracked shipment to exist.

## Apply and verify

Apply the up migration through the normal Supabase migration pipeline in a
staging project first. Verify at minimum:

- all four product detail responses return `has3d=false` and `model3d=null`
  while the complete disabled Product3D configuration remains in the database;
- a PAID payment on a non-`PENDING_PAYMENT` application aborts the payment row
  and leaves the application unchanged;
- the owning customer's authenticated change decision updates the request,
  application, and status history in one transaction;
- anonymous, another customer, and an operator cannot use the customer
  change-decision update path;
- a decided change request cannot be edited again, including `response_reason`;
- one analysis cannot be used to create two applications;
- all API-role direct analytics inserts fail, while the service-role-only RPC
  accepts only the published event enum and serializes each user's rate check
  with its insert;
- an upload without matching PENDING owner metadata fails, and an analysis-linked
  source object cannot be deleted by the customer;
- a LIVE external-AI attempt records consent before provider execution, exposes
  it only to its owning customer, and links it to a same-customer analysis once;
- anonymous and customer sessions cannot execute either write RPC;
- an `OPERATOR` can move only to the immediate legal next status;
- `PRODUCTION_UNAVAILABLE` is accepted only from `IN_PRODUCTION` or
  `QUALITY_CHECK`, and the lifecycle `CANCELED` command only from
  `PRODUCTION_UNAVAILABLE`;
- `CHANGE_REQUIRED` produces the inspection, pending change request, and both
  status-history rows in one transaction;
- a forced error while creating the change request leaves none of those rows;
- certificate insert/update fails before `COMPLETED` or while `status_override`
  is non-null;
- `SHIPPED` upserts the carrier fixture and `DELIVERED` updates the same row.

Keep the private backup table through the rollback window. It contains consent
flags only, is not exposed to `anon` or `authenticated`, and can be removed after
the release is accepted.

## Rollback

Rollback in reverse order. Run
`rollbacks/202608180004_backend_v2_runtime.sql` before the 003, 002, or 001
rollback. It restores the exact product JSON and trigger definitions captured
at migration time, plus the prior RLS policy expressions and analytics grants.
It refuses to overwrite a product model/readiness flag, function, trigger,
policy, or protected privilege that changed after 004. It also aborts if any
external-AI consent receipt exists, because automatic rollback must not destroy
audit evidence; archive and review those rows explicitly first. Rolling back
004 reintroduces the prior payment, customer-decision, upload, event, and order
integrity gaps, so the corresponding v2 Route Handlers must be stopped or rolled
back in the same release window.

`rollbacks/202608180001_lifecycle_integrity.sql` is a manually invoked structural
rollback; it is deliberately outside `migrations/` so Supabase does not apply it
as a forward migration.

Stop writers before running it. The script restores pre-migration consents from
the private backup and refuses to continue if any application was created after
the migration. It does not reverse business actions already performed through
the lifecycle RPC (status changes, history, inspections, change decisions, or
shipments). Restore those from a reviewed point-in-time backup or an explicit
business-data correction before/after the structural rollback as appropriate.

The SQL has been designed for PostgreSQL/Supabase, but a live PostgreSQL apply
and rollback are still required before production because this repository does
not include a disposable Supabase/PostgreSQL test runtime.
