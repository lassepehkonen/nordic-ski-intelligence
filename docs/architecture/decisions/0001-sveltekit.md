# ADR-0001: Use SvelteKit as the product web framework

- **Status:** Accepted for the Phase 0 recommendation; implementation gated on Phase 1 feasibility
- **Date:** 2026-10-05

## Context

The first product is a map-first application with public resort/country/region pages that need SEO, plus a coordinated interactive map, filters, condition cards and comparisons. It must support future logged-in features and a PWA without shipping an entirely client-rendered site. TypeScript is the project language.

## Decision

Use **SvelteKit + TypeScript** as one application framework. Use server-side rendering for live public condition summaries and API routes, prerender stable content where suitable, and initialize MapLibre only in the browser. Use `adapter-netlify` for the initial deployment target.

SvelteKit provides SSR, client rendering and prerendering as framework-level modes; Netlify documents mixed rendering modes and API endpoints in its SvelteKit integration.[1][31]

## Alternatives considered

- **Astro + Svelte islands:** strongest when mostly-static editorial content contains a few isolated widgets. Astro provides localized routing and partial hydration, but a map-first application would likely place the map, filters, result list and comparison state inside one large Svelte island or require cross-island state coordination.[3][4]
- **Next.js:** strong React ecosystem and agent familiarity, with localized routing assembled through an i18n library; Netlify currently documents an OpenNext adapter for major Next features.[6][7] The app does not need a separate React framework to get SSR or SEO.
- **Other frameworks:** no evaluated alternative has a material advantage over the requested choices for this initial product slice.

## Consequences

- Public pages and map interactions use one route/data-loading model; no Astro/Svelte runtime boundary.
- SvelteKit is less ubiquitous in AI-generated examples than Next.js, so repository conventions, ADRs, typed interfaces and CI tests must be explicit.
- The framework does not decide the database, tile source or collector runtime; those remain provider-neutral boundaries.
- Future native mobile clients consume a stable API rather than reusing Svelte components.

## Revisit when

Reassess if the product becomes predominantly editorial/publishing (Astro may then be simpler), the team standardizes on React/Next, or a future product need requires a host/runtime unsupported by the SvelteKit adapter model.

## Sources

[1] https://docs.astro.build/en/guides/internationalization — Internationalization (i18n) Routing | Docs
[3] https://docs.astro.build/en/guides/server-side-rendering — On-demand rendering | Docs
[4] https://svelte.dev/docs/kit/introduction — Introduction • SvelteKit Docs
[6] https://nextjs.org/docs/app/guides/internationalization — Guides: Internationalization | Next.js
[7] https://docs.netlify.com/frameworks/sveltekit/overview — 404 | Netlify Docs
[31] https://operations.osmfoundation.org/policies/tiles — Tile Usage Policy
