# ADR-0006: Host the web app on Netlify; use GitHub Actions for CI

- **Status:** Accepted for the Phase 0 recommendation; account/billing ownership remains unverified
- **Date:** 2026-10-05

## Context

The product requires SSR, per-PR previews, separate staging/production data environments, safe AI-agent contributions and a controlled production path. The user already operates a Netlify-based project, but no Nordic Ski Intelligence Netlify site or cloud resource has been created.

## Decision

Deploy the SvelteKit web application to **Netlify** using the SvelteKit adapter. Use Netlify Deploy Previews for PR review and GitHub Actions as the required quality gate. Netlify documents support for SvelteKit rendering modes/API endpoints and previews from pull/merge requests.[31][32]

Use `main` for production, require CI and human review, and keep staging in a separate Supabase project. Production secrets are scoped to production and are not provided to AI coding agents or preview builds. Production database changes are versioned migrations with an explicit release gate.

GitHub Actions handles typecheck, lint, tests, translation completeness, migration checks and build. It is **not** the live conditions scheduler; schedule events can be delayed during high load.[24]

## Alternatives considered

- **Cloudflare Pages/Workers:** a viable SvelteKit adapter target with efficient edge delivery; choose instead if the organization deliberately consolidates web and collector operations on Cloudflare.[36]
- **Vercel:** viable through the official SvelteKit adapter, but the published Pro starting plan is currently $20/month plus usage; no advantage over the existing Netlify workflow has been established.[37][23]
- **Netlify-only CI and scheduled ingestion:** host builds are useful, but scheduled functions have limits and tie ingestion deployment to web publication; the selected collector architecture uses Supabase Cron instead.[15][16]

## Cost and consequences

Netlify currently lists Free and Personal ($9/month) plans, credit-based usage and a CDN; recheck usage credit consumption and plan terms before selecting the production tier.[33] Personal is included in the initial planning baseline, not a claim that it is mandatory for every deployment.

This choice minimizes change to the user's existing Netlify workflow while keeping database and collector services separately deployable. It creates a multi-vendor stack (Netlify + Supabase + map provider), so keep the application portable and avoid host-specific services in domain code.

## Revisit when

Reconsider Cloudflare or another host if Netlify runtime region, cost/credit use, SSR performance, observability, support or residency becomes unsuitable. Do not switch simply to combine web and data jobs if that couples source freshness to website release cadence.

## Sources

[15] https://developers.cloudflare.com/workers/configuration/cron-triggers — Cron Triggers · Cloudflare Workers docs
[16] https://developers.cloudflare.com/workers/platform/limits — Limits · Cloudflare Workers docs
[23] https://railway.com/pricing — Pricing | Railway
[24] https://vercel.com/docs/cron-jobs — Cron Jobs
[31] https://operations.osmfoundation.org/policies/tiles — Tile Usage Policy
[32] https://inlang.com/m/dxnzrydw/paraglide-sveltekit-i18n — SvelteKit - Paraglide JS
[33] https://inlang.com/m/gerre34r/library-inlang-paraglideJs/changelog — inlang/paraglide-js
[36] https://inlang.com/m/gerre34r/library-inlang-paraglideJs/strategy — Strategy - Paraglide JS
[37] https://docs.netlify.com/build/frameworks/framework-setup-guides/sveltekit — SvelteKit on Netlify
