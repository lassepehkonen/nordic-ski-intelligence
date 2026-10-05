# Phase 2 — Domain model

- **Status:** Implemented as a frontend-independent domain schema; migrations and schema tests are in `supabase/`.
- **Scope:** Nordic alpine resorts in Finland, Sweden and Norway; no frontend, collector or production-source integration.
- **Constraints:** [Master Product Context](../product/master-context.md), [Phase 0 architecture](overview.md), and ADRs 0002, 0003, 0008 and 0009.

## Design principles

1. Keep stable resort identity, translations, source facts, changing observations, editorial ratings and commercial content as distinct concepts.
2. Store time-varying facts append-only with source, source time, retrieval time, validity, validation and confidence. Derive freshness at query time; do not persist a `stale=true` flag that becomes wrong as the clock advances.
3. Keep language-independent condition/weather data out of translation rows. `resort_translations` contains only locale-specific resort display content.
4. Treat every external value as attributable and rights-scoped. A public URL is not a reuse grant; use the source approval record and the [official resort-source policy](../official-resort-source-policy.md).
5. Keep domain logic independent of SvelteKit components, API response shapes and database query details. The API layer maps repositories into product contracts.

## Domain map

```text
Source ──< SourceApproval ──< SourceReference
  │               │                  │
  ├──< RawObservation (only if raw retention is approved)
  └──< SourceObservation ────────────┘
            ├── ResortFact ── Resort ── Location
            ├── ConditionObservation ── Resort | Lift | Piste
            ├── WeatherObservation ── WeatherStation ── Location
            └── Forecast ── ForecastRun ── Location

Resort ──< ResortTranslation (fi/en/sv/no)
Resort ──< MapFeature | Lift | Piste | Webcam reference | CommercialOffer
Resort ──< ConditionScore ──< ConditionScoreInput ── SourceObservation
Resort ──< ResortRatingValue ── RatingVersion ── RatingCategory/weight
Resort ──< ResortReview (separate from Resort Rating)
```

## Identity and localization

- **`resorts`** is the stable product identity: immutable UUID, unique slug, operator name, location link, homepage and primary source reference. It does not contain live status or language-specific condition data.
- **`locations`** holds a named point, country/region/municipality context and optional elevation. A resort may use a location anchor without conflating the settlement point with piste geometry.
- **`resort_translations`** has one row per `(resort_id, locale)` for Finnish, English, Swedish or Norwegian display name and optional short description. It does not repeat source observations or condition values. Translation state separates draft, reviewed and published content.
- **`resort_facts`** stores only necessary source-backed stable facts as typed JSON values plus unit and observation/source provenance. Operator-advertised piste/lift totals remain attributed claims, not normalized league-table truth; seasonal totals can be rechecked. Do not store copied editorial copy or media.

## Sources, permissions and provenance

- **`sources`** identifies the operator/provider/dataset, not a generic URL collection.
- **`source_approvals`** is scoped to a dataset/use and records status, access method, field allowlist, collection, normalized/raw storage, retention, display, derived-use, attribution, terms/version and review/expiry times.
- **`source_references`** stores the exact URL, field key, retrieval/verification and source-update times, attribution and links back to the source and approval. It stores no quoted page text.
- **`raw_observations`** can retain JSON payloads only when a current approval explicitly permits raw storage and sets a maximum retention period. Its insert/update guard fails closed; `purge_after` records the permitted deletion deadline.
- **`source_observations`** is the common provenance/time envelope for normalized data: source, approval, reference, field key, optional raw-record link, source-reported time, fetch time, `valid_until`, retention expiry, qualitative confidence and validation state. A trigger rejects pending, expired, unapproved-field or non-storable data.

Confidence is qualitative (`unknown`, `low`, `medium`, `high`) in this phase. This follows ADR-0009: do not present an uncalibrated numeric confidence as probability. Validation (`pending`, `validated`, `rejected`, `needs_review`) is an independent state.

## Changing conditions and weather

- **`condition_observations`** is an append-only metric record scoped to exactly one resort, lift or piste. It supports numeric or text values, metric key and unit; it does not overwrite the current state on `lifts`/`pistes`.
- **`weather_stations`** are source-owned stations linked to a `location`; **`weather_observations`** are measured station values, not resort-piste measurements.
- **`forecast_runs`** captures provider issuance and retrieval for a location; **`forecasts`** holds metric values at their valid time. A forecast is never represented as an observation.
- `valid_until` is source/field-specific; no universal freshness duration is invented. Freshness views return `fresh`, `stale`, `unknown` or `invalid` at read time and include whether the current source approval allows display. Stale/missing observations stay explicit and must not silently become zero.

## Geography and features

`locations.point` uses PostGIS `geography(Point,4326)` for location-distance work. Resort boundaries, piste/lift lines and other displayable geometry live in `map_features.geometry` as PostGIS geometry with SRID 4326 and a GiST index; geometries are kept separate from live operating observations. PostGIS supplies typed, indexable spatial values and spatial queries for this product's viewport/proximity needs.[10]

`lifts` and `pistes` hold stable feature identity and operator/source references; the optional map-feature link provides geometry when separately rights-cleared. No map artwork, webcam image, tile, or source page is copied into these records.

## Scores, ratings and reviews

- **Conditions Score** is dynamic, 0–100, and stored with `condition_score_versions`, calculation time, validity, validation/confidence state and a JSON explanation. `condition_score_inputs` links each result to its validated source observation, normalized value, weight, contribution and explanation. A partial unique index allows one current score per resort; score versions and historical rows remain interpretable. Missing inputs are not zero-filled.
- **Resort Rating** is a separate comparatively permanent product assessment. `resort_rating_versions` and `resort_rating_categories` store versioned weights; the initial seven category weights are seeded from the Master Product Context. Its numerical scale is intentionally unset because the spec does not define one; values are blocked until a scale and active version are explicitly approved.
- **Reviews** are a separate source-scoped domain and are never blended into either score by default. The schema does not create user identity or review-submission flows; external review storage/display remains gated by source terms.

## Commercial and visual references

- **`webcams`** stores only an operator page URL and an explicitly permitted embed URL; it stores no frames, snapshots or CV results.
- **`commercial_offers`** stores a scoped resort offer, URL, optional price/currency, retrieval and retention times, validity and validation state. No offer rows are seeded; import and display depend on the source approval.
- **`resort_reviews`** stores only source-scoped content with approval and retention references. No external review text or ratings are populated.

## Deliberately deferred

No user, preference, favorite, alert, subscription, entitlement, account or notification tables are created. Add those only when their product behavior and authorization model are designed. The anonymous first slice and server-only data boundary remain as in ADR-0003.

## Open product decisions carried forward

1. Per-field freshness/retention periods come from approved source terms and measured update cadence, not a global default.
2. The Resort Rating scale and editorial assessment process remain undecided; weights are captured but no rating values are seeded.
3. Source owner approvals, exact permitted fields and resort coverage remain external legal/business approvals, not inferred from schema presence.

## Sources

[10] https://supabase.com/docs/guides/database/extensions/postgis — PostGIS: Geo queries | Supabase Docs
