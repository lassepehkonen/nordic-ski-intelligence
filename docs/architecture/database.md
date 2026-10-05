# Phase 2 — Database foundation

- **Status:** Supabase/PostgreSQL/PostGIS schema implemented in migrations and verified with local pgTAP tests.
- **No production project was provisioned or modified.** The local schema contains no resort/source sample data.
- **Related:** [Domain model](domain-model.md), [API boundary](api.md), ADR-0002, ADR-0003, ADR-0008 and ADR-0009.

## Platform and migration workflow

Use Supabase-managed PostgreSQL with PostGIS, as accepted in [ADR-0002](decisions/0002-supabase-postgis.md). PostGIS is enabled in the `extensions` schema. The database is portable SQL except for its explicit PostGIS extension dependency; spatial values use SRID 4326, with `geography` for distance-oriented points and `geometry` for map overlays.[10]

Schema changes are ordered SQL migrations in `supabase/migrations/`, tracked in Git and applied with the Supabase CLI workflow.[59] Database tests use pgTAP through the Supabase CLI; pgTAP is Supabase's documented Postgres test mechanism.[60][61]

```text
supabase/
├── config.toml
├── migrations/
│   ├── 20261005134852_domain_foundation.sql
│   ├── 20261005134853_observations_and_scores.sql
│   └── 20261005134854_ratings_commercial_and_reviews.sql
└── tests/
    ├── 001_schema_contract.test.sql
    ├── 002_domain_invariants.test.sql
    └── 003_rights_and_provenance.test.sql
```

`app` is a private domain schema. `supabase/config.toml` exposes only `public` and `graphql_public` through the Supabase Data API; do not add `app` there or grant browser roles direct access. The web product uses the server-only data-access boundary in [ADR-0003](decisions/0003-server-api-boundary.md). No auth, RLS policy surface, API handler or browser credential is part of this phase.

## Schema inventory

| Area                        | Tables / views                                                                                                    | Responsibilities                                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provenance and rights       | `sources`, `source_approvals`, `source_references`, `raw_observations`, `source_observations`                     | Exact source/use scope, terms and field allowlist; field URL/time/attribution; optionally retained raw payload; common normalized time/quality envelope. |
| Resort catalog              | `locations`, `resorts`, `resort_translations`, `resort_facts`                                                     | Stable resort identity; WGS84 location; FI/EN/SV/NO labels; individually provenanced basic facts.                                                        |
| Geometry and inventory      | `map_features`, `lifts`, `pistes`                                                                                 | Static feature identity and rights-cleared geometry. Current lift/piste operations remain in observations.                                               |
| Conditions                  | `condition_observations`                                                                                          | Append-only resort-, lift- or piste-scoped metric/value records. Exactly one target and one typed numeric/text value are required.                       |
| Weather                     | `weather_stations`, `weather_observations`                                                                        | Station-linked measured values, separate from resort reports.                                                                                            |
| Forecasts                   | `forecast_runs`, `forecasts`                                                                                      | Provider issue/retrieval per location plus metric values at valid times; forecasts are not observations.                                                 |
| Conditions score            | `condition_score_versions`, `condition_scores`, `condition_score_inputs`, `v_condition_score_freshness`           | Versioned 0–100 output, one current row per resort, linked normalized input snapshots and explanation.                                                   |
| Permanent resort assessment | `resort_rating_versions`, `resort_rating_categories`, `resort_rating_values`                                      | Configurable rating categories/weights and values; seeded initial weights, no rating value until a scale is decided.                                     |
| Separately governed content | `resort_reviews`, `webcams`, `commercial_offers`                                                                  | Source-scoped review/offer references and permitted webcam links; no media snapshots.                                                                    |
| Freshness read models       | `v_condition_freshness`, `v_weather_observation_freshness`, `v_forecast_freshness`, `v_condition_score_freshness` | Derive `freshness_state` from validation and `valid_until`; include source display-permission state where applicable.                                    |

All time fields use `timestamptz`. Sourced observations distinguish source-reported time, fetch time, validity and retention expiry. Mutable catalog rows use `created_at`/`updated_at`; the database trigger updates `updated_at` on changes.

## Key integrity and indexes

- UUID primary keys; unique slugs; `(resort_id, locale)` primary key in `resort_translations`; locale check is `fi`, `en`, `sv`, `no`.
- Foreign keys tie source, approval and reference to the same source; source-reference field keys must be in the approval's allowlist (or `*`). Restrictive deletes preserve audit lineage; dependent translations cascade with a resort.
- Raw-payload writes require approved collection plus explicit raw-storage rights and a bounded `purge_after`. Normalized source observations require current approval, permitted field, collection/storage permission and a bounded `retention_expires_at`. Score inputs require validated observations and an approval allowing derived use.
- Map feature geometry is typed with SRID 4326, checked for validity and GiST-indexed. `locations.point` has its own GiST index. Attribute indexes support resort, metric, source/time, forecast valid-time and score-history lookups.
- A partial unique index enforces one `is_current` Conditions Score per resort. The 0–100 range, one-current rule, translation uniqueness and rating categories/weights are covered by pgTAP.
- The rating-category seed records the spec's seven category weights (total 1.0) in a draft version. Its min/max scale is NULL; a trigger rejects rating values until an explicit scale is configured and the version activated.
- Freshness is a view expression using `now()`, not a generated column or persistent boolean. A missing `valid_until` yields `unknown`; an expired record yields `stale`; a rejected record yields `invalid`.

## Data-access safety contract

Database triggers are fail-closed for raw and normalized observations and source-backed catalog/offer/review/webcam/geometry records. Data-access reads must additionally require the source approval to remain current and `commercial_display_allowed=true`; a stored record is not itself permission to publish. Never return raw payloads, terms notes, secret configuration or unapproved source content from the product API. Retention deletion/cleanup is a later operational job; this schema records the approved deadline but does not schedule one.

`app` is not exposed in `api.schemas`. Keep future direct client access disabled until every table has explicit grants/RLS and tests; no user tables are present in this migration set.

## Schema tests

`supabase test db --local` runs 3 pgTAP files (72 assertions on this revision):

1. **Schema contract:** extension/schema/types, all required relations and views, key indexes, and provenance/quality columns.
2. **Domain invariants:** translation uniqueness, pilot country scope, valid WGS84 geometry, typed-value exclusivity, seeded rating weights, stale-state view, score range and single-current constraint.
3. **Rights and provenance:** pending rights/storage denial, raw-retention enforcement, derived-use gate, and rating-scale guard/configuration.

No resort/operator rows are seeded. Test fixtures use `.invalid` URLs and are transaction-rolled back.

## Explicitly not included

No frontend tables, migrations for users/preferences/favorites/alerts/subscriptions/entitlements, production RLS policy, data ingestion job, source adapter, external data row, cloud project, or live API route is created by Phase 2.

## Sources

[10] https://supabase.com/docs/guides/database/extensions/postgis — PostGIS: Geo queries | Supabase Docs
[59] https://supabase.com/docs/guides/local-development/cli-workflows — Local development workflow | Supabase Docs
[60] https://supabase.com/docs/guides/database/extensions/pgtap — pgTAP: Unit Testing | Supabase Docs
[61] https://supabase.com/docs/guides/database/testing — Testing Your Database | Supabase Docs
