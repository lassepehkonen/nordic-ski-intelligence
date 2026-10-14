# Nordic Ski Intelligent

Nordic Ski Intelligent is a Nordic ski-resort information product. The repository contains the Phase 2 domain/database foundation and, since Phase 7, the multilingual product user interface: a map-first homepage, resort pages and a resort comparison, fully usable in Finnish, English, Swedish and Norwegian.

**What is not in place yet:** live resort or weather feeds, collectors, a production Supabase project and approved source rights. All snow, weather and forecast values shown by the UI are clearly labelled illustrative sample data, and resort facts are curated from the reference sources listed on each resort page. Do not use the preview for safety decisions.

## Development

Use Node.js `24.21.0` as pinned by `.nvmrc`, `.mise.toml` and Netlify. With mise:

```sh
mise exec -- npm ci
mise exec -- npm run dev
```

Every public page is locale-prefixed: `/fi`, `/en`, `/sv`, `/no` (the unprefixed root redirects to the resolved language). Resort pages live at `/{locale}/resort/{slug}`, the comparison at `/{locale}/compare?resorts=levi,trysil,hemsedal`.

Run the local checks with:

```sh
mise exec -- npm run format:check
mise exec -- npm run lint
mise exec -- npm run check
mise exec -- npm test
mise exec -- npm run build
mise exec -- npm run audit
```

UI strings live in `messages/{fi,en,sv,no}.json`; locale routing, hreflang, canonical URLs and the sitemap follow [ADR-0007](docs/architecture/decisions/0007-i18n-routing.md), and the Phase 7 record is in [docs/product/phase-7-multilingual-product-ui.md](docs/product/phase-7-multilingual-product-ui.md).

The database suite uses a local Supabase stack only. See [database setup and testing](docs/architecture/testing.md) before running it; never reset or directly modify a remote database.

## Git and deployment

Use short-lived `feat/*`, `fix/*`, `docs/*` or `ci/*` branches, then open a PR to `main`. GitHub requires PRs plus `quality`, `database`, `dependency-review` and `netlify/nordic-ski-intelligence/deploy-preview`; `main` blocks direct/force pushes. Production and PR #5 Deploy Preview both passed `/api/health` smoke tests. Netlify production deploys are restricted to the `main` Git branch; CLI/MCP/API cannot deploy to production. See:

- [CI/CD and branch workflow](docs/architecture/cicd.md)
- [Environments and secrets](docs/architecture/environments.md)
- [Deployment, smoke tests and rollback](docs/architecture/deployment.md)
- [Testing strategy](docs/architecture/testing.md)

## Product and data safeguards

Official resort websites are the preferred primary sources only where legally and technically permissible. Respect terms, robots directives and technical restrictions; collect only necessary facts; identify sources and verification dates; do not copy protected editorial content, images, maps or large source-database portions without permission. The source-rights policy is in [docs/official-resort-source-policy.md](docs/official-resort-source-policy.md).

The `app` database schema is private to the server-side boundary and is not exposed through Supabase's public Data API. Schema changes belong in reviewed migrations; local resets must specify `--local`.

## Architecture

- [Architecture overview](docs/architecture/overview.md)
- [Domain model](docs/architecture/domain-model.md)
- [Database](docs/architecture/database.md)
- [Product API boundary](docs/architecture/api.md)
- [Architecture decisions](docs/architecture/decisions/README.md)
