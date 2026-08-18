# Supabase migration notes

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
