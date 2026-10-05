# ADR-0009: Keep Conditions Score, confidence and Resort Rating separate

- **Status:** Accepted for the Phase 0 domain model
- **Date:** 2026-10-05

## Context

The customer asks which resort has the best conditions now and which resort is best for them. Those are different questions. Conditions change with weather/open status; the resort's comparative quality rating is intended to be more permanent. Data confidence describes evidence quality, not ski quality.

## Decision

Maintain three separate concepts:

1. **Conditions Score:** dynamic 0–100 score, with configurable/versioned inputs, stored calculation details and an explanation. Keep scoring outside UI components and independently testable. Missing, stale or conflicting data remains explicit and must not become a silent zero or an unsupported rank.
2. **Resort Rating:** separately configured, permanent product rating with the Master Product Context's initial categories/weights: Atmosphere & Environment 15%, Slopes 25%, Lifts 15%, Off-piste 20%, Accommodation 10%, Food 7.5%, Après-ski 7.5%. External ratings remain separate and attributed.
3. **Confidence / freshness:** per-metric evidence state using source quality, freshness, validation and agreement. Initially display understandable status and `as of` time; do not publish a numeric confidence until calibration is validated.

The public product may show an explanation and components used by a score version. A score can be hidden or marked unavailable if input coverage is below a defined threshold; it must not rank a resort on incomparable or insufficient data.

## Alternatives considered

- **One combined “best resort” score:** rejected; conflates transient conditions with permanent resort quality and hides why a resort ranks well.
- **ML score at MVP:** rejected; difficult to audit and unnecessary before reliable, sufficiently broad input data exists.
- **Confidence folded into Conditions Score:** rejected; users should be able to distinguish poor conditions from uncertain/stale information.

## Consequences

- Store score version, coefficients, normalized inputs, source observation IDs and component breakdown for each result.
- Changes to weights are versioned and tested; historical scores remain interpretable.
- Resort Rating inputs/ownership and review methodology remain an open product decision before that feature is populated.
- Confidence is not presented as a statistical probability until it has a defensible calibration method.

## Revisit when

Revisit weighting and publication thresholds after the ten-resort data inventory and validation study. Add personalization only as a separate recommendation layer; it must not redefine the public Conditions Score or permanent Resort Rating.
