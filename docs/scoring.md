# Scoring domain (Phase 6)

- **Status:** Implemented as a pure, server-only domain layer in `src/lib/server/scoring/`; no database, UI or network code.
- **Binding constraints:** [Master Product Context](product/master-context.md) (Conditions Score + Resort Rating categories/weights) and [ADR-0009](architecture/decisions/0009-scoring-boundaries.md) (three separate concepts; missing data stays explicit).
- **Scope of this document:** algorithm, component bands, missing-data and staleness policy, publication gates, versioning policy, separation contract, test inventory, and how the Phase 5 pilot data feeds the layer.

## Module map

| File                                         | Responsibility                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/lib/server/scoring/types.ts`            | Input/output contracts; runtime component/category id tuples shared with config |
| `src/lib/server/scoring/config.ts`           | Versioned, frozen config registry + `ScoringConfigError` + config validation    |
| `src/lib/server/scoring/scoring-math.ts`     | Pure helpers: `round4`, `clip`, piecewise-linear band interpolation             |
| `src/lib/server/scoring/conditions-score.ts` | Deterministic Conditions Score compute                                          |
| `src/lib/server/scoring/resort-rating.ts`    | Deterministic permanent Resort Rating compute                                   |
| `src/lib/server/scoring/pilot-inputs.ts`     | Type-only mapper from `PilotProductResort` to `ConditionsScoreInputs`           |
| `src/lib/server/scoring/index.ts`            | Barrel export                                                                   |
| `tests/scoring/*.spec.ts`                    | Unit tests (see [Test inventory](#test-inventory))                              |

Layer rules: no `Date.now`, no `Math.random`, no globals, no mutation of inputs (deep-freeze friendly), no imports of DB/SvelteKit/`fetch`. Every compute takes an injected clock (`options.now`) and an explicit config version id; unknown versions throw `ScoringConfigError` — there is no silent fallback.

## Conditions Score (dynamic, 0–100)

`computeConditionsScore(inputs, versionId, { now })` returns a `ConditionsScoreResult` with `score`, `published`, `version`, `computedAt`, per-component detail, coverage, id lists and a machine-readable `explanation()`.

### Algorithm

1. **Evaluate each component input** against its config entry:
   - _Numeric components_ (`snow_depth`, `recent_snow`, `forecast_snow`, `temperature`, `wind`): `null` value → `missing`; non-finite value → `missing` (`scoring_input_unusable_value`); outside the plausible `validRange` → `out_of_range`; otherwise normalize through the component's piecewise-linear band and clip to 0–1.
   - _Ratio components_ (`terrain_open_ratio`, `lifts_open_ratio`): the division is owned here, not by the mapper. `total` null/non-finite → `missing` (`scoring_ratio_total_unknown`); `total` negative → `out_of_range`; `total === 0` → `missing` (`scoring_ratio_total_zero`, the share is undefined — unavailable, never 0); `open` null → `missing` (`scoring_ratio_open_unknown`); `open` outside `[0, total]` → `out_of_range`; otherwise raw ratio `open/total`.
   - _Categorical component_ (`snow_quality`): unknown category → `missing` (`scoring_category_unknown`); known category → factor from the config table.
2. **Staleness**: an input whose `observedAt` is older than `min(component.maxAgeHours, gates.maximumStalenessHours)` vs. the injected `asOf` clock is `stale` and excluded. An input with no usable `observedAt` (missing, malformed, or stamped more than 5 minutes in the future) gets `freshnessState: 'unknown'`; it can still contribute, but the result carries a `scoring_freshness_unknown` warning so uncertainty stays visible (ADR-0009).
3. **Weighted sum over available inputs only**: missing/stale/out-of-range components are excluded and the score is a weighted mean over the _remaining_ weights (`Σ normalized × weight / availableWeightSum × 100`). Nothing is zero-filled. Points are rounded deterministically to 4 decimals.
4. **Publication gates** (see below).
5. **Explanation**: `explanation()` rebuilds the machine-readable view from the exact result (version, coverage, gate reason keys, per-component status/normalized/contribution/reasons, id lists, warnings). All messages are stable `scoring_*` key + params pairs for the i18n layer — never prose.

### Component table (version v1.0)

Weights sum to 1. Bands are piecewise linear on the raw input, output clipped to 0–1.

| Component            | Weight | Direction        | Valid range | Band (x → y)                                                              | maxAgeHours |
| -------------------- | ------ | ---------------- | ----------- | ------------------------------------------------------------------------- | ----------- |
| `snow_depth`         | 0.10   | higher is better | 0–600 cm    | 0→0, 30→0.4, 60→0.7, 90→1, 120→1                                          | 72          |
| `recent_snow` (24 h) | 0.15   | higher is better | 0–200 cm    | 0→0.35, 2→0.65, 5→0.78, 10→0.9, 20→1                                      | 36          |
| `forecast_snow`      | 0.10   | higher is better | 0–400 cm    | 0→0.35, 2→0.6, 5→0.78, 10→0.92, 20→1                                      | 48          |
| `terrain_open_ratio` | 0.20   | higher is better | 0–1         | 0→0, 1→1 (identity)                                                       | 168         |
| `lifts_open_ratio`   | 0.15   | higher is better | 0–1         | 0→0, 1→1 (identity)                                                       | 168         |
| `temperature`        | 0.15   | non-monotonic    | −60–60 °C   | −30→0, −25→0.1, −18→0.55, −12→1, −2→1, 0→0.85, 5→0.6, 8→0.45, 15→0        | 12          |
| `wind`               | 0.10   | lower is better  | 0–40 m/s    | 0→1, 8→0.6, 12→0.35, 15→0, 25→0                                           | 12          |
| `snow_quality`       | 0.05   | higher is better | categorical | powder→1, packed_powder→0.9, piste→0.65, spring→0.45, slush→0.25, icy→0.1 | 72          |

Temperature encodes Nordic operating reality: best around −12…−2 °C, penalties below −25 °C and above +8 °C, zero value at −30 °C and +15 °C. Wind mirrors lift-closure behaviour: penalized from 8 m/s, zero at 15 m/s where lifts typically stop. Forecast snow saturates softer than recent snow because a forecast is a promise, not a measurement. The forecast accumulation window is `forecastWindowHours: 48`.

### Missing-data and staleness policy

- **Missing never becomes zero.** A `null` value, an undefined ratio share or an unknown category excludes the component from the weighted sum; `coverage.availableWeightShare` and the per-component status/reasons report exactly what happened.
- **Staleness is recomputed per compute call** from `observedAt` and the injected clock, never persisted: the same stored input evaluates fresh or stale depending on when the score is computed.
- **Freshness-unknown inputs** (no usable `observedAt`) may still contribute but always produce a `scoring_freshness_unknown` warning.

### Publication gates

- `gates.minimumCoverageShare = 0.6`: if the available weight share is below the threshold, `score = null`, `published = false` and the warnings/explanation carry `scoring_coverage_below_threshold` plus the per-component exclusion warnings. (Chosen conservatively per ADR-0009: below the gate there is no score at all, rather than a score with `published: false`.)
- At or above the threshold the numeric score is returned. `published = true` only when **no out-of-range inputs** exist; out-of-range (inconsistent) inputs block publication but keep the numeric score for auditability, with `scoring_out_of_range_block` in the warnings.
- `gates.maximumStalenessHours = 24` is a cross-component ceiling: the effective staleness limit for every component is `min(its own maxAgeHours, 24)`.

## Resort Rating (permanent, 0–100)

`computeResortRating(versionId, categoryValues, { now })` computes the weighted mean of the provided category values. Category values are integers/decimals on the internal **0–100 computation scale** (weights are shares of 1).

- **Categories and weights (v1.0, pinned verbatim from the Master Product Context):** Atmosphere & Environment 15%, Slopes 25%, Lifts 15%, Off-piste 20%, Accommodation 10%, Food 7.5%, Après-ski 7.5%.
- **Missing-value policy:** absent/null/non-numeric/out-of-scale values are skipped, never zero-filled; `coverage.coverageShare = availableWeightSum / 1` is reported with per-category `scoring_category_missing` reasons and the rating re-normalizes over available weights.
- **Publication gate:** `gates.minimumCategoryCoverageShare = 0.8`. Below it: `rating = null`, `published = false`, warning `scoring_coverage_below_threshold`; unpublished results commit to no per-category contributions.
- **Unknown input keys:** extra properties (e.g. foreign review payload keys) are reported in `ignoredInputKeys` and can never influence the rating. If the input contains _only_ unknown keys (or is empty), it cannot be a category payload at all: `computeResortRating` throws `ScoringConfigError` instead of returning a silently empty rating.
- `listResortRatingCategories(versionId)` exposes the public category/weight list.
- The editorial sourcing of category values (who assesses what, with which evidence) remains an open product decision, per the Phase 2 domain model; the compute layer does not seed or fetch values.

## Separation contract (ADR-0009)

Three concepts stay structurally separate:

1. **Conditions Score** — dynamic, computed from live pilot inputs, publication-gated, versioned.
2. **Resort Rating** — permanent, computed only from explicitly provided category values on the 0–100 scale; the module imports nothing and exposes nothing from any external rating or review concept (this is asserted by tests on the public API shape and on the module's imports), and it carries no data source of its own.
3. **External ratings/reviews** — a separate source-scoped domain; nothing in `src/lib/server/scoring/` reads, writes, imports or references them. Unknown keys smuggled into rating input are ignored and reported.

There is no shared mutable state between the two computes; they share only the pure math helpers, the config registry pattern and the message/explanation conventions.

## Versioning policy

- Version ids are registered in `CONDITIONS_SCORE_VERSIONS` / `RESORT_RATING_VERSIONS` and never mutated after registration.
- **Any change to a weight, valid range, clip range, normalization band, staleness limit, gate threshold or the forecast window creates a new version id** (e.g. `v1.1`) and the previous version stays registered so stored scores remain interpretable (ADR-0009).
- The active ids (`CONDITIONS_SCORE_ACTIVE_VERSION_ID`, `RESORT_RATING_ACTIVE_VERSION_ID`) switch only together with a documentation update here and updated pinning tests.
- Resolve functions validate on every call (`resolveConditionsScoreConfig` / `resolveResortRatingConfig` / `validateConfig*`); an unknown or invalid version throws `ScoringConfigError` with stable reason keys such as `scoring_conditions_version_unknown` or `scoring_config_weights_do_not_sum_to_one`.

Current versions: Conditions Score `v1.0` (active), Resort Rating `v1.0` (active).

## How Phase 5 data feeds the layer

`mapPilotResortToConditionsScoreInputs(resort, forecastWindowHours, asOf)` maps one `PilotProductResort` (type-only import from `product-repository.ts`) into `ConditionsScoreInputs`:

- `weather.snow.depthCm` → `snowDepthCm`, `weather.snow.recentSnowfall24hCm` → `recentSnowCm`, both with `weather.snow.observedAt`. **These stay null in the live pipeline today** (phase 5 reality) and are never inferred from other fields.
- Forecast snowfall is summed from `weather.forecast` points with `validAt` in `(asOf, asOf + forecastWindowHours]`, reading `snowfallMm` scaled by `precipitationPeriodHours` (SMHI/MET interval semantics). Points without any numeric snowfall in the window leave the value null — missing data, not zero.
- `status.pistes` / `status.lifts` open/total pass through un-divided with `status.checkedAt` as observation time; the scoring layer's guards turn unknown/zero totals (e.g. Ylläs, Iso-Syöte, Riksgränsen today) into unavailable components and coverage hits.
- `weather.current.airTemperatureC` / `windSpeedMs` map with the current point's `validAt` as observation time (`current: null` → null values).
- `snowQuality` is null with no observation time — no pilot source observes it yet.

Typical pilot outcome: weather is available for 10/10 resorts, ratio components for the resorts with numeric counts, and the snow components are missing — coverage lands around 0.7, above the 0.6 publish gate but visibly reduced, with explicit warnings. A resort with only weather present (coverage 0.35) stays unpublished.

## Test inventory

`tests/scoring/` (Vitest, `server` project, assertions required):

| File                       | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config.spec.ts`           | Active version resolution; eight component ids; weight sums; unknown-version `ScoringConfigError`; frozen configs; Master Context rating weights pinned verbatim; validation rejects bad sums, negative weights, duplicate ids, non-monotonic bands, forbidden zero-fill policies, invalid gates                                                                                                                                      |
| `conditions-score.spec.ts` | Happy path with exact arithmetic (`toBeCloseTo`); byte-identical determinism; deep-frozen inputs; zero/zero and null-total ratio guards; legitimate zero pistes; missing exclusions; unknown category; staleness vs. injected clock; out-of-range blocks publication; coverage gate pass/boundary/fail; monotonic loops (recent snow, lifts, wind, depth); explanation keys; temperature/wind band behaviour; missing clock rejection |
| `resort-rating.spec.ts`    | Master Context weights verbatim; exact weighted-mean arithmetic; determinism; perfect-100 and zero resorts; missing category re-normalization; gate below threshold; all-null categories; empty/unknown-only input throws; non-numeric/out-of-range exclusion; unknown-key ignoring; structural separation tests (public API shape, module imports)                                                                                   |
| `pilot-inputs.spec.ts`     | Phase 5 null-preservation; weather/ratio mapping with observation times; future-proof snow path; purity under deep-freeze; end-to-end window sum feeding the score; window boundary semantics                                                                                                                                                                                                                                         |
| `barrel.spec.ts`           | Public export surface contains no review/external/DB/UI leakage; error class identity                                                                                                                                                                                                                                                                                                                                                 |

## Deliberately deferred

- Persistence (`condition_score_versions`, `condition_score_inputs`, `resort_rating_versions/categories` writes and migrations) — this phase is the pure domain layer only.
- API endpoints, UI components and i18n keys that consume `explanation()` messages.
- Collection-side snow-depth/recent-snowfall sources (phase 5 keeps them null).
- Editorial assessment workflow for Resort Rating values.
- Confidence/freshness synthesis (ADR-0009 item 3) — freshness is reported per input here, not merged into a numeric confidence.
