# ADR-0005: Separate the map renderer from tile delivery; defer provider choice

- **Status:** Revised after Phase 1 research; renderer and tile-delivery provider remain unselected, no account purchased
- **Date:** 5 October 2026

## Context

The product is map-first. Resort outlines, lifts and piste geometries are separate data assets from the basemap renderer and hosted tiles. Open map data, hosted tile terms and official resort maps/webcams have different rights. The Phase 1 cohort is ten resorts across FI/SE/NO.

## Decision

Keep the renderer and tile source as separate decisions. Leaflet (BSD 2-Clause) and MapLibre GL JS are both no-fee open-source renderer candidates; neither supplies a hosted tile service. Evaluate Leaflet first for a simple 2D MVP, and retain MapLibre if vector styling or richer future layers require it.[132][134]

OSM data can be reused commercially under ODbL with attribution and possible share-alike duties for derivative databases.[44][46] The public `tile.openstreetmap.org` service permits compliant interactive viewing, but it is community-funded, best-effort, has no SLA, and the OSM Foundation warns that commercial access can be withdrawn.[45]

Do not select a paid or self-hosted tile source yet. MapTiler Flex is an optional managed provider with a current $30/month starting price and additional traffic charges; its exact commercial/cache terms still require review before signup.[49] Self-hosted OSM-derived tiles may avoid a provider subscription but bring unpriced data-refresh, tile-generation and hosting operations.

Keep style URL, token, attribution, cache settings and provider-specific limits in configuration. Product-owned PostGIS geometry may contain only data with an approved source right. The provider's basemap licence does not grant rights to copy resort piste maps, lift/run status, webcams or promotional imagery.

## Alternatives considered

- **Leaflet:** the leading simple 2D candidate; BSD 2-Clause licensed and suitable for commercial modification/use. It does not include a map dataset or tile service.[132][133]
- **MapLibre GL JS:** retain if vector styling or later complex layers make its WebGL renderer useful; its open-source licence also has no per-map fee, and it provides no tiles.[134]
- **OSM public tile server:** normal interactive viewing is permitted if the policy is followed, but the community-funded endpoint has no SLA and may withdraw access from commercial services. Use for prototypes only, not as a guaranteed production host; no bulk, offline or prefetch use.[45]
- **Mapbox:** its public pricing lists up to 50,000 web map loads/month as free and the next band at $5/1,000. Its billing unit and SDK/terms are not equivalent to MapTiler sessions; recheck compatibility and terms before replacing the vendor-neutral renderer approach.[50]
- **Google Maps Platform:** Dynamic Maps currently lists 10,000 monthly loads free, then $7/1,000 in the 10,001–100,000 band. It is a broader platform, not a tile-only comparison; its Places policy also constrains content display/storage.[51][52]
- **OpenSnowMap hosted tiles:** excluded from current production recommendation because its layers carry CC BY-SA conditions and its data page prohibits bulk tile harvesting.[48]
- **Self-hosted OSM/OpenSkiData tiles:** possible after ODbL/CC BY-SA review, but requires extract refresh, tile generation, hosting, attribution and operations. Compare after tile traffic and hosting needs are known.[44][47][48]

## Cost envelope

If MapTiler Flex is selected, the current map-only comparison is $30/month through 25,000 sessions, $92.50 at 50,000 sessions and $217.50 at 100,000 sessions; these totals assume the 500,000 included API-request pool is not exceeded. This is an optional managed-provider scenario, not the current budget baseline. Mapbox/Google use different counters, so compare with each provider's current calculator after traffic is measured.[49][50][51]

## Consequences

- Renderer and tile hosting stay separate and replaceable; resort-domain geometry remains independent of basemap styling.
- Leaflet is the leading 2D renderer candidate, but no frontend choice is implemented in this phase.
- A zero renderer/data-licence fee does not mean zero production map cost: self-hosted tile infrastructure is unpriced, while managed providers charge separately.
- Add required OSM/provider attribution. The public OSM endpoint is allowed for compliant interactive use but is not a guaranteed service for paying customers.
- Measure sessions and API requests separately if a managed plan is later selected. No map account has been created or billed.

## Revisit when

Choose the renderer in the first UI/map spike, then price self-hosting and managed tile providers against expected traffic, coverage, cache/offline needs and support requirements. Recheck current contract terms and selected resort-geometry rights before launch; keep the renderer/provider interface replaceable.

## Sources

[44] https://docs.netlify.com/build/async-workloads/optional-configuration — Optional Configuration | Netlify Docs
[45] https://docs.netlify.com/build/functions/lambda-compatibility — Lambda compatibility for Functions | Netlify Docs
[46] https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows — Events that trigger workflows - GitHub Docs
[47] https://docs.github.com/actions/managing-issues-and-pull-requests/scheduling-issue-creation — Scheduling issue creation - GitHub Docs
[48] https://docs.github.com/en/actions/how-tos/troubleshoot-workflows — Troubleshooting workflows - GitHub Docs
[49] https://docs.github.com/en/enterprise-server@3.22/actions/how-tos/troubleshoot-workflows — Troubleshooting workflows - GitHub Enterprise Server 3.22 Docs
[50] https://docs.github.com/en/enterprise-server@3.17/actions/tutorials/manage-your-work/schedule-issue-creation — Scheduling issue creation - GitHub Enterprise Server 3.17 Docs
[51] https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled — Scheduled Handler · Cloudflare Workers docs
[52] https://developers.cloudflare.com/workers/examples/cron-trigger — Setting Cron Triggers · Cloudflare Workers docs
