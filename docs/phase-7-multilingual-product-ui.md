# Phase 7 — Multilingual product UI

Customer-facing product on top of the Phase 4–6 pipeline, shipped in four languages as **one**
application. Locale routing follows [ADR-0007](../architecture/decisions/0007-i18n-routing.md).

## What the product does

| Surface                                   | What it shows                                                                                                                                                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home (`/`)                                | Map-first catalogue: Leaflet map with resort markers, Conditions Score per resort, filters (country, minimum score, fresh snow, open pistes), free-text search, sort, "best conditions" and "fresh snow" highlights, and a result list with per-resort key figures. |
| Resort (`/resort/[slug]`)                 | Current conditions, Conditions Score with its full breakdown, snow, lifts, pistes, weather and hourly forecast, terrain, Resort Rating state, every attributed source and the last-updated time.                                                                    |
| Comparison (`/compare?compare=slug,slug`) | Two to four resorts side by side: conditions, status, snow, weather, terrain and rating state, with the best published score marked.                                                                                                                                |
| API (`/api/v1/resorts`)                   | The same filtered, localized JSON product view for machine consumers.                                                                                                                                                                                               |
| SEO                                       | Localized titles/descriptions, canonical URLs, `hreflang` alternates for every locale plus `x-default`, Open Graph tags, JSON-LD (`ItemList`, `TouristAttraction`, `Dataset`), `/sitemap.xml` with per-URL alternates and `/robots.txt`.                            |

## Languages

`en` (base), `fi`, `sv`, `no`. Nothing in the UI is hard-coded: every string, number, date and unit
comes from `messages/<locale>.json` through Paraglide plus the helpers in `src/lib/i18n/format.ts`.

- **Locale routing** — `/en`, `/fi`, `/sv`, `/no` prefixes; the URL strategy is
  `['url', 'preferredLanguage', 'baseLocale']`, so a bare `/` (or any unprefixed URL) redirects to
  the visitor's preferred language and falls back to the base locale.
- **Fallback** — an unknown locale path is not routable (404) but an unprefixed path always resolves
  through `preferredLanguage` → `baseLocale`; a missing message would fail the build, not the runtime
  (see the key-parity test below).
- **Switcher** — `LocaleSwitcher.svelte` links to the _same_ page in every other language using the
  hreflang alternates computed server-side, with `hreflang`/`lang` attributes and the locale's own
  language name as the accessible title.
- **Metadata** — `buildSeo()` produces canonical + alternates + OG per page; resort pages carry
  localized titles with the resort and region interpolated.
- **Non-localized routes** — `/api/*`, `/sitemap.xml`, `/robots.txt` are excluded from locale
  rewriting in `project.inlang/paraglide.config.js`.

## Data flow

```
Supabase RPC get_pilot_product   (10 pilot resorts, status/weather/snow snapshots)
  → src/lib/server/resorts/product-handler.ts   (cached read, HTTP semantics)
  → src/lib/server/resorts/product-view.ts      (Phase 5 read model + Phase 6 scoring → UI DTOs)
  → src/lib/server/resorts/product-query.ts     (filter/search/sort/highlight/compare, pure)
  → routes (+page.svelte / resort / compare / api/v1)
```

Both the UI and the JSON API consume the same query contract, so a filter can never mean two
different things. Missing data stays explicit end to end: a metric the resort does not report is
`null` (rendered `—`), never `0`, and a Conditions Score that fails the coverage gate is published
as `published: false` with its `scoring_*` gate reason instead of a ranking.

## Design

A calm Nordic outdoor aesthetic, implemented as tokens in `src/lib/styles/app.css`: cold paper
surfaces, one fjord accent, snow-green for good conditions, rust for warnings, a single type scale,
tabular numerals for all figures, and a dark scheme via `prefers-color-scheme`. The map is Leaflet
over Natural Earth public-domain geometry generated into `src/lib/assets/geo/*.json` — **no tile
server**, ~45 kB for both layers, markers coloured from the same design tokens as the rest of the UI,
land/water/border drawn from dedicated `--map-*` tokens, and country names drawn in the active
language. Markers carry accessible names in the active language and the zoom controls are
localized; the result list is the keyboard-accessible equivalent of the map.

## Tests

- `tests/i18n/catalogue.spec.ts` — four locales have identical key sets, identical placeholders, no
  empty values, untranslated unit symbols, and every `m.*()` call in `src/` resolves to a key.
- `tests/domain/product-view.spec.ts` — score publication and withholding, missing inputs excluded
  rather than zeroed, stale inputs dropped, terrain ratios (0 ≠ unknown), sources, last-updated.
- `tests/domain/product-query.spec.ts` — query parsing/clamping, filters (including "an unpublished
  score never satisfies a minimum"), sorting, highlights and comparison selection.
- `npm run check`, `npm run lint`, `npm run format:check`, `npm run build` all pass.

## Deployment and verification

The product runs as Netlify serverless SSR, so the Supabase credential must exist in the **site's
environment variables**, not only in a local `.env`:

| Variable                   | Scopes · context                                  | Notes                                                      |
| -------------------------- | ------------------------------------------------- | ---------------------------------------------------------- |
| `SUPABASE_URL`             | builds, functions, post_processing, runtime · all | project URL                                                |
| `SUPABASE_PUBLISHABLE_KEY` | same                                              | publishable/anon key; the product RPC is granted to `anon` |

`src/env.ts` declares both with `static: false`, so `$app/env/private` resolves them inside the
running function. Two lessons worth keeping:

- A variable created through the API with the **secret** flag set never persisted (the site ended up
  with `SUPABASE_URL` only) and the function booted with `configuration_missing`. Storing the
  publishable key as a normal variable fixed it. `/api/v1/resorts` now answers
  `{ error, reason, upstreamStatus }`, so this failure class is diagnosable from outside the build
  logs — a temporary diagnostics route was used to prove the function could see one variable and not
  the other, then removed.
- A push to the branch rebuilds the deploy preview in one to two minutes, and the preview alias
  always serves the newest _successful_ deploy, so a failed build silently leaves the previous one
  live. Verify the running function (`/api/v1/resorts`), not the build status.

Verified on the preview `https://deploy-preview-7--nordic-ski-intelligence.netlify.app`:

- all four locales render localized titles, `hreflang` + `x-default`, locale-prefixed canonical URLs
  and ten resort links built from Supabase data; `/` redirects into a locale;
- `/xx/resort/levi` renders conditions, score breakdown, forecast, rating state and sources in each
  language, and `/xx/compare?compare=levi,ruka` the side-by-side table;
- `/sitemap.xml` (48 `xhtml:link` alternates), `/robots.txt`, `/api/v1/resorts` (10 resorts, 7
  published scores, unreported snow depth `null`);
- in a real browser the map mounts ten markers over the Natural Earth basemap with no tile requests,
  localized zoom-button labels and per-marker accessible names.

## Deliberate limits

- **Resort Rating** is wired to the Phase 6 config but stays `published: false` with the seven
  configured weights and the publish-gate reason: no approved editorial scale or values exist yet
  (ADR-0009). The UI explains the state instead of inventing a number.
- **Snow depth, 24 h snowfall and snow quality** are `null` for every pilot resort because the
  Phase 5 collection pipeline does not publish them yet; the components show their scoring reasons.
- The map is decorative geography plus markers: there is no routing, elevation or lift-line
  geometry, and no user accounts or favourites.
