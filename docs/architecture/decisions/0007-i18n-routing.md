# ADR-0007: Use Paraglide JS with localized SvelteKit routes

- **Status:** Accepted; URL strategy and metadata implemented in Phase 7
- **Date:** 2026-10-05

## Context

Finnish (`fi`), English (`en`), Swedish (`sv`) and Norwegian (`no`) are required at launch. Localization includes routes, navigation, filters, resort/editorial content, SEO metadata, dates, numbers, units and weather language. A fifth language should not require rewriting page components. Incomplete translation must not be presented as a complete localized SEO page.

## Decision

Use **Paraglide JS with SvelteKit** for typed UI messages and an explicit locale registry. Localized public routes use `/fi/`, `/en/`, `/sv/`, `/no/`; resort slugs and translation records map to the same stable resort identity. Paraglide's SvelteKit integration documents typed messages and URL strategies, and supports SSR/SSG as well as client rendering.[8]

Default/fallback UI language is English when a message is missing during development. This is not a content-completeness exemption: block publication/indexing of a locale page until its required copy and SEO fields pass the translation-completeness check.

For each indexed translation, emit the correct canonical URL and reciprocal `hreflang` alternates; sitemap generation includes only published, complete localized routes. Google documents the need to connect localized versions and handle canonical URLs for language variants.[35]

## Alternatives considered

- **Astro built-in i18n routing:** strong built-in prefix/fallback routing and browser language helpers, but translation catalogs and typed message workflow remain a separate choice.[3]
- **Next.js plus next-intl or another integration:** a viable App Router approach; Next.js lists these integrations, but no current product requirement favors it over Paraglide/SvelteKit.[6]
- **Hand-written dictionary helpers:** possible for four languages, but more likely to miss interpolation typing, locale formatting and completeness checks as the catalog grows.

## Consequences

- All user-facing strings must go through the message/catalog layer; components do not hardcode UI prose.
- Locale-aware formatting uses `Intl` with the active locale and explicit product unit preferences.
- Resort editorial translations remain distinct records from UI messages and may be incomplete independently per resort/locale.
- CI checks message keys and required content fields; the acceptable translation-completeness threshold is established before the first public release.

## Implementation notes (Phase 7)

- Locale prefixes are declared once in `project.inlang/paraglide.config.js` (`urlPatterns`): every
  locale is prefixed and the unprefixed root is a locale-detection entry point that 308-redirects
  to the resolved locale. `routeStrategies` excludes `/api/*`, `/robots.txt` and `/sitemap.xml`
  from the locale middleware so machine endpoints never receive a locale redirect.
- `src/hooks.ts` (`reroute`) strips the prefix before route matching, so page components and their
  load functions only ever see canonical paths; links are built through `#lib/i18n/ui`, which
  localizes and de-localizes hrefs.
- `src/hooks.server.ts` runs the Paraglide middleware, resolves the locale (URL prefix →
  `Accept-Language` → base locale) and substitutes `%lang%`/`%dir%` in `src/app.html`.
- Each page's load function returns metadata built by `src/lib/seo/meta.ts`: a self-referencing
  canonical URL, reciprocal `hreflang` alternates for all four locales plus `x-default` (English),
  `og:locale`/`og:locale:alternate`, and schema.org `SkiResort` on resort pages. `sitemap.xml`
  lists every localized page with its alternates; the dynamic `robots.txt` points at it.
- Canonical and alternate URLs use the serving origin, so a preview deploy self-references the host
  it is served from; a custom domain then needs no rebuild-time configuration.
- The completeness gate referenced above is implemented as `tests/domain/i18n-catalog.spec.ts`:
  identical key sets across locales, no empty values, and identical placeholder sets per key (so
  no interpolation can silently vanish in one language).

## Revisit when

Reassess the library if it stops supporting the required SvelteKit routing/build model, translation authoring needs a managed CMS, or content volume requires a dedicated localization workflow. Keep URL, locale and translation data independent enough to migrate libraries without changing resort identities.

## Sources

[3] https://docs.astro.build/en/guides/server-side-rendering — On-demand rendering | Docs
[6] https://nextjs.org/docs/app/guides/internationalization — Guides: Internationalization | Next.js
[8] https://supabase.com/docs/guides/cron — Cron | Supabase Docs
[35] https://inlang.com/m/gerre34r/library-inlang-paraglideJs/i18n-routing — i18n Routing - Paraglide JS
