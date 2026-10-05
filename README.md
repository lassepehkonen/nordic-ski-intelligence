# Nordic Ski Intelligent

Nordic Ski Intelligent is a Nordic ski-resort information product. The repository contains the Phase 2 domain/database foundation and a small Phase 3 SvelteKit shell for CI and deployment verification. **It does not yet contain product UI, live resort data, collectors, a scoring engine or a production Supabase project.**

## Development

Use Node.js `24.21.0` as pinned by `.nvmrc`, `.mise.toml` and Netlify. With mise:

```sh
mise exec -- npm ci
mise exec -- npm run dev
```

The starter route is intentionally limited to a status page and `GET /api/health`; it is not product functionality. Run the local checks with:

```sh
mise exec -- npm run format:check
mise exec -- npm run lint
mise exec -- npm run check
mise exec -- npm test
mise exec -- npm run build
mise exec -- npm run audit
```

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
