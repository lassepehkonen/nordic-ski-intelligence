# ADR-0003: Keep MVP data access server-side; add a public API only at a real client boundary

- **Status:** Accepted for the Phase 0 architecture
- **Date:** 2026-10-05

## Context

The public website needs SSR resort pages and map data. A later PWA/native client, affiliate integration or API product may need a stable data contract. MVP is anonymous and does not require account-level personalization. A dedicated service adds deployment, credentials, monitoring and on-call before there are independent consumers.

## Decision

For the initial web product, SvelteKit server modules perform reads through a server-only domain/data-access layer. SvelteKit server routes may return bounded, read-only DTOs for map viewports and other browser interactions. Never send privileged Supabase credentials to the browser and never make the public UI depend on raw database table shapes.

Do not launch a separate API service or expose browser-direct Supabase queries in the MVP. When a mobile, partner or third-party API consumer is approved, define a versioned read-only API contract; use narrowly scoped RLS-backed direct reads only if a specific authenticated feature benefits from them.

## Alternatives considered

- **Browser → Supabase Data API:** reduces web-server reads but exposes a larger data surface and requires proven RLS policies for every exposed table. Defer until accounts/client-side reads are required.
- **Dedicated backend service:** clean independent scaling/versioning, but premature for one web client and ten resorts.
- **Server-only forever:** safest short-term but would force mobile/partner clients to imitate web internals. The chosen hybrid leaves a deliberate migration path.

## Consequences

- SSR and the map endpoint use the same domain services and vetted current-state read models.
- API DTOs can hide schema changes and omit unapproved or stale source data.
- Rate limiting, caching and query bounds are required on public map endpoints.
- If direct Supabase access is introduced later, enable and test RLS, permissions and row policies before release; never treat an anonymous key as an authorization policy.

## Revisit when

Create a dedicated service only when external API consumers, distinct scaling, independent deployment requirements or sustained workload measurements justify its operational cost. Revisit direct RLS-backed client access when authenticated users or offline-friendly client behavior are designed.
