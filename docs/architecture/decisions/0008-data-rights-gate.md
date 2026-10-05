# ADR-0008: Make source rights an activation gate for data ingestion

- **Status:** Accepted; expanded by Phase 1 source and licence research
- **Date:** 5 October 2026

## Context

The product is commercial and relies on resort, weather, map, ticket, webcam and review information. A public URL, an API response or an open-data label does not by itself prove the right to collect, retain, transform, score, translate, cache, redistribute or monetize a particular field. The Master Product Context requires endpoint-level licence and term records.

Phase 1 found commercial reuse terms for selected FMI open weather data.[4][5]

SMHI's open data has separate commercial-use terms.[7][8]

MET's licence and API terms provide another attribution-and-request-rule basis.[1][2]

The reviewed resort pages do not grant a commercial feed.[15][20][22]

Mountain News is fee-based and needs a contract for redisplay/retention/derived rights.[33][34]

JYU's published LIPAS data terms explicitly allow commercial use under CC BY 4.0. A separate CC BY-SA label appears in the V2 OpenAPI metadata, so distinguish the dataset licence from API-spec reuse.[119][40][41]

Fnugg's published terms exclude services essentially identical to Fnugg.[39]

## Decision

Maintain a source/dataset rights record and make `approved` status a prerequisite for scheduled collection and customer-facing display. Missing, pending, conflicting, expired or unclear approval fails closed: no production fetch, raw storage, score calculation or silent source substitution.

For each source/dataset/endpoint, record: owner/contact; exact endpoint and fields; dataset and licence/contract; terms version and check date; commercial-use scope; attribution; modification/derivative/score rights; cache and raw/derived retention limits; request/rate rules; display/SEO/mobile restrictions; price and billing unit; expiry/termination/export; status and reviewer.

### Phase 1 status by class

- **Eligible in principle, subject to endpoint/product checks:**
  - FMI open forecasts and meteorological-station snow depth under CC BY 4.0; keep road-weather observations separate.[4][5][69]
  - SMHI forecasts and metobs snow-depth observations are covered by its open-data attribution terms; prefer quality-checked CORE stations.[127][128][131]
  - MET Locationforecast follows its own API policy; Frost station-observation licences are carried per response.[1][116][124]
  - Frost snow-depth data are daily station observations; validate the response licence, client ID and quality code.[85][129]
  - DMI is a future-market CC BY 4.0 source.[11][12]
- **Paid commercial terms required:** Open-Meteo Standard; never use its free non-commercial API in the commercial product.[13][14]
- **Conditional, narrow path:** use official resort websites as primary factual references where permitted. Minimum basic facts may be manually curated with field-level source URLs and verification dates after checking terms, robots directives and technical restrictions. This is not a blanket commercial grant or approval for automated collection, dynamic-status feeds, ticket prices, score derivatives, copied prose, images, maps or substantial database extracts.[15][20][22] Request specific permission/feed for those uses; otherwise deep-link. Do not bypass restrictions or scrape.
- Webcam images and piste-map artwork remain separate rights questions.[28][29]
- **Conditional contract:** Mountain News/OnTheSnow. Obtain per-resort coverage and rights for display, storage, normalizing, Conditions Score, attribution, cache, terms changes and termination before enabling.[33][34][38]
- **Eligible in principle:** LIPAS dataset content under JYU's CC BY 4.0 terms; attribute Jyväskylän yliopisto/LIPAS and snapshot date.[119]
- **Separate API-spec note:** avoid copying/re-distributing the V2 OpenAPI document or generated schema until its CC BY-SA metadata is clarified; this does not block use of the dataset under the published data terms.[40][41]
- **Conditional open geography:** OSM data are ODbL, with attribution and possible share-alike obligations for derived databases.[44][46]
- The public OSM tile policy is separate and excludes bulk/prefetch use.[45]
- OpenSkiData is ODbL.[47]
- OpenSnowMap rendered layers add CC BY-SA conditions.[48]
- **Excluded:** Fnugg absent a written waiver because of its competitor-product restriction.[39]
- **Not MVP:** Tripadvisor review content cannot be cached by default and is subject to client-only/non-indexing display rules.[54][56][58]
- Google Places permits indefinite storage of Place IDs only; review/photo use requires author attribution, direct source links and EEA-term checks.[52][53]

Raw payloads and parser fixtures are retained only if the approved source terms allow those uses. A source terms change pauses that adapter until reviewed. Attribution is rendered from the approved source record and verified as a product requirement. A licence to the basemap does not license official piste geometry or webcams.

## Alternatives considered

- **Treat public access as permission:** rejected; no legal basis for commercial redistribution or storage.
- **Conflate a data licence with API-spec metadata:** rejected. Decide dataset reuse from the published data-content terms and review API documentation/specification reuse separately, as the LIPAS metadata illustrates.[40][41][119]
- **Keep rights notes only in prose:** rejected; production adapters need a machine-checkable approval gate and the ability to stop collection.
- **Allow unapproved sources behind a feature flag:** rejected; a flag does not create permission for collection or retention.

## Consequences

- Rights for dynamic resort feeds remain schedule-critical; if access is denied, reduce fields or resort count rather than scrape. Minimum static facts may be manually curated only through the field-level review in the official resort-source policy. LIPAS content is eligible under the published CC BY 4.0 terms; clarify only the API-spec metadata if it is to be reused.[40][41][119]
- Weather data can proceed only from explicitly open products with attribution and request rules configured.
- ODbL-derived geography needs a reviewed plan for source attribution and any modified database before it is merged into proprietary data.
- A legal/business reviewer must confirm the applicable terms; this ADR is not legal advice.
- No production collectors or data subscriptions are authorized by this ADR.

## Revisit when

Update source records when contracts, terms, fields or jurisdictions change. Re-review before enabling webcams, user reviews, off-piste geometry, ticket prices, affiliate content or any new commercial provider.

## Sources

[1] https://docs.astro.build/en/guides/internationalization — Internationalization (i18n) Routing | Docs
[2] https://docs.astro.build/en/concepts/islands — Islands architecture | Docs
[4] https://svelte.dev/docs/kit/introduction — Introduction • SvelteKit Docs
[5] https://svelte.dev/docs/kit/adapter-netlify — Netlify • SvelteKit Docs
[7] https://docs.netlify.com/frameworks/sveltekit/overview — 404 | Netlify Docs
[8] https://supabase.com/docs/guides/cron — Cron | Supabase Docs
[11] https://supabase.com/pricing — Pricing & Fees | Supabase
[12] https://supabase.com/docs/guides/platform/regions — Available regions | Supabase Docs
[13] https://neon.com/docs/extensions/postgis — The postgis extension - Neon Docs
[14] https://neon.com/pricing — Pricing — Neon
[15] https://developers.cloudflare.com/workers/configuration/cron-triggers — Cron Triggers · Cloudflare Workers docs
[20] https://docs.netlify.com/deploy/deploy-overview — Deploy overview | Netlify Docs
[22] https://docs.railway.com/reference/cron-jobs — Cron Jobs | Railway Docs
[28] https://www.maptiler.com/cloud/pricing — Flexible pricing for maps, data processing & storage | MapTiler
[29] https://www.mapbox.com/pricing — Mapbox pricing
[33] https://inlang.com/m/gerre34r/library-inlang-paraglideJs/changelog — inlang/paraglide-js
[34] https://inlang.com/m/gerre34r/library-inlang-paraglideJs/basics — Basics - Paraglide JS
[38] https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview — Next.js on Netlify
[39] https://docs.netlify.com/build/frameworks/overview — Overview | Netlify Docs
[40] https://docs.netlify.com/build/frameworks/framework-setup-guides/vite — Vite on Netlify
[41] https://docs.netlify.com/build/frameworks/framework-setup-guides/tanstack-start — TanStack Start on Netlify
[44] https://docs.netlify.com/build/async-workloads/optional-configuration — Optional Configuration | Netlify Docs
[45] https://docs.netlify.com/build/functions/lambda-compatibility — Lambda compatibility for Functions | Netlify Docs
[46] https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows — Events that trigger workflows - GitHub Docs
[47] https://docs.github.com/actions/managing-issues-and-pull-requests/scheduling-issue-creation — Scheduling issue creation - GitHub Docs
[48] https://docs.github.com/en/actions/how-tos/troubleshoot-workflows — Troubleshooting workflows - GitHub Docs
[52] https://developers.cloudflare.com/workers/examples/cron-trigger — Setting Cron Triggers · Cloudflare Workers docs
[53] https://developers.cloudflare.com/workers/examples/multiple-cron-triggers — Multiple Cron Triggers · Cloudflare Workers docs
[54] https://developers.google.com/maps/documentation/javascript/usage-and-billing — Maps JavaScript API Usage and Billing - Google for Developers
[56] https://developers.google.com/maps/documentation/javascript/load-maps-js-api — Load the Maps JavaScript API - Google for Developers
[58] https://developers.google.com/maps/documentation/javascript/error-messages — Error Messages | Maps JavaScript API - Google for Developers
[69] https://supabase.com/docs/guides/local-development/testing/overview — Supabase testing overview
[85] https://docs.netlify.com/build/configure-builds/build-hooks — Netlify Build hooks
