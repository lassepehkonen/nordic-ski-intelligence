# Phase 2 — Product API and data-access boundary

- **Status:** Contract and repository boundary designed; no HTTP handlers or frontend implemented.
- **Authority:** ADR-0003; the database schema is in [database.md](database.md), with entity definitions in [domain-model.md](domain-model.md).

## Boundary

```text
SvelteKit server route/load/action
              │ typed product query
              ▼
       Domain services
              │ repository interfaces
              ▼
       PostgreSQL adapter ─── private `app` schema
```

Use server-only modules and the same domain services for SSR and bounded browser-facing read endpoints. A component must not issue arbitrary Supabase table queries or depend on raw database row shapes. The database schema remains private; no service key or database credentials enter browser bundles. The initial web product is anonymous and has no write API for reviews, offers, scores or source data.

## Repository contracts

Repositories own SQL, bounds, joins, ordering and row-to-domain mapping. They return domain records or an explicit `not_found`, `unavailable`, `stale`, `invalid` or `rights_blocked` result—never a fabricated zero/default.

| Repository            | Contract examples                                                                        | Guardrails                                                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ResortRepository`    | `getBySlug(slug, locale)`, `listByCountry(country, locale)`                              | Only published translations; static facts include their source URL, verification time and attribution.                                                            |
| `ConditionRepository` | `getLatestForResort(resortId)`, `getHistory(resortId, from, to)`                         | Select validated observations and freshness view; do not silently treat missing metrics as zero.                                                                  |
| `WeatherRepository`   | `getStationObservations(stationId, metrics, range)`, `getForecast(locationId, from, to)` | Keep measured station observations and model forecasts as distinct types; return source and valid times.                                                          |
| `MapRepository`       | `getFeatures(bounds, kinds, limit)`                                                      | Require finite WGS84 bounds, supported feature kinds, a hard page cap and currently display-permitted source approval; transform to GeoJSON only at the boundary. |
| `ScoreRepository`     | `getCurrent(resortId)`, `getHistory(resortId, range)`                                    | Return score version, freshness, explanation and linked input provenance; reject an invalid/stale score per product policy.                                       |
| `RatingRepository`    | `getPublished(resortId, locale)`                                                         | Keep permanent Resort Rating separate from Conditions Score and external reviews.                                                                                 |
| `ReviewRepository`    | `listDisplayPermitted(resortId, locale, limit)`                                          | Only content whose current approval permits storage and display; default to no external review content.                                                           |
| `OfferRepository`     | `listCurrent(resortId, at, limit)`                                                       | Return source, validation, currency and validity; never display expired or unapproved offers.                                                                     |
| `WebcamRepository`    | `listPermitted(resortId)`                                                                | Return operator link or explicitly allowed embed URL only; never image bytes or mirrored frames.                                                                  |

Repository implementations should accept a database client/connection via constructor/factory injection so tests can exercise the mapping and failure behavior without coupling domain services to Supabase globals. Keep SQL row types internal. Database changes are handled by migrations and repository mapping—not by editing UI components.

## Read DTOs

Product-facing DTOs are intentionally narrower than tables:

- **`ResortSummary`**: stable identity, localized label, location/point, selected approved facts, locale and source attribution.
- **`ConditionSnapshot`**: metric/value/unit, condition target, source label/link, source observation time, fetch time, validity, `freshnessState`, `validationState` and qualitative confidence.
- **`WeatherSnapshot`**: station identity/distance and measured weather, with observation time; it is not labelled as resort piste depth.
- **`ForecastSeries`**: source/model, issue time, valid times and typed forecast values.
- **`MapFeatureCollection`**: bounded GeoJSON features with stable product ID, feature kind, geometry, source attribution and validation state.
- **`ConditionScoreView`**: 0–100 score, algorithm version, computed/valid times, freshness, confidence, explanation and an input summary.
- **`ResortRatingView`**: versioned category values/weights, separate from Conditions Score; unavailable until scale and values are approved.

Do not expose `raw_observations.payload`, unrestricted `source_approvals.notes`, provider credentials or arbitrary `app.*` table rows.

## HTTP boundary (future routes, not implemented in Phase 2)

If an independent browser map consumer needs a route, add versioned read-only endpoints through SvelteKit server routes, for example:

- `GET /api/v1/resorts?country=FI&locale=fi`
- `GET /api/v1/resorts/{slug}?locale=sv`
- `GET /api/v1/resorts/{slug}/conditions`
- `GET /api/v1/map/features?bbox=minLon,minLat,maxLon,maxLat&kind=piste,lift`
- `GET /api/v1/resorts/{slug}/scores`

Validate route parameters and query bounds, allowlist requested fields, cap IDs and viewport result sizes, and apply short cache headers only within each source's documented freshness/rights window. Return explicit freshness and source provenance. Error responses should distinguish malformed input, missing resort, temporarily unavailable source and rights-blocked data without exposing private source configuration. Do not create a separate API service until a real independent consumer justifies it, as recorded in [ADR-0003](decisions/0003-server-api-boundary.md).

## Phase 2 endpoint status

The routes above are contract examples, not deployed endpoints. Phase 2 ends with domain tables, migrations and schema tests. Frontend, SvelteKit server modules, collectors, production grants/RLS, auth, rate-limiting infrastructure and public route handlers remain out of scope.
