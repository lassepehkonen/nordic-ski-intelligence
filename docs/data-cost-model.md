# Phase 1 — data-source cost model

- **Reviewed:** 5 October 2026
- **Currency:** USD unless stated; tax/VAT, FX, hosting, storage, monitoring and engineering labour excluded.
- **Scope:** ten pilot resorts (six FI, two SE, two NO), 30-day planning month.
- **Purpose:** source/API and map-service budget, not a production invoice estimate. Public prices and terms must be rechecked before purchase.

## Assumptions

1. The pilot cohort is Ylläs, Levi, Ruka, Himos, Tahko, Iso-Syöte, Åre, Riksgränsen, Trysil and Hemsedal.
2. Forecast planning assumes one point request per resort per hour, 24 hours/day for 30 days. This is a conservative call budget, **not** permission to poll more often than source update/cache rules allow.
3. If an operator feed supports it, resort operation status is budgeted at four fetches/day/resort. Profiles and webcam metadata are budgeted once/day. Actual update cadence comes from the source contract.
4. Map usage means monthly billed **map sessions** for MapTiler and **web map loads** for Mapbox/Google. These are different vendor counters; this is a planning comparison, not a feature-equivalent quote.
5. Open API calls are counted as individual resort points, not batched requests. Retries are excluded.
6. Snow-depth station observations are queried at most once per day for the nearest valid snow-depth station per resort; this is separate from hourly forecasts.

## Expected monthly usage

| Stream                                                   |                                                         Formula | Expected requests/month | Notes                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------: | ----------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FMI weather — 6 Finnish resorts                          |                                                     6 × 24 × 30 |                   4,320 | 144/day, below FMI's 20,000 Download/day and 10,000 View/day limits; the combined 600-per-5-minute limit also has large headroom at this cadence.[6]                                                                                                                  |
| SMHI SNOW — 2 Swedish resorts                            |                                                     2 × 24 × 30 |                   1,440 | Use `createdTime` and cache unchanged forecasts; no numeric public quota identified.[7][10]                                                                                                                                                                           |
| MET Locationforecast — 2 Norwegian resorts               |                                                     2 × 24 × 30 |                   1,440 | Honor `Expires`/`If-Modified-Since`, use a descriptive User-Agent, jitter calls and avoid duplicate requests.[1][3]                                                                                                                                                   |
| Nearest snow-depth station observations — all 10 resorts |                                                     10 × 1 × 30 |                     300 | Conservative count if queried separately once/day per resort; FMI daily station data, SMHI parameter 8 and MET Frost's daily snow-thickness series are free/open under source-specific terms. Actual nearest-station coverage still needs verification.[69][127][129] |
| Open-Meteo Standard (deferred)                           |                                                               0 |                       0 | No requests, account or subscription planned at this stage. Add only if a documented national-source gap justifies it; current Standard list price is shown below.[13][14]                                                                                            |
| Direct operator status (if licensed)                     |                                                     10 × 4 × 30 |                   1,200 | Per-resort assumption. No current production requests; endpoint count and fee are unknown until feed terms are supplied.                                                                                                                                              |
| Mountain News / OnTheSnow example integration            | (10 × 4 status + 10 × 24 weather + 10 profile + 10 webcam) × 30 |                   9,000 | About 300 requests/day, under its published default 5,000/day quota. Billing units and subscription cost remain contract-specific.[34][35][36][67][38]                                                                                                                |
| LIPAS snapshot — Finnish facility metadata               |                                        1 refresh/week × 4 weeks |                       4 | One product-owned dataset refresh per week rather than point-querying each resort; static identity/geometry, not live conditions. JYU terms permit commercial use under CC BY 4.0 with attribution and snapshot date; no data fee is listed.[119]                     |
| OpenSkiData geometry                                     |                                1 weekly data download × 4 weeks |                       4 | The project permits no more than one automated download/day. Data price is $0; hosting/tiling is separate.[47]                                                                                                                                                        |
| Tripadvisor review widget (optional)                     |                               1 review entity per opened widget |       Traffic-dependent | No cache by default; model actual review-module impressions, not all page visits. See below.[56][57]                                                                                                                                                                  |

Open-Meteo Standard is listed at $29/month for up to one million monthly calls, but it has zero planned usage and zero budget allocation in this stage. Its free API is non-commercial; revisit the paid plan only if national-source coverage or reliability proves insufficient.[13][14]

## Public list prices and alternatives

### Optional managed tile provider — MapTiler Flex

MapTiler Flex is an **optional** managed tile service, not a required renderer. Its current list price is **$30/month**, including 25,000 map sessions and 500,000 API requests; the pricing page lists additional sessions at $2.50/1,000 and extra API requests at $0.15/1,000. MapTiler's Free tier is described as testing/PoC/personal/non-commercial; review Flex's exact commercial, caching and offline terms before signing up. No plan or provider is selected in this stage.[49]

| Monthly MapTiler sessions | Calculation                | Monthly list price |
| ------------------------: | -------------------------- | -----------------: |
|                     5,000 | base plan                  |             $30.00 |
|                    25,000 | included                   |             $30.00 |
|                    50,000 | $30 + 25,000 × $2.50/1,000 |             $92.50 |
|                   100,000 | $30 + 75,000 × $2.50/1,000 |            $217.50 |

These totals assume the 500,000 included API-request pool is not exceeded. Monitor both billed counters; do not assume a map session consumes a fixed number of API requests.

### Open-source renderer and OSM tile delivery

Leaflet is BSD-2-Clause and MapLibre GL JS is open-source; neither renderer carries a per-map licence fee.[132][134]

OSM map data are reusable commercially under ODbL with attribution, but derivatives can have share-alike obligations.[44][46]

The public `tile.openstreetmap.org` endpoint is community-funded, best-effort, and has no SLA; the OSM Foundation warns commercial services that access may be withdrawn.[45]

Self-hosting avoids a managed tile-provider subscription, but tile-generation, update, hosting and operational costs remain unpriced; this is **not** a zero-cost production estimate.

### Mapbox and Google comparison

| Provider/counter         | Published current allowance/price used here                             |                                 Example cost |
| ------------------------ | ----------------------------------------------------------------------- | -------------------------------------------: |
| Mapbox web map loads     | First 50,000/month listed as free; next 50,000 at $5/1,000.[50]         | 50k=$0; 100k≈$250, before other Mapbox SKUs. |
| Google Maps Dynamic Maps | First 10,000/month listed as free; 10,001–100,000 tier is $7/1,000.[51] |                         50k≈$280; 100k≈$630. |

The counters, map SDKs, data rights and other paid features differ. Mapbox's lower entry price does not itself establish MapLibre compatibility or equivalent contractual rights; Google map pricing is not a tile-only quote. These are budget comparators, not approval to switch.

## Source/API spend estimate

| Cost item                                           |                                                                                                                            Low/starting plan |                                                                                                                                         Planning choice | Confidence                                                                                         |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------: | -------------------------------------------------------------------------------------------------- |
| FMI/SMHI/MET forecasts and station-observation APIs |                                                                 $0 published access charge for selected standard open products.[5][128][124] | Primary weather sources plus once-daily nearest valid snow-depth observations; follow each source's licence, rate/cache rules and station quality flags | High for published public terms; no SLA.                                                           |
| Open-Meteo Standard (deferred)                      |                                                                                                   $0 planned now; $29/month if later adopted |                                                                   No current requests or subscription; reconsider only for a proven national-source gap | High for listed price/quota; not in current budget.                                                |
| Leaflet / MapLibre renderer                         |                                                                                                                       $0 library licence fee |                                                                             Renderer choice deferred; either can use a separately selected tile service | High for published open-source licences; feature fit to be checked in a later UI spike.            |
| Self-hosted OSM-derived tiles                       |                                                                                                $0 OSM data licence; serving/hosting unpriced |                                                                          Possible way to avoid a managed tile subscription; not a $0 production service | Low until volume, tile stack and hosting are sized; ODbL review required.                          |
| MapTiler Flex                                       |                                                                                                  $30/month starting plan; overages may apply |                                                                            Optional managed tile provider; not selected or budgeted in current baseline | High for listed base price; confirm current terms/usage at signup.                                 |
| OpenSkiData data                                    |                                                                                                                               $0 dataset fee |                                                                                            Optional static geometry; ODbL, own processing/hosting extra | High for stated dataset terms; legal review still required for derivative database.                |
| LIPAS data                                          |                                                                                                                    $0 dataset/API fee listed |                  Eligible under the JYU-published CC BY 4.0 data terms; use a periodic snapshot and include LIPAS/JYU plus snapshot date in attribution | High for the data licence; clarify API-spec metadata only if reusing the spec.                     |
| Official resort feeds                               |                                                                                                                                Not published |                                                                                 Request each operator's price and fields; do not scrape as a substitute | **Unknown; critical blocker.**                                                                     |
| Mountain News Partner API                           |                                                                                                         Fee-based; no public rate card found |                                                                                 Request coverage, price, unit definition and rights for all ten resorts | **Unknown; critical quote.**                                                                       |
| Tripadvisor Terra Discover                          | First 1,000 billable entities/account are lifetime-free; then usage-based tiers, beginning at $0.015/entity in the first published band.[57] |                                                                                   Exclude from MVP; if revisited, pay per non-cached review-widget load | Medium: public prices exist, but package/location eligibility and display policy must be approved. |

Tripadvisor's published Discover rate table starts at $0.015 per billable entity in the first invoice-cycle band and steps down with higher volume.[57]

After the account's one-time free lifetime allowance is exhausted, 1,000 paid entities in a billing cycle cost $15 at that entry rate.[57]

A review widget request is driven by actual display events because default content caching is not permitted; confirm the package's billing unit before estimating more.[55][56]

The default review display rules also conflict with indexable SSR pages.[58]

## Budget scenarios

The selected national forecast and station APIs have no published access charge in their standard open-data terms; Open-Meteo is deferred and has no planned calls or subscription.[5][128][124]

The usage envelope includes up to 300 daily station-observation reads/month and four weekly LIPAS snapshots; actual station coverage is unverified. LIPAS content is CC BY 4.0 and its dataset use has no listed fee.[119]

Leaflet and MapLibre are both free/open-source renderers, but neither supplies map tiles.[132][134] OSM-derived data carry no data-licence fee under ODbL; self-hosted tile generation, servers, storage, updates and operations are not costed.[44]

| Map option                                          | Renderer/data licence                                                         | Tile delivery cost                                                                                                                              | Budget implication                                             |
| --------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Leaflet + public OSM tiles (prototype only)         | $0 library/data licence                                                       | No per-request bill for compliant interactive viewing; service is best-effort, has no SLA and may withdraw access from commercial services.[45] | Not an acceptable guaranteed production cost assumption.       |
| Leaflet or MapLibre + self-hosted OSM-derived tiles | $0 renderer fee; OSM data licence has no fee, with ODbL duties.[44][132][134] | Hosting, tile generation, storage and operations not estimated.                                                                                 | Potentially no managed-provider bill, but total is TBD—not $0. |
| Leaflet or MapLibre + MapTiler Flex                 | $0 renderer fee.[132][134]                                                    | Current Flex list price starts at $30/month; extra traffic is billed.[49]                                                                       | Optional managed alternative; no account/provider selected.    |

These scenarios exclude operator-feed/Mountain News quotes, taxes, monitoring, storage, application hosting, and any self-hosted tile infrastructure. Tripadvisor is also excluded. Do not present an all-in monthly cost until map delivery and hosting are selected.

Open-Meteo Standard remains a future option at the currently listed $29/month, but it is not part of this stage's spend baseline; add it only if national-source coverage or reliability proves inadequate.[13][14]

## Decision and cost gates

- Carry **$0 planned spend for the selected public weather/LIPAS data sources and renderer licences**, not a $0 all-in service cost.
- Do not purchase MapTiler now. Compare self-hosting against the current $30/month Flex entry plan after traffic, hosting and tile-generation requirements are estimated.[49]
- Keep Open-Meteo deferred; add it only after documenting a specific national-source coverage/availability gap and rechecking current commercial terms.[13][14]
- Do not present resort-feed or Tripadvisor costs as $0: neither commercial access nor exact data rights are established by a public price page.
- Seek a Mountain News quote in parallel with direct resort-feed requests. Compare total price, coverage, data freshness, user-facing attribution, cache/retention, redistribution, score/derived-data permission, and termination rights—not just request limits.
- Recheck every price, quota and commercial-use term immediately before account creation or launch. No paid account has been created in this phase.

## Sources

[1] https://api.met.no/doc/TermsOfService — MET Terms of Service
[3] https://api.met.no/weatherapi/locationforecast/2.0/documentation — MET Locationforecast API
[5] https://en.ilmatieteenlaitos.fi/open-data-licence — FMI open-data license
[6] https://en.ilmatieteenlaitos.fi/open-data-manual-fmi-wfs-services — FMI WFS limits and services
[7] https://www.smhi.se/data/om-smhis-data/villkor-for-anvandning — SMHI terms of use
[10] https://opendata.smhi.se/metfcst/snow1gv1/get_point_forecast — SMHI SNOW point forecast response
[13] https://open-meteo.com/en/pricing — Open-Meteo commercial API pricing
[14] https://open-meteo.com/en/terms — Open-Meteo terms and commercial-use rules
[34] https://partner.docs.onthesnow.com/api-reference/ski-resort-snowreport-api — Mountain News snow-report API
[35] https://partner.docs.onthesnow.com/api-reference/ski-resort-weather-api — Mountain News weather API
[36] https://partner.docs.onthesnow.com/api-reference/ski-resort-profile-api — Mountain News resort-profile API
[38] https://partner.docs.onthesnow.com/faqs — Mountain News partner API limits and freshness FAQ
[44] https://www.openstreetmap.org/copyright — OpenStreetMap copyright and ODbL
[45] https://operations.osmfoundation.org/policies/tiles — OpenStreetMap standard tile usage policy
[46] https://osmfoundation.org/wiki/Licence/Licence_and_Legal_FAQ — OSM Foundation license FAQ
[47] https://openskidata.org — OpenSkiData licensing and terms
[49] https://www.maptiler.com/cloud/pricing — MapTiler Cloud pricing
[50] https://www.mapbox.com/pricing — Mapbox public pricing
[51] https://developers.google.com/maps/billing-and-pricing/pricing — Google Maps Platform pricing
[55] https://docs.terra.tripadvisor.com/docs/rate-limits — Tripadvisor API rate limits
[56] https://docs.terra.tripadvisor.com/docs/caching-policy — Tripadvisor caching policy
[57] https://docs.terra.tripadvisor.com/docs/usage-based-pricing — Tripadvisor Discover usage-based pricing
[58] https://docs.terra.tripadvisor.com/docs/review-implementation-policy — Tripadvisor review implementation policy
[67] https://partner.docs.onthesnow.com/api-reference/ski-resort-webcams-api — Mountain News Ski Resort Webcams API
[69] https://en.ilmatieteenlaitos.fi/guidance-to-observations — Guidance to open data observation - Finnish Meteorological Institute
[119] https://www.jyu.fi/fi/liikunta/yhteistyo/lipas-liikunnan-paikkatietojarjestelma/avoimet-rajapinnat-ja-ladattavat-lipas-aineistot — LIPAS open interfaces and downloads — Jyväskylä University
[124] https://www.met.no/en/free-meteorological-data/Licensing-and-crediting — MET Norway data licensing and crediting
[127] https://opendata-download-metobs.smhi.se/api/version/1.0/parameter/8.json — SMHI daily snow-depth station parameter
[128] https://www.smhi.se/data/oppna-data/Information-om-oppna-data/villkor-for-anvandning — SMHI open-data terms
[129] https://frost.met.no/dataclarifications.html — MET Norway Frost data clarifications
[132] https://github.com/Leaflet/Leaflet/blob/main/LICENSE — Leaflet license
[134] https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt — MapLibre GL JS license
