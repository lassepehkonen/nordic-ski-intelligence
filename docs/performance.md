# Performance

What keeps the product fast, and how it is verified. The guiding rule matches the phase
brief: real Core Web Vitals over theoretical wins — no usability is traded away for
milliseconds.

## Rendering strategy

- **SSR for every page** — the catalogue, resort pages, comparison and the JSON API render on
  the server per request from the live Supabase product read. A crawler (or a slow phone)
  never waits for a client fetch chain to see the conditions.
- **No stale JS-only content** — everything visible in `<body>` is present in the HTML, which
  also keeps LCP independent of the JS bundle.
- **adapter-netlify** functions carry the SSR load; static assets are immutable-hashed.

## JavaScript payload

- The **map is the only heavyweight dependency** (Leaflet + its CSS) and it is imported
  dynamically inside `onMount` (`const L = (await import('leaflet')).default`), so the map
  code is a separate chunk the two list pages never fetch. Measured production build (Vite 8,
  Oct 2026): Leaflet + glue chunk 148.6 kB raw / **42.7 kB gzip**, deferred and never fetched on
  routes without a map.
- The basemap is an on-demand **Esri World_Topo raster tile layer** (browser-cached per tile URL,
  minZoom 3 / maxZoom 17 bounds tile fan-out), with a 16 kB baked-in borders GeoJSON outline and
  DOM country labels in the active language. The old two-GeoJSON offline basemap was replaced by
  the tile layer in the current theme work; `src/lib/assets/geo/nordic-land.json` is now unused
  and kept only until the next data-pipeline pass removes it.
- Route nodes (raw / gzip): home 24.2 kB / 9.1 kB, resorts 15.3 kB / 4.9 kB, resort detail
  31.0 kB / 9.2 kB, compare 11.2 kB / 3.9 kB, layout 9.5 kB / 4.0 kB, entry ~2.6 kB / 1.2 kB —
  so an interactive home page costs ~85–90 kB gzip in the worst case, dominated by the deferred
  Leaflet chunk (largest client chunk ≈44 kB gzipped of Svelte runtime + route code).

## Data loading and caching

| Response                                                                   | Cache-control                                                  |
| -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Product pages (`/`, `/resorts`, `/compare`, `/resort/[slug]` when healthy) | `public, max-age=60, s-maxage=300, stale-while-revalidate=600` |
| Product pages (data source 503)                                            | `no-store`                                                     |
| `/api/v1/resorts`                                                          | same as the product read (60 s browser / 300 s edge / SWR)     |
| `/sitemap.xml`                                                             | `public, max-age=600`                                          |
| `/robots.txt`                                                              | `public, max-age=3600`                                         |
| Hashed static assets                                                       | immutable (adapter default)                                    |

The upstream Supabase read itself is cached in-process by `loadPilotProduct`, so bursty
traffic does not multiply into database requests. Fresh-weather pages stay honest (60 s) while
still absorbing load spikes at the edge (SWR 600 s).

## Images and assets

- The product UI has **no photographic imagery** — the visual load is one share image and
  small SVG artwork, so there is no `<img>` waterfall to optimise.
- `og-image.png` is 1200×630 at ≈26 kB; SVG artwork ships as optimised assets imported with
  `?url` where only the URL is needed.
- Intrinsic `width`/`height` attributes on the few real `<img>` elements prevent layout shift.

## Core Web Vitals posture

| Vital | Why it is safe                                                                                                                   |
| ----- | -------------------------------------------------------------------------------------------------------------------------------- |
| LCP   | SSR HTML carries the headline and first cards; no client fetch gate                                                              |
| CLS   | intrinsic image dimensions, reserved map container, tabular numerals, no font-swap layout shift (system font stack)              |
| INP   | filtering/search/sort run on an in-memory array of ≤10 resorts — sub-millisecond; the map handles wheel/drag with inertia tuning |

## Testing

- **Build gate** — `npm run build` fails the deploy on type/test errors; the Netlify smoke
  plugin (`scripts/netlify-smoke-plugin`) hits `/api/health` after every deploy.
- **Unit/domain/scoring/adapter/API/security suites** (`npm test`) lock the data and caching
  contracts, including the weather-runner's provider-request accounting.
- **SEO contract tests** (`src/lib/seo.test.ts`) keep canonical/hreflang/JSON-LD generation
  correct so metadata regressions surface in CI, not in Search Console.
- **Lighthouse (measured, category scores/100, Chrome headless-shell 155, localhost)** —

  | Page              | Performance | Accessibility | Best practices | SEO |
  | ----------------- | ----------- | ------------- | -------------- | --- |
  | `/en`             | 99          | 100           | 96             | 100 |
  | `/fi`             | 99          | 100           | 96             | 100 |
  | `/en/resorts`     | 99          | 100           | 100            | 100 |
  | `/en/resort/levi` | 98          | 98            | 100            | 66  |
  | `/en/compare`     | 99          | 100           | 100            | 66  |

  Every page: TBT 0 ms, CLS 0, LCP 1.4–1.8 s on the local runner. Known, accepted deductions:
  `image-size-responsive` flags the raster map tiles (a tile pyramid has no srcset mechanism);
  the two SEO 66s are the **degraded preview state** — without local Supabase credentials the
  run saw the `noindex,follow` fallback pages, which is the correct index-safety behaviour, not
  a metadata defect; `heading-order` on the degraded resort page is the same artifact (the
  healthy page renders h1 → card h2s → footer h3). Re-run with credentials on a deployed
  preview URL to clear them.

- Reproduce: `npm run build && npm run preview -- --port 4173 --strictPort`, then
  `CHROME_PATH=<chrome-headless-shell> npx lighthouse http://localhost:4173/en --quiet
--chrome-flags="--headless --disable-gpu --no-sandbox"`. The headless-shell binary is
  downloaded with `npx @puppeteer/browsers install chrome-headless-shell@stable`
  (gitignored).

## What is intentionally not optimised

- No aggressive prefetching of every resort page — ten pages deep-linked from the map and
  lists is cheap enough, and prefetching every marker would weight the home page for clicks
  that do not happen.
- The map keeps scroll-wheel zoom enabled (documented in `MapView.svelte`) despite hover-on-
  map scroll capture: user expectation of an embedded map wins over scroll-jacking concerns.
