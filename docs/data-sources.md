# Phase 1 — data sources and collection plan

- **Reviewed:** 5 October 2026
- **Scope:** initial ten-resort slice in Finland, Sweden and Norway
- **Authority:** [`docs/product/master-context.md`](product/master-context.md); Phase 0 architecture and ADRs
- **Status:** research only. No production collectors, API accounts, scraping jobs, or integrations have been created.

## Executive findings

1. **Pilot resorts:** Finland — Ylläs, Levi, Ruka, Himos, Tahko and Iso-Syöte; Sweden — Åre and Riksgränsen; Norway — Trysil and Hemsedal. This gives ten resorts. The Finnish cut is a working cohort based on operator-published piste counts, not a normalized national ranking.
2. **Forecasts:** FMI WFS is the Finnish primary forecast source under its published open-data terms.[4][5][6]

   SMHI's documented SNOW v1 API is the Swedish forecast source.[7][9][10]

   MET Norway Locationforecast is the Norwegian forecast source.[1][2][3]

   **No shared paid weather fallback is needed in this stage.** Use the national services; if one is unavailable or stale, expose that state rather than silently substituting a different model. Open-Meteo is deferred and would require a separate cost/terms decision if a real coverage gap appears.[13][14]

3. **Measured snow depth:** open weather-station observations can supply a nearest-station proxy—FMI in Finland, SMHI metobs in Sweden, and MET Frost in Norway. Select the nearest valid snow-depth station and display its distance, elevation and measurement time; it is not the resort's piste measurement.[69][127][129]
4. **Separate basic facts from live conditions.** Official resort sites are the primary factual reference where terms and technical constraints permit. Manually curate only necessary basic facts with field-level source URLs and verification dates; this is not blanket permission to scrape or store page content. Dynamic reports, lift/trail status, prices and webcams require specific rights or a licensed feed; request operator permission or a Mountain News quote.[33][34][38]
5. **Static geography:** OpenSkiData is a useful downloadable piste/lift dataset, but ODbL and attribution obligations apply; automated download is limited to once per day.[47]

   JYU's LIPAS data-content terms confirm CC BY 4.0 and commercial use for Finnish facility metadata; cite JYU/LIPAS and the snapshot date. The separate OpenAPI licence label concerns the API-spec metadata, not a hold on the dataset.[119][40][41]

6. **Reviews are not an MVP data source.** Tripadvisor's caching and review-display rules conflict with stored, crawlable SSR content; keep external reviews out of the first slice and preserve the product's own Resort Rating as a separate editorial domain.[54][56][58]

The complete per-source assessment is in [`data-source-matrix.md`](data-source-matrix.md), cost assumptions in [`data-cost-model.md`](data-cost-model.md), and permission/cache rules in [`data-licensing.md`](data-licensing.md).

## Initial resort cohort

Piste totals below are public operator claims/pages checked on the review date; slope definitions and season-to-season counts can differ. Use them to choose a manageable vertical slice, not as validated cross-country comparisons.

| Country | Resort      | Published size signal                                                                                                                           | Official starting point                                                                                        |
| ------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Finland | Ylläs       | Operator describes Ylläs as Finland's largest; official slope map/status pages expose individual piste/lift information.[15][16]                | [Slope map and status](https://ski.yllas.fi/en/slopes-and-lifts/slope-map/)                                    |
| Finland | Levi        | 44 slopes and 26 lifts in the operator's 2026–27 material.[17][18]                                                                              | [Slopes and lifts](https://www.levi.fi/en/ski/slopes-and-lifts/)                                               |
| Finland | Ruka        | 41 slopes and 22 lifts on the operator's current slope page.[19]                                                                                | [Slopes and opening hours](https://www.ruka.fi/en/skiresort/slopes)                                            |
| Finland | Himos       | 26 slopes and 17 lifts in operator material.[20][21]                                                                                            | [Slope information](https://himos.fi/en/skiing/slope-info/)                                                    |
| Finland | Tahko       | 25 slopes and 15 lifts on the operator's skiing page.[22]                                                                                       | [Skiing and snowboarding](https://www.tahko.com/en/things-to-do/activities/skiing-and-snowboarding/)           |
| Finland | Iso-Syöte   | Operator publishes 18 slopes; selected as the next large centre by advertised run count.[23]                                                    | [Slopes and lifts](https://www.isosyote.fi/en/slopes-and-lifts)                                                |
| Sweden  | Åre         | 89 slopes and 47 lifts across three ski areas.[26][27]                                                                                          | [Lifts, slopes and weather](https://www.skistar.com/en/ski-destinations/are/winter-in-are/weather-and-slopes/) |
| Sweden  | Riksgränsen | Separate operator with a public snow/lift/condition board; use it as a distinct source adapter from SkiStar.[28]                                | [Official resort site](https://riksgransen.se/en/)                                                             |
| Norway  | Trysil      | SkiStar calls Trysil Norway's largest: 69 slopes and 41 lifts.[29]                                                                              | [Ski area](https://www.skistar.com/en/ski-destinations/trysil/winter-in-trysil/ski-area/)                      |
| Norway  | Hemsedal    | SkiStar's same resort site presents 47 runs in one section and 51 slopes elsewhere, with 22 lifts; confirm canonical count before using it.[31] | [Resort overview](https://www.skistar.com/en/ski-destinations/hemsedal/winter-in-hemsedal/)                    |

This is a **working pilot cohort, not a certified national top-six ranking**: published counts and counting rules differ, and the research did not find one authoritative complete league table. Iso-Syöte publishes 18 slopes; Vuokatti publishes 14, a useful nearby-size comparator.[23][63] Confirm the final Finnish rank order before signing data contracts. This is not a complete census; if the exact national top-six ranking becomes a product claim, normalize all Finnish centres with one current dataset before publishing it.

## Resort data: what to collect and how

| Field                                   | Preferred source                                                                            | Research result and collection recommendation                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Snow depth, new snow, surface/condition | Resort operator first                                                                       | Operator boards are the authoritative report for the resort's own snow measurements. Capture the operator's reported value, measurement point/altitude and last-updated time. Public boards are not a licence to republish; request a feed or written commercial permission.                                                                                     |
| Open lifts and pistes                   | Resort operator first                                                                       | Status boards and official maps expose current operations, but each site has a different presentation and update cadence. Do not infer per-lift/run states from page appearance or scrape undocumented JSON. Obtain a documented partner endpoint or approved structured export.                                                                                 |
| Ticket prices                           | Official ticket shop                                                                        | Prices vary by date, age, duration, products and promotions. Prefer an approved affiliate/deep link to the official shop; only import and cache price tables if the operator/affiliate agreement permits it and defines refresh timing.                                                                                                                          |
| Resort metadata                         | Official operator pages as primary factual sources, plus a rights-cleared geospatial source | Manually curate only necessary basic facts (identity, location, coordinates, elevation/profile and operator-published totals) where applicable terms and technical restrictions permit. Keep these values separate from changing operations and commercial offers; preserve a field-level source URL and verification date. Do not copy editorial text or media. |
| Webcams                                 | Official webcam page/player                                                                 | Link to the operator's camera or use an explicitly permitted embed. No image downloading, mirroring, computer-vision processing or caching without express rights. A webcam is qualitative evidence, not a snow-depth sensor.                                                                                                                                    |
| Official piste maps                     | Operator map page                                                                           | Deep-link by default. Maps, screenshots and promotional art remain separately copyrighted even if the page is public. Request reuse rights for raster plans; request vector geometry/redisplay rights separately.                                                                                                                                                |
| Lift/run geometry                       | Licensed operator feed; otherwise separately approved OSM/OpenSkiData data                  | Keep static geometry separate from live operating state. ODbL obligations for an imported/modified database require review before joining it to proprietary product data.                                                                                                                                                                                        |

### Per-operator access status

The official pages above expose combinations of slope/lift information, opening hours, maps, ticket-shop links and condition pages. SkiStar pages for Åre, Trysil and Hemsedal share a common public presentation; Riksgränsen and the Finnish resorts are separate operators. Use these official sites as primary references for necessary factual basics where the relevant terms and technical restrictions permit; record facts manually with field-level provenance rather than copying prose. The reviewed public pages do **not** provide an externally licensed, documented commercial feed for dynamic fields. This is a finding about the pages/docs reviewed, not proof that a partner feed does not exist. No automated scraping or reverse-engineering is approved.

The source contract must explicitly cover: fields and resort IDs; update cadence and freshness timestamp; commercial display and translations; use in Conditions Score/confidence; retention and parser fixtures; caching; derived values; attribution; images/maps/webcams; termination and migration. A URL or browser-visible status is insufficient permission.

### Commercial resort-data alternative

Mountain News' OnTheSnow Partner API is a credible quote request. Its documented snow-report endpoint includes base/mid/summit snow depth, recent snowfall, surface conditions, open lifts and open trails.[33][34]

Separate endpoints cover weather, static resort profiles and webcam metadata.[35][36][67]

The provider says most resorts update reports daily and explicitly tells clients to use `updatedAt` because some resorts may be late; this is an aggregator, not a guarantee of real-time operations.[38]

Default partner limits are documented as 10 requests/second and 5,000/day; higher quota is by request. API access is fee-based and needs partner credentials. Public docs do not publish the fee, retention/cache rights, redisplay/score rights, nor confirm IDs/coverage for all ten pilot resorts. Obtain a written quote and a field-by-field licence before relying on it.[33][38]

Fnugg has a technically accessible v1 API with resort search/conditions, but its own documentation forbids using its data in services essentially identical to Fnugg, requires attribution, says data are protected, and reserves the right to withdraw consent. A commercial ski-condition comparison is too close to that restriction; exclude Fnugg unless the owner gives explicit written permission for this product.[39]

## Weather by country

| Market           | Primary                                                                                               | Fallback                                                                     | Limits and operating notes                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Finland          | FMI Open Data WFS forecasts; FMI meteorological-station snow-depth observations where available       | None selected at this stage; show stale/unavailable if FMI data are missing  | FMI's guidance says automated-station snow depth has ±2 cm accuracy; daily readings are made at 08:00 local time (09:00 during summer time).[69] FMI open-data forecasts/observations are CC BY 4.0, with WFS limits of 20,000 Download and 10,000 View requests/day and 600 combined requests per five minutes.[4][5][6] Six forecast points hourly are 4,320 calls per 30-day month.                                                                |
| Sweden           | SMHI SNOW v1 point forecasts plus the separate metobs station-observation API for measured snow depth | None selected at this stage; show stale/unavailable if SMHI data are missing | Metobs parameter 8 is a daily snow-depth value at 06 UTC; prefer CORE stations, which SMHI says are inspected and quality checked, unlike ADDITIONAL stations.[127][131] Open data can be commercially reused under CC BY 4.0 with SMHI attribution.[128] SNOW provides point forecasts; use its creation/update metadata and cache unchanged results.[7][9][10] Two forecast points hourly are 1,440 calls/month; no numeric public quota was found. |
| Norway           | MET Norway Locationforecast forecasts; Frost station observations for measured snow depth             | None selected at this stage; show stale/unavailable if MET data are missing  | Frost lists daily `surface_snow_thickness` observations with standard 06 UTC sampling.[129] Frost requires a client ID; its terms specify response licences, cache headers, heavy traffic above one request/second on average, and no delivery guarantee.[116] Two forecast points hourly are 1,440 calls/month.                                                                                                                                      |
| Denmark (future) | DMI Open Data                                                                                         | None selected; decide only if/when Denmark enters scope                      | DMI's documented data are openly reusable under CC BY 4.0 for commercial purposes with attribution. API use is subject to fair use, caching and update-aware polling; no numeric public request ceiling was identified. DMI is not the primary service for the current FI/SE/NO pilot.[11][12]                                                                                                                                                        |

Use weather data for forecasts, temperature, wind and precipitation—not as a substitute for resort-reported snow depth or lift/piste operations. Keep the chosen model/source, run time, valid time, grid point and licence provenance attached to every observation. No shared fallback is selected in this stage; if the national feed is unavailable or stale, show unavailable/stale rather than silently substituting a different model.

**Deferred — Open-Meteo:** no calls or subscription are planned in this stage. Its free API is non-commercial; the paid Standard plan is currently listed at $29/month for up to one million monthly calls. Revisit only if the national sources leave a documented coverage or availability gap, and recheck terms before purchase.[13][14]

## Measuring snow near a resort with open station observations

Yes—use the closest station that actually publishes a valid **snow-depth** observation, not simply the nearest weather station. Resort/station matching still needs a coverage audit for all ten centres; a nearby station is not guaranteed for every resort or every date.

For each Finnish resort, use a matched LIPAS ski-resort facility point as the spatial anchor only after confirming it represents the actual area; use an operator-validated or rights-cleared point for Sweden and Norway.[42][119] Retain the selected station ID/name, coordinates, elevation, snow-depth variable/unit, observation time, retrieval time, quality flag, distance and elevation difference. Rank only stations that expose the snow-depth parameter and have a recent valid value. Display “station measurement” with the station name, distance and observation time; do not label it as a piste/resort measurement.

FMI's automated weather stations report snow depth with published ±2 cm accuracy; the daily observation is measured at 08:00 local time (09:00 during summer time).[69] FMI's 25 August 2026 changelog concerns **road-weather** observations, which moved to Digitraffic; that separate road-surface dataset is not a substitute for snow depth at an alpine measurement station.[68]

SMHI's metobs API exposes snow-depth parameter 8 once daily at 06 UTC. Prefer its CORE network, whose observations are quality checked and corrected; the API also labels non-CORE stations ADDITIONAL and says their values are not quality checked.[127][131] SMHI permits commercial reuse of open data under CC BY 4.0 with attribution.[128]

For Norway, Frost is the station-observation archive, distinct from Locationforecast; use its daily `surface_snow_thickness` series and standard 06 UTC sampling, with the quality code and response-specific licence retained.[129] Frost requires a registered client ID, respects cache headers and describes average traffic above one request/second as heavy.[85][116]

Treat the station value as a low-to-medium-confidence context signal, adjusted for distance, elevation mismatch, age and quality; keep it separate from an operator-reported resort snow report in the score and UI. If the nearest valid station is too far, too low or stale, show the measurement as unavailable rather than implying the resort has the same snow depth.

## Static geography and maps

- **LIPAS data:** Jyväskylä University's official open-data page assigns CC BY 4.0 to LIPAS content and explicitly permits commercial use. Its REST/WFS/WMS interfaces and extracts support static facility metadata and geometry, not live snow or lift status.[119]
- **Attribution and freshness:** cite `Jyväskylän yliopisto, Lipas-tietokanta` and include the snapshot date; the database is continuously updated and exports can differ over time. The LIPAS guidance supplied in the user's message also recommends acknowledging contributing municipalities and other data providers.[119]
- **Production access:** use a product-owned periodic snapshot, following the production-use recommendation in the LIPAS guidance supplied by the user; the current JYU page documents APIs and downloadable extracts.[119]
- **OpenAPI metadata:** the API descriptor says CC BY-SA while JYU's data-content terms say CC BY 4.0. Treat this as a question about reusing the API specification itself, not a hold on the underlying dataset; avoid copying/re-distributing the descriptor or generated schema code until clarified.[40][41][119]
- **OpenStreetMap (OSM) data:** ODbL data may be used commercially with attribution; derivative databases can carry share-alike obligations. Piste/lift coverage and freshness vary, and the data licence is separate from tile hosting.[44][46]
- **Renderer:** Leaflet is a BSD 2-Clause open-source library; MapLibre GL JS is also open-source. Either renderer has no per-map licence fee and neither supplies hosted tiles.[132][134]
- **Public OSM tiles:** ordinary interactive viewing from `tile.openstreetmap.org` is permitted under its policy, but the endpoint is donation-funded and limited, has no SLA, and the OSM Foundation warns commercial services that access may be withdrawn. Follow attribution, identification, cache and no-bulk/offline/prefetch rules; don't treat it as dependable free production hosting.[45]
- **Tile delivery options:** self-hosting OSM-derived tiles avoids a third-party tile subscription but adds data refresh, tile-generation, hosting and operational costs that are not estimated here. MapTiler Flex is an optional managed provider currently listed at $30/month, with extra traffic billed separately; it is not required by Leaflet or MapLibre.[49]
- **OpenSkiData:** downloadable static resort/run/lift data is the closest open dataset for alpine geometry. The project says the data are free for commercial use under ODbL, must be attributed to OpenSkiData/OpenSkiMap, OSM, Skimap.org, Who's On First and Mapterhorn, and automated downloads must not exceed once per day. It is not a live operations API; its hosted vector-tile service may not be consumed directly. A weekly data refresh is four downloads/month; build/host the product's own licensed tiles if this dataset is selected.[47]
- **OpenSnowMap:** useful for piste/lift discovery, but its data derives from OSM and its rendered layers carry CC BY-SA terms; the site prohibits bulk tile harvesting. Use a permitted data extract/own tile pipeline only after rights review.[48]
- **Alternatives:** Mapbox and Google Maps have different billing counters and terms; see the cost model.[50][51]

## Reviews and alternative sources

Tripadvisor Terra is a documented API with partner packages, rate limits and usage-based pricing.[54][55][57]

Its current cache policy allows storing only Location IDs by default.[56]

The review implementation policy requires reviews to be loaded client-side and kept out of HTML/JS source so search robots cannot index them.[58] That makes reviews unsuitable for an SEO-critical, server-rendered resort page.

If revisited, get a named package and location allowlist, use a client-side optional widget, follow exact attribution requirements, and do not store/score/index the content.[59][60]

Google Places is a technically viable alternative for a small number of displayed reviews, but the API exempts only Place IDs from caching restrictions. Review/photo display needs author attribution and a direct Google Maps source link; EEA billing addresses have separate terms. That makes it a poor source for a persistent, server-rendered review corpus, though any transient use would need its own compliance review. Do not scrape Google review pages or mix transient external reviews into Resort Rating. First-party reviews remain deferred and would need moderation, privacy and abuse controls.[52][53]

## Phase 1 gates before any production ingestion

1. Request written feeds/permissions from the ten operators and a Mountain News quote that enumerates exact pilot resort IDs, fields, update latency, score/derivative rights, retention, attribution, caching, images and price.
2. Use the JYU-published CC BY 4.0 terms for LIPAS data and include JYU/LIPAS plus snapshot-date attribution; clarify the separate OpenAPI spec licence only if reusing the schema or generated documentation.[119][40][41]
3. Complete a licensing review for ODbL-derived geometry before mixing it into a proprietary PostGIS dataset. Before production, choose either a managed tile provider or a self-hosted OSM-derived service; do not rely on the public OSM endpoint as guaranteed commercial capacity.
4. Use national weather feeds only from documented open services and obey each provider's cache/update instructions. Open-Meteo is deferred; revisit it only if a specific national-source coverage/availability gap is documented and cost/terms are approved.
5. Exclude Fnugg, Tripadvisor reviews, Google Places review content, unofficial resort-page scraping and unlicensed webcam/map images from launch scope.
6. Record source freshness and attribution on every displayed value. Curated basic facts need their source URL and verification date; if a required dynamic feed is not licensed or is stale, show unavailable/stale rather than a guessed value. Follow [the official resort-source policy](official-resort-source-policy.md).

No application code or collectors are implemented in this phase.

## Sources

[1] https://api.met.no/doc/TermsOfService — MET Terms of Service
[2] https://api.met.no/doc/License — MET License
[3] https://api.met.no/weatherapi/locationforecast/2.0/documentation — MET Locationforecast API
[4] https://en.ilmatieteenlaitos.fi/open-data — FMI Open Data
[5] https://en.ilmatieteenlaitos.fi/open-data-licence — FMI open-data license
[6] https://en.ilmatieteenlaitos.fi/open-data-manual-fmi-wfs-services — FMI WFS limits and services
[7] https://www.smhi.se/data/om-smhis-data/villkor-for-anvandning — SMHI terms of use
[9] https://opendata.smhi.se/metfcst/snow1gv1 — SMHI SNOW forecast API
[10] https://opendata.smhi.se/metfcst/snow1gv1/get_point_forecast — SMHI SNOW point forecast response
[11] https://www.dmi.dk/friedata/dokumentation/terms-of-use — DMI terms of use
[12] https://www.dmi.dk/friedata/dokumentation-paa-engelsk — DMI Open Data API documentation
[13] https://open-meteo.com/en/pricing — Open-Meteo commercial API pricing
[14] https://open-meteo.com/en/terms — Open-Meteo terms and commercial-use rules
[15] https://ski.yllas.fi/en/slopes-and-lifts/slope-map — Ylläs official slope map
[16] https://ski.yllas.fi/en/slopes-and-lifts — Ylläs official lift and slope information
[17] https://www.levi.fi/en/ski/slopes-and-lifts — Levi official slopes and lifts
[18] https://www.levi.fi/en/news-and-stories/levi-ski-resort-invests-in-the-south-slopes-new-sunny-express-chairlift-for-the-2026-2027-winter-season — Levi 2026-27 resort statistics
[19] https://www.ruka.fi/en/skiresort/slopes — Ruka official slopes page
[20] https://himos.fi/en/skiing/slope-info — Himos official slope status
[21] https://himos.fi/en/central-point-of-skiing-finland — Himos resort facts
[22] https://www.tahko.com/en/things-to-do/activities/skiing-and-snowboarding — Tahko official skiing page
[23] https://www.isosyote.fi/en/slopes-and-lifts — Iso-Syöte official slopes and lifts
[26] https://www.skistar.com/en/ski-destinations/are/winter-in-are/weather-and-slopes — Åre official conditions page
[27] https://www.skistar.com/en/ski-destinations/are/winter-in-are — Åre official resort overview
[28] https://riksgransen.se/en — Riksgränsen official resort page
[29] https://www.skistar.com/en/ski-destinations/trysil/winter-in-trysil/ski-area — Trysil official ski-area facts
[31] https://www.skistar.com/en/ski-destinations/hemsedal/winter-in-hemsedal — Hemsedal official resort overview
[33] https://partner.docs.onthesnow.com — Mountain News Partner API overview
[34] https://partner.docs.onthesnow.com/api-reference/ski-resort-snowreport-api — Mountain News snow-report API
[35] https://partner.docs.onthesnow.com/api-reference/ski-resort-weather-api — Mountain News weather API
[36] https://partner.docs.onthesnow.com/api-reference/ski-resort-profile-api — Mountain News resort-profile API
[38] https://partner.docs.onthesnow.com/faqs — Mountain News partner API limits and freshness FAQ
[39] https://api.fnugg.no/docs/v1 — Fnugg API v1 terms and documentation
[40] https://api.lipas.fi — LIPAS API version documentation
[41] https://api.lipas.fi/v2/openapi.json — LIPAS API v2 OpenAPI specification
[42] https://api.lipas.fi/v2/sports-site-categories — LIPAS sports-site categories
[44] https://www.openstreetmap.org/copyright — OpenStreetMap copyright and ODbL
[45] https://operations.osmfoundation.org/policies/tiles — OpenStreetMap standard tile usage policy
[46] https://osmfoundation.org/wiki/Licence/Licence_and_Legal_FAQ — OSM Foundation license FAQ
[47] https://openskidata.org — OpenSkiData licensing and terms
[48] https://www.opensnowmap.org/iframes/data.html — OpenSnowMap data and tile usage
[49] https://www.maptiler.com/cloud/pricing — MapTiler Cloud pricing
[50] https://www.mapbox.com/pricing — Mapbox public pricing
[51] https://developers.google.com/maps/billing-and-pricing/pricing — Google Maps Platform pricing
[52] https://developers.google.com/maps/documentation/places/web-service/policies — Google Places policies and attribution
[53] https://developers.google.com/maps/documentation/places/web-service/place-details — Google Places Place Details reviews field
[54] https://docs.terra.tripadvisor.com/docs/overview — Tripadvisor Terra platform overview
[55] https://docs.terra.tripadvisor.com/docs/rate-limits — Tripadvisor API rate limits
[56] https://docs.terra.tripadvisor.com/docs/caching-policy — Tripadvisor caching policy
[57] https://docs.terra.tripadvisor.com/docs/usage-based-pricing — Tripadvisor Discover usage-based pricing
[58] https://docs.terra.tripadvisor.com/docs/review-implementation-policy — Tripadvisor review implementation policy
[59] https://docs.terra.tripadvisor.com/docs/api-master-terms — Tripadvisor API master terms
[60] https://docs.terra.tripadvisor.com/docs/display-requirements — Tripadvisor display and attribution requirements
[63] https://vuokatti.fi/en/vuokatti-slopes — Vuokatti Ski Resort
[67] https://partner.docs.onthesnow.com/api-reference/ski-resort-webcams-api — Mountain News Ski Resort Webcams API
[68] https://en.ilmatieteenlaitos.fi/open-data-changelog — Open data changelog - Finnish Meteorological Institute
[69] https://en.ilmatieteenlaitos.fi/guidance-to-observations — Guidance to open data observation - Finnish Meteorological Institute
[85] https://frost.met.no/howto.html — How to use Frost - Frost API - Meteorologisk institutt
[116] https://frost.met.no/termsofuse2.html — Terms Of Use - Frost API - Meteorologisk institutt
[119] https://www.jyu.fi/fi/liikunta/yhteistyo/lipas-liikunnan-paikkatietojarjestelma/avoimet-rajapinnat-ja-ladattavat-lipas-aineistot — LIPAS open interfaces and downloads — Jyväskylä University
[127] https://opendata-download-metobs.smhi.se/api/version/1.0/parameter/8.json — SMHI daily snow-depth station parameter
[128] https://www.smhi.se/data/oppna-data/Information-om-oppna-data/villkor-for-anvandning — SMHI open-data terms
[129] https://frost.met.no/dataclarifications.html — MET Norway Frost data clarifications
[131] https://opendata.smhi.se/metobs/introduction — SMHI meteorological observations API introduction
[132] https://github.com/Leaflet/Leaflet/blob/main/LICENSE — Leaflet license
[134] https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt — MapLibre GL JS license
