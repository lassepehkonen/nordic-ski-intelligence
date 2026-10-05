# Nordic Ski Intelligence — Architecture Overview

- **Phase:** 0 — product and architecture research; no application implementation
- **Decision status:** recommended foundation for the next phase, subject to the gates below
- **Reviewed:** 5 October 2026
- **Specification:** [`docs/product/master-context.md`](../product/master-context.md) is authoritative

## 1. Executive recommendation

Build the first product as a **SvelteKit + TypeScript** map-first web application, server-rendered for indexable pages and interactive in the browser where needed. Use **Paraglide JS** for typed localization, **Supabase PostgreSQL + PostGIS** for the system of record, and **Supabase Cron + Edge Functions** for small, I/O-bound scheduled collectors. Host the web application on **Netlify**; keep the map renderer and tile delivery separate. Leaflet is the first 2D renderer candidate; retain MapLibre if richer vector styling is needed.[40][42]

No tile provider is selected. Compare a properly operated OSM-derived tile service with optional managed MapTiler Flex before implementation; do not count the public OSM endpoint as guaranteed production capacity.[27][30][41] Use **GitHub Actions** for required CI and Netlify Deploy Previews for review.

This is an application with a continuously interactive map, filters, resort comparisons, live conditions and a planned PWA—not just a collection of editorial pages. SvelteKit keeps the public SSR content and the coordinated interactive UI in one routing/rendering model while still allowing static prerendering for suitable routes.[1][31]

Commercial rights are a hard dependency, not a future cleanup. No resort or weather dataset is admitted into production until its endpoint-specific license/terms, attribution, retention, caching, redistribution and commercial-use conditions are documented and approved.

## 2. Recommended stack and initial operating envelope

| Layer                  | Phase 1 recommendation                                                                                 | Why / boundary                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web application        | SvelteKit, TypeScript, `adapter-netlify`                                                               | One SSR/prerender-capable app for pages, map routes and server endpoints; avoid splitting shared map/filter state across islands.                                                                            |
| i18n                   | Paraglide JS; `/fi/`, `/en/`, `/sv/`, `/no/`                                                           | Typed messages and locale-aware URLs; all visible UI and content are localized, with translation completeness checked before release.[8]                                                                     |
| Database               | Supabase PostgreSQL + PostGIS, production in Stockholm (`eu-north-1`)                                  | Spatial queries and standard Postgres schema; retain portability through SQL migrations and keep vendor-specific features behind service boundaries.[9][12][34]                                              |
| API boundary           | SvelteKit server-only data modules; versioned read-only routes for map/mobile clients when needed      | No browser access to privileged database credentials. Do not introduce a separate API service until a real partner/API workload justifies it.                                                                |
| Collectors / scheduler | Supabase Cron invokes small Supabase Edge Functions                                                    | One managed control plane and run history for a 10-resort, primarily I/O-bound first slice; keep adapters independently testable.[13][14]                                                                    |
| Raw source archive     | Supabase Storage behind a provider-neutral archive interface; retention configured per approved source | Keep parser evidence only when that source permits storage and test use; never assume raw data can be kept forever.                                                                                          |
| Map                    | Leaflet or MapLibre; choose in a later map/UI spike                                                    | Both renderers are open-source; tile supply is separate. Compare self-hosted OSM-derived tiles with an optional managed provider; the public OSM endpoint is not guaranteed production capacity.[30][40][42] |
| Web hosting            | Netlify                                                                                                | SvelteKit adapter, mixed rendering modes and pull-request previews; fits the existing project workflow.[2][31][32]                                                                                           |
| CI/CD                  | GitHub Actions required checks + protected `main` + Netlify preview per PR                             | CI verifies code, migrations and translations; production only follows reviewed merge.                                                                                                                       |
| Later identity/PWA     | SvelteKit service worker; Supabase Auth only when accounts are needed                                  | Keep MVP anonymous; native mobile clients later use a versioned API, not database secrets.[25]                                                                                                               |

The framework/platform prices below are public USD list prices checked on 5 October 2026, not a quote or usage forecast. The application/database baseline **without map-tile delivery** is approximately **$34/month**: Netlify Personal ($9) + Supabase Pro ($25), before tax, domains, monitoring and traffic overages.[11][33]

MapTiler Flex is optional and adds a current starting price of $30/month, so the managed-tile variant is approximately **$64/month** before extra traffic and other costs.[27] A separate Supabase staging project adds about $10/month: roughly **$44/month without managed tiles** or **$74/month with MapTiler**. Self-hosted tile hosting/operations are not priced, so neither number is an all-in estimate.[11][27]

Supabase Free projects can pause after a week of inactivity, and MapTiler's Free tier is described as testing/PoC/personal/non-commercial. Public OSM tiles may be viewed interactively under the tile policy but have no SLA and may be withdrawn; do not treat the free tier or OSM public tiles as guaranteed production services. Recheck terms before signup.[11][27][30]

## 3. System context and data flow

```text
Official / licensed source
    │  approved source record + limits + attribution
    ▼
Scheduled adapter (Cron → Edge Function)
    ├── fetch → immutable, license-permitted raw snapshot
    ├── parse → common normalized observation
    ├── validate → schema + range + freshness + conflict checks
    └── record → provenance, parser version, run status, confidence inputs
                 ▼
      PostgreSQL/PostGIS observations + current-state read models
                 ▼
      SvelteKit server data layer / versioned read-only endpoints
           ├── SSR localized resort, country and regional pages
           └── map viewport data → browser Leaflet or MapLibre client
```

The browser does not call resort, weather or licensed data APIs directly. The public pages render meaningful resort/condition text on the server; the interactive map is a browser component and may load map viewport data from the product API. A failed map or client bundle must not blank the core textual condition summary.

### Source admission and provenance

Each source and dataset has a lifecycle such as `discovered → rights_pending → approved → active → suspended`. The adapter checks the source record before a scheduled fetch; `pending` and `denied` sources cannot populate customer-facing data. Record the precise endpoint/dataset, owner, legal basis or license, terms version/date checked, attribution, permitted fields, request limits, caching/retention rules and support contact.

Keep every observation append-only with source ID, resort/feature ID, metric, normalized value/unit, source-reported time, fetched time, validity period, validation state and adapter version. A current-state read model is derived from approved observations; an invalid or conflicting value cannot silently overwrite a valid current value.

## 4. Domain model and scoring

Keep static resort information, dynamic observations, editorial content and commercial offers separate. Core records include `Resort`, localized `ResortTranslation`, `SkiArea`, `Lift`, `Run`, `Source`, `Dataset`, `LicenseApproval`, `FetchRun`, `Observation`, `WeatherObservation`, `SnowObservation`, `ConditionsScore`, `ResortRating` and `CommercialOffer`.

Coordinates and geometry use PostGIS with an explicit SRID; the public map API returns GeoJSON/WGS84. Resorts, lifts and runs are separate entities so lift/run status can have observation history without overwriting static resort identity.

`ConditionsScore` is a dynamic 0–100 value, stored with a scoring version, inputs, weights and a human-readable explanation. Candidate inputs are snow depth, recent/forecast snowfall, open-run/open-lift proportions, temperature, wind, snow quality and precipitation. Missing or stale data must remain explicit; the score is independently testable and must not be calculated in UI components.

`ResortRating` is a separate, comparatively permanent product rating. The configured starting categories/weights remain as in the master context: Atmosphere & Environment 15%; Slopes 25%; Lifts 15%; Off-piste 20%; Accommodation 10%; Food 7.5%; Après-ski 7.5%. External ratings stay separately attributed and are never folded into either score without an explicit future decision.

Confidence is not another name for Conditions Score. Store confidence inputs per metric—source tier, freshness, validation and agreement—and initially show a qualitative state plus `as of` time. Do not publish a numeric confidence value until it has been calibrated and tested.

## 5. Localized pages, SEO and maps

The route registry supports `fi`, `en`, `sv` and `no`; user-visible strings, navigation, filters, resort content, weather terms, dates, numbers and units are localized. English is the UI fallback for missing strings during authoring, but a fallback does not mark a resort translation complete or make an incomplete localized SEO page indexable.

Localized pages use stable locale prefixes and locale-specific resort slugs. Every indexable translation has a canonical URL and reciprocal `hreflang` alternates; publish localized country, region, resort and comparison pages only when the content is useful and sufficiently complete. Generate Open Graph metadata, structured data, `robots.txt` and XML sitemap entries from the same canonical route/content model. Google documents reciprocal localized-version annotations and canonical handling for language variants.[35]

SvelteKit supports page-level rendering choices, including SSR and prerendering; Netlify documents these modes and automatic API endpoints for its SvelteKit adapter.[31] Prerender stable country/editorial content where practical; SSR current condition summaries from database read models and cache only within the approved freshness contract.

Leaflet and MapLibre are open-source browser renderers; neither supplies basemap data or hosted tiles.[40][42]

OSM data are reusable under ODbL with attribution and potential share-alike duties for derivative databases.[41]

MapTiler Flex is an optional managed tile provider, currently listed from $30/month plus extra-traffic charges; it is not a committed contract or required renderer.[27]

The public `tile.openstreetmap.org` endpoint permits compliant interactive viewing, but is community-funded, best-effort, has no SLA, and the OSM Foundation warns commercial services that access may be withdrawn. Follow its attribution, identification, cache and no-bulk/offline/prefetch rules; select a managed provider or operate an appropriately licensed tile service if production reliability is required.[30]

## 6. Collectors, schedules and reliability

Use one separately scheduled ingestion invocation per adapter/source group, staggered to avoid bursts. Supabase Cron uses `pg_cron`, tracks job runs in the database and can invoke an Edge Function over HTTP; Supabase recommends no more than eight concurrent jobs and no more than ten minutes per job.[13]

The initial Edge Functions are for bounded, mostly network-I/O work—not headless browsers, large CPU-bound parsing or unrestricted scraping. Supabase currently documents a 2-second CPU limit per request and a 150-second free / 400-second paid wall-clock limit; use the paid production project for collectors and fail the architecture gate if a licensed adapter cannot fit those limits.[14]

For every run, store `started_at`, `finished_at`, source, status, fetched/accepted/rejected counts, error category, parser version and last-success timestamp in a `collector_runs`/source-health model. Retry transient failures with bounded backoff, make writes idempotent, preserve the last known good state, alert when a source exceeds its freshness threshold, and test that missing/conflicting data is visible rather than fabricated.

If a permitted source requires a Node-only package, heavy parsing or longer jobs, move only that adapter to a Railway cron worker (or Cloudflare Worker if the runtime fit is proven); keep the same normalized database contract.

- Railway Cron requires the process to exit and does not promise exact-minute timing.[20]
- Netlify scheduled functions have a fixed 30-second limit and only run on published deploys.[15][16]
- GitHub Actions schedules can be delayed during high load, so reserve them for maintenance rather than live-condition freshness.[24]

## 7. API, security and future commercial features

SvelteKit server load/functions call a server-only data-access layer. A public, versioned read-only endpoint may serve map viewport data and later mobile/API consumers; it has schema validation, caching, rate limiting, and exposes only approved product data. Do not expose a Supabase service key in browser code. If clients later read through Supabase directly, enable and test RLS on every exposed table first.

MVP users are anonymous. Future favorites, preferences, trips, subscriptions and entitlements are separate domain extensions; do not create account/profile tables just to prepare for them. SvelteKit service workers provide a path to a PWA later, while a native app remains a separate client of the stable API contract.[25]

Advertising, lodging/ticket/rental/activity affiliates and sponsorships live behind provider-neutral offer adapters and are labeled distinctly from editorial or organic recommendations. Premium alerts, history, personalization and API plans are deferred. Off-piste is also deferred; any later route model must distinguish piste, touring, backcountry and off-piste, and never imply uncontrolled routes are guaranteed safe.

## 8. CI/CD, agent access and observability

```text
feature branch → PR → GitHub Actions checks → Netlify preview
              → human review → protected merge to main → production deploy
              → smoke checks + source/collector monitoring
```

Required checks: typecheck, lint, unit tests for pure domain/scoring code, adapter parser fixtures, localization completeness, database migration validation and production build. Netlify automatically creates Deploy Previews for pull/merge requests in connected repositories.[32] Use separate staging and production Supabase projects; preview builds receive only staging/public-safe values. Production credentials are not available to autonomous coding agents, and no agent bypasses required review or CI.

Monitor both web availability and **data freshness**. Netlify Personal currently lists one-day observability and Supabase Pro lists seven-day log retention, so persist collector health and source freshness in the database and add a stale-data alert/heartbeat; short platform log retention is not a long-term audit trail.[11][33]

## 9. Phase 0 outcome, gates and open questions

This document and [`technology-comparison.md`](technology-comparison.md) plus the ADRs below are the Phase 0 deliverable. No application code, cloud project, tile account, data adapter or production integration has been created.

**Phase 1 research is complete.** The ten-resort selection, source inventory, matrix, cost assumptions and licensing gates are documented in [data-sources.md](../data-sources.md), [data-source-matrix.md](../data-source-matrix.md), [data-cost-model.md](../data-cost-model.md), [data-licensing.md](../data-licensing.md) and [official-resort-source-policy.md](../official-resort-source-policy.md). No production collector or external integration was implemented. Dynamic resort feeds remain a commercial/legal approval gate; public-page scraping is not an approved substitute.

**Phase 2 domain and database foundation is now implemented and locally schema-tested.** See [domain-model.md](domain-model.md), [database.md](database.md) and [api.md](api.md). This does not provision a production Supabase project, ingest resort data, enable a public database schema, or build the frontend.

Before any production ingestion, secure endpoint-level rights, data coverage, update cadence, attribution, retention and scoring/derived-use terms for every displayed resort field. If an operator feed cannot be licensed or collected reliably, remove that field from the first slice rather than scraping it.

Before deployment decisions harden, confirm the organization/billing owner; real Netlify/Supabase project access; Stockholm-region availability on the chosen Supabase plan; map usage budget; freshness targets; translation owners; and canonical brand/domain. Pricing and terms are time-sensitive and must be rechecked at purchase.

### Decision records

- [ADR-0001 — SvelteKit application framework](decisions/0001-sveltekit.md)
- [ADR-0002 — Supabase PostgreSQL/PostGIS](decisions/0002-supabase-postgis.md)
- [ADR-0003 — server-side API boundary](decisions/0003-server-api-boundary.md)
- [ADR-0004 — collectors and scheduler](decisions/0004-collectors-scheduler.md)
- [ADR-0005 — map renderer and tile delivery](decisions/0005-map-stack.md)
- [ADR-0006 — Netlify hosting and GitHub Actions](decisions/0006-hosting-ci.md)
- [ADR-0007 — Paraglide localization and localized routes](decisions/0007-i18n-routing.md)
- [ADR-0008 — data-rights activation gate](decisions/0008-data-rights-gate.md)
- [ADR-0009 — scoring boundaries](decisions/0009-scoring-boundaries.md)

## Sources

[1] https://docs.astro.build/en/guides/internationalization — Internationalization (i18n) Routing | Docs
[2] https://docs.astro.build/en/concepts/islands — Islands architecture | Docs
[8] https://supabase.com/docs/guides/cron — Cron | Supabase Docs
[9] https://supabase.com/docs/guides/functions/limits — Limits | Supabase Docs
[11] https://supabase.com/pricing — Pricing & Fees | Supabase
[12] https://supabase.com/docs/guides/platform/regions — Available regions | Supabase Docs
[13] https://neon.com/docs/extensions/postgis — The postgis extension - Neon Docs
[14] https://neon.com/pricing — Pricing — Neon
[15] https://developers.cloudflare.com/workers/configuration/cron-triggers — Cron Triggers · Cloudflare Workers docs
[16] https://developers.cloudflare.com/workers/platform/limits — Limits · Cloudflare Workers docs
[20] https://docs.netlify.com/deploy/deploy-overview — Deploy overview | Netlify Docs
[24] https://vercel.com/docs/cron-jobs — Cron Jobs
[25] https://vercel.com/pricing — Vercel Pricing: Hobby, Pro, and Enterprise plans
[27] https://maplibre.org/maplibre-gl-js/docs — Introduction - MapLibre GL JS
[30] https://mapsplatform.google.com/pricing — Google Maps Platform Pricing - Subscriptions and Pay as you go
[31] https://operations.osmfoundation.org/policies/tiles — Tile Usage Policy
[32] https://inlang.com/m/dxnzrydw/paraglide-sveltekit-i18n — SvelteKit - Paraglide JS
[33] https://inlang.com/m/gerre34r/library-inlang-paraglideJs/changelog — inlang/paraglide-js
[34] https://inlang.com/m/gerre34r/library-inlang-paraglideJs/basics — Basics - Paraglide JS
[35] https://inlang.com/m/gerre34r/library-inlang-paraglideJs/i18n-routing — i18n Routing - Paraglide JS
[40] https://docs.netlify.com/build/frameworks/framework-setup-guides/vite — Vite on Netlify
[41] https://docs.netlify.com/build/frameworks/framework-setup-guides/tanstack-start — TanStack Start on Netlify
[42] https://docs.netlify.com/build/functions/configuration — Configuration for functions | Netlify Docs
