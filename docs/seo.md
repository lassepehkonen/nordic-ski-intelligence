# SEO

Every public surface is localized metadata-first: titles, descriptions, canonical URLs, hreflang
alternates, Open Graph, JSON-LD, a dynamic XML sitemap and robots.txt all come from one pipeline,
and nothing is hand-rolled per route.

## Locale routing and canonical URLs

Locale prefixes follow [ADR-0007](architecture/decisions/0007-i18n-routing.md): `/en`, `/fi`, `/sv`,
`/no`; an unprefixed URL resolves through `preferredLanguage` → `baseLocale` (Paraglide URL
strategy). Canonical URLs **always carry the locale prefix** - the canonical of the English home
page is `https://<origin>/en`, never the bare `/`.

- **Canonical + alternates** - `buildSeo()` in `src/lib/seo.ts` builds both. Every locale links to
  every other locale **including itself** (Google's expectation for self-referencing hreflang) plus
  `x-default` pointing at the base locale (`en`).
- **Query strings** - only validated query keys are preserved on canonical/alternate links (the
  compare page keeps its `compare=slug,slug` selection); stray parameters are dropped instead of
  creating duplicate canonicals.
- **Non-localized routes** - `/api/*`, `/sitemap.xml`, `/robots.txt` are excluded from locale
  rewriting in `project.inlang/paraglide.config.js`.

## Page-level metadata

`src/lib/components/SeoHead.svelte` renders everything from the `Seo` object a `+page.server.ts`
load returns:

| Tag                             | Source                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `<title>`, `meta description`   | localized message keys (`metaHomeTitle`, `metaResortTitle`…)                                                                     |
| `link rel="canonical"`          | `buildSeo()` - locale-prefixed absolute URL                                                                                      |
| `link rel="alternate" hreflang` | all four locales + `x-default`                                                                                                   |
| `meta robots`                   | `index,follow` default; `noindex,follow` when the data source is unavailable                                                     |
| Open Graph                      | `og:type`, `og:title`, `og:description`, `og:url`, `og:locale` (per-locale mapping in `OG_LOCALES`), `og:site_name`, `og:image*` |
| Twitter                         | `twitter:card=summary_large_image`, title, description, image                                                                    |

- **og:image** - the static `src/lib/assets/og-image.png` (1200×630, ~26 kB, language-neutral by
  design: the picture carries no text, the per-page `og:title` does). Generated from
  `src/lib/assets/og-image.svg` with the same design tokens as the UI; regenerate after a token
  change with `rsvg-convert -w 1200 -h 630 src/lib/assets/og-image.svg -o src/lib/assets/og-image.png`.
  The alt text is localized (`ogImageAlt` in `messages/<locale>.json`).
- **Localized titles** - resort pages interpolate the localized resort/region names
  (`m.metaResortTitle({ resort, region })`), so the same page has four distinct, language-native
  titles/descriptions.
- **Unavailable pages are `noindex,follow`** - a 503 data-source state must not compete with the
  healthy page in the index.

## Structured data (JSON-LD)

Injected through `SeoHead` as a `<script type="application/ld+json">` element; `buildSeo()` serialises
it with every `<` escaped to `\u003c`, so database-sourced names can never close the tag.

- **Home** - schema.org `ItemList` of the catalogue (one item per resort).
- **Resort page** - `TouristAttraction` (name, region/country, GeoCoordinates, `sameAs` to the
  resort's attributed sources) plus a `Dataset` node describing the published data product
  (creator, `temporalCoverage`, `isAccessibleForFree`, license attribution).

## Sitemap and robots

- **`/sitemap.xml`** (`src/routes/sitemap.xml/+server.ts`) is generated live from the same Supabase
  product read the pages use, so a new pilot resort appears in it - in all four languages - without
  touching a static file. Each `<url>` carries `<loc>` (English path), `xhtml:link rel="alternate"`
  hreflang entries for all locales **and `x-default`**, and `<lastmod>` from the newest snapshot
  timestamp (W3C datetime). Cache-control `public, max-age=600`.
- **`/robots.txt`** (`src/routes/robots.txt/+server.ts`) allows everything except `/api/` and points
  at `/sitemap.xml` on the answering origin, so preview deployments advertise their own sitemap
  instead of production's. Cache-control `public, max-age=3600`.

## Semantic HTML

- One `<h1>` per page (home: map headline; resort: resort name; lists: catalogue heading), `<h2>`
  per card/section, real `<section>`/`<article>` landmarks and `<table>` for tabular score/forecast
  data.
- Landmarks: `<header>`, `<nav>`, `<main id="main">`, `<footer>` with a skip link before the shell.
- The map canvas has `role="application"` + an accessible localized name; every Leaflet marker and
  the zoom control carry localized `aria-label`s, and the result list is the keyboard-accessible
  equivalent of the map.
- Images on the product pages are real `<img>` with intrinsic dimension attributes; SVG artwork
  ships as optimised assets fetched with `?url` where only the URL is needed.

## What is intentionally not indexed

`/api/*` (disallowed in robots.txt) and any `noindex` degraded state share the same rule: machines
consume the **localized JSON product view** at `/api/v1/resorts`; HTML pages are for people and
crawlers, the API is for programs.
