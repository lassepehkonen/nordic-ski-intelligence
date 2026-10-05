# ADR-0004: Schedule only rights-approved data collectors

- **Status:** Accepted for the Phase 0/1 recommendation; production activation is gated on source approval and commercial terms
- **Date:** 5 October 2026

## Context

The pilot is ten resorts: Ylläs, Levi, Ruka, Himos, Tahko, Iso-Syöte, Åre, Riksgränsen, Trysil and Hemsedal. Official resort pages are primary factual sources where terms and technical restrictions permit. Necessary basic facts may be manually curated with field-level provenance after review; this does not grant automated access or rights to dynamic feeds, page content, images or maps. A public web page is not blanket permission to scrape or store data.

For Finland, FMI exposes documented open weather services with commercial-use terms.[4][5]

For Sweden, SMHI publishes its own open-data licence and service terms.[7][8]

For Norway, MET provides Locationforecast under its data licence and API policy; it offers no standard delivery guarantee or SLA.[1][2]

Daily snow-depth observations are also available through the national station-data services: FMI, SMHI metobs, and MET Frost. Use the nearest station that actually reports a valid snow-depth parameter; a station reading is a proxy, not resort-piste snow depth.[69][127][129]

SMHI documents the current SNOW service and its response/update metadata.[8][9][10]

Open-Meteo's paid Standard plan is an optional future fallback, not an independent guarantee; it is not needed for the current FI/SE/NO pilot because the national forecast sources are the selected path.[13][14]

Mountain News/OnTheSnow has a fee-based Partner API with a snow-report endpoint for depth, snowfall, open lifts and trails.[33][34]

Separate endpoints cover weather, resort profiles and webcam metadata.[35][36][67]

Its public default quota is 10 requests/second and 5,000/day; reports may be stale, and resort updates are often daily.[38] Exact pilot coverage, redisplay/cache/derived-data rights and price remain unconfirmed.

## Decision

Keep **Supabase Cron + small Supabase Edge Functions** as the Phase 0 runtime recommendation for modest, mostly network-bound work. Schedule by source update cadence, stagger requests and record run/provenance state in Postgres. Do not implement or activate a collector until the source rights record in ADR-0008 is `approved`.

Use the following source order:

1. For minimum static resort facts, use official pages as primary sources only through the field-level, terms-aware manual curation path. For snow/lift/piste operations and other dynamic fields, request a documented commercial feed from the resort. In parallel, request a Mountain News quote, ten-resort coverage list and contract covering the actual fields and derived Conditions Score. Public pages without approved reuse remain links for dynamic data.
2. Weather forecasts: FMI WFS in Finland, SMHI's documented SNOW v1 service in Sweden, and MET Locationforecast in Norway. Honor each service's licence/cache/update rules.[6][7][8]
   - No shared fallback is selected in this stage. If a national feed is unavailable or stale, show unavailable/stale instead of substituting another model. Open-Meteo remains deferred unless a specific coverage/availability gap is documented.[13][14]
3. Measured snow depth: query the nearest station that actually publishes a valid snow-depth parameter, once per provider's daily update cycle. Store station identity, distance, elevation, source time and quality; label it as a station observation, not resort snow depth.[69][127][129]
4. Exclude Fnugg for this product unless its owner grants a specific written commercial waiver: its API documentation prohibits data use in services essentially identical to Fnugg and reserves withdrawal of consent.[39]

No public page endpoint is treated as a partner API. Do not reverse-engineer browser network calls, bypass robots/technical restrictions or use scraping to fill a missing feed. For facts, preserve the source URL and verification date and extract only the minimum value needed. If rights, freshness or format is inadequate, show a dynamic field as unavailable/stale rather than silently substituting an unapproved provider.

## Alternatives considered

- **Automated resort-site scraping:** rejected absent explicit source-specific permission and a permitted technical method; the reviewed pages do not provide a general commercial feed, cache period or stable schema. Narrow manual curation of necessary factual basics is governed separately by the official resort-source policy.
- **Mountain News/OnTheSnow Partner API:** preferred commercial quote candidate, but not approved until price, coverage, freshness, cache/retention, score/derived use, attribution and termination rights are in writing.[33][34][38]
- **Fnugg API:** rejected for a competitor-like service under its published use restriction; technical reachability does not override it.[39]
- **FMI/SMHI/MET directly in the browser:** rejected. Keep external sources behind product-owned server-side adapters; avoid leaking visitor IPs or making the UI dependent on third-party availability.[1][7]
- **Open-Meteo:** not selected for this stage because the national services cover the pilot's chosen forecast markets; reconsider the paid Standard plan only if measured gaps justify the extra dependency and cost.[13][14]

## Operational requirements

- For every run, store source/dataset, endpoint, terms version, adapter/parser version, start/end, outcome, accepted/rejected counts, source timestamp, fetch timestamp and last-success time.
- Use bounded retries, jitter, idempotency, schema/range validation, source-specific stale thresholds and preserve the last known good observation.
- MET requests require an identifying User-Agent, respect `Expires`, use `If-Modified-Since`, cache, jitter request times and truncate coordinates to at most four decimal places; MET publishes no delivery SLA.[1][3]
- FMI's current WFS limits are 20,000 Download and 10,000 View requests per user/day, combined 600 per five minutes. SMHI asks for cache-aware use of documented services; neither source's published public API limit is a reason to poll at the maximum.[6][7][8]
- For measured snow, poll once per daily observation cycle, choose the nearest station with a valid snow-depth parameter, and retain station ID, coordinates/elevation, distance, observation time, unit and quality code.[69][127][129]
- Alert on stale feeds; do not claim present conditions when only a previous observation is available.

## Consequences

- Weather can proceed on clearly licensed public data after adapter-level checks; resort operating data is the Phase 1 commercial blocker.
- Nearest-station snow depth can add open observation data, but station coverage, elevation and freshness must be validated per resort; it does not replace an operator snow report.[69][127][129]
- A paid aggregate API may reduce ten bespoke integrations, but freshness/coverage and content rights must be verified per resort.
- Public API availability is not an SLA. Source timestamps and stale states are part of the product contract.
- No collector implementation or production call is authorized by this ADR.

## Revisit when

Reopen this decision after written operator/Mountain News terms, measured feed cadence, approved retention and a test of the exact ten resort IDs. Move a specific adapter to a longer-running worker only if its licensed format/volume exceeds Edge limits; do not change the source-rights gate.

## Sources

[1] https://docs.astro.build/en/guides/internationalization — Internationalization (i18n) Routing | Docs
[2] https://docs.astro.build/en/concepts/islands — Islands architecture | Docs
[3] https://docs.astro.build/en/guides/server-side-rendering — On-demand rendering | Docs
[4] https://svelte.dev/docs/kit/introduction — Introduction • SvelteKit Docs
[5] https://svelte.dev/docs/kit/adapter-netlify — Netlify • SvelteKit Docs
[6] https://nextjs.org/docs/app/guides/internationalization — Guides: Internationalization | Next.js
[7] https://docs.netlify.com/frameworks/sveltekit/overview — 404 | Netlify Docs
[8] https://supabase.com/docs/guides/cron — Cron | Supabase Docs
[9] https://supabase.com/docs/guides/functions/limits — Limits | Supabase Docs
[10] https://supabase.com/docs/guides/database/extensions/postgis — PostGIS: Geo queries | Supabase Docs
[13] https://neon.com/docs/extensions/postgis — The postgis extension - Neon Docs
[14] https://neon.com/pricing — Pricing — Neon
[33] https://inlang.com/m/gerre34r/library-inlang-paraglideJs/changelog — inlang/paraglide-js
[34] https://inlang.com/m/gerre34r/library-inlang-paraglideJs/basics — Basics - Paraglide JS
[35] https://inlang.com/m/gerre34r/library-inlang-paraglideJs/i18n-routing — i18n Routing - Paraglide JS
[36] https://inlang.com/m/gerre34r/library-inlang-paraglideJs/strategy — Strategy - Paraglide JS
[38] https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview — Next.js on Netlify
[39] https://docs.netlify.com/build/frameworks/overview — Overview | Netlify Docs
[67] https://docs.netlify.com/deploy/deploy-notifications — Netlify deploy notifications
[69] https://supabase.com/docs/guides/local-development/testing/overview — Supabase testing overview
