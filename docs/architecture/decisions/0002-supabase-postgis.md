# ADR-0002: Use Supabase PostgreSQL + PostGIS as the system of record

- **Status:** Accepted for the Phase 0 recommendation; production tier/region to be verified before provisioning
- **Date:** 2026-10-05

## Context

The domain joins localized resort entities, lift/run status, snow and weather observations, provenance, offers and spatial geometry. The map needs points and eventually lines/polygons, proximity/bounds queries, and a reliable history of time-stamped observations. MVP users are anonymous; accounts may be added later.

## Decision

Use **managed PostgreSQL with PostGIS through Supabase**. Choose the specific **North EU (Stockholm), `eu-north-1`** region for the production project, subject to confirmation that the chosen plan offers that exact region. Keep schema evolution in SQL migrations in Git and apply it through the Supabase CLI/workflow.[12][34]

PostGIS provides spatial types and indexed spatial queries; Supabase documents enabling and using the extension in its Postgres service.[9]

## Alternatives considered

- **Neon Postgres + PostGIS:** technically credible and suitable if serverless database branching/compute becomes the main driver; Neon documents the PostGIS extension.[10] It would still need separate services for scheduled collectors and any future auth/storage features not selected from Neon.
- **Self-managed PostgreSQL/PostGIS:** gives control but creates avoidable responsibilities for backups, patching, failover, monitoring and on-call at a ten-resort scale.
- **Non-relational database:** rejected because spatial relations, observation provenance and configurable scoring benefit from relational constraints and mature PostGIS support.

## Consequences

- Standard Postgres schema and SQL migrations keep the core data portable; Supabase-specific auth, storage, cron and Edge Functions remain replaceable service integrations.
- Supabase Pro currently starts at $25/month, includes seven-day backups/log retention, and additional projects are priced separately. Free projects may pause after inactivity, so Free is for local/dev experiments, not the live collector system.[11]
- Put raw snapshots in Supabase Storage only when the source terms permit retention; keep an archive interface so storage can move later.
- Do not expose privileged keys or database write access to browser code. RLS is required before any future direct client access.

## Revisit when

Reassess if regional residency, sustained egress/storage cost, support/SLA requirements, or independent database branching materially favor another managed Postgres provider. Re-evaluate the exact region and plan at launch; a broad “Europe” region label is not a precise residency guarantee.[12]

## Sources

[9] https://supabase.com/docs/guides/functions/limits — Limits | Supabase Docs
[10] https://supabase.com/docs/guides/database/extensions/postgis — PostGIS: Geo queries | Supabase Docs
[11] https://supabase.com/pricing — Pricing & Fees | Supabase
[12] https://supabase.com/docs/guides/platform/regions — Available regions | Supabase Docs
[34] https://inlang.com/m/gerre34r/library-inlang-paraglideJs/basics — Basics - Paraglide JS
