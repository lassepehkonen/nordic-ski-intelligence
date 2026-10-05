# Testausstrategia

## CI:n tarkistukset

| Tarkistus                         | Komento / toteutus                                                                                                 | Nykyinen kattavuus                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Muotoilu                          | `npm run format:check` (Prettier)                                                                                  | Koko repo, lukitus-/build-tiedostot ohitettu                                                                                                           |
| Lint                              | `npm run lint` (ESLint)                                                                                            | Svelte/TypeScript/JavaScript                                                                                                                           |
| TypeScript/Svelte                 | `npm run check`                                                                                                    | `svelte-check`; virhe 0 on julkaisuehto                                                                                                                |
| Yksikkötestit                     | `npm run test:unit`                                                                                                | Health-vastauksen ei-salainen sisältö                                                                                                                  |
| Domain-testit                     | `npm run test:domain` + tietokanta-jobi                                                                            | TS-domainin testikansio on vielä tyhjä; todelliset domain-rajoitteet testataan pgTAP:lla                                                               |
| Scoring-testit                    | `npm run test:scoring` + tietokanta-jobi                                                                           | Sovelluksen scoring-moottoria ei ole toteutettu; pgTAP tarkistaa rating-version tietomallin                                                            |
| Adapteri-/fixture-testit          | `npm run test:adapters`                                                                                            | Deploy-smoke-pluginin 3 yksikkötestiä; resort-/weather-lähdeadaptereita ja niiden fixturejä ei vielä ole                                               |
| API-sopimukset                    | `npm run test:api`                                                                                                 | `GET /api/health` vastaa HTTP 200 + JSON `{status: "ok"}` SvelteKitin server-route-konventiolla; tuotteen varsinainen API ei ole vielä toteutettu.[75] |
| Migraatiot ja domain-invarianssit | `supabase db reset --local`, `supabase test db --local`, `supabase db lint --local --schema app --fail-on warning` | 3 pgTAP-tiedostoa, 72 väitettä; skeeman lint puhdas                                                                                                    |
| Tietokantaturvallisuus            | `npm run test:security`                                                                                            | Estää etäresetit/-pushit workflowissa sekä hyväksymättömän tuhoavan DDL:n migraatioissa                                                                |
| Build                             | `npm run build`                                                                                                    | SvelteKit + Netlify-adapter                                                                                                                            |
| Riippuvuusturva                   | `npm run audit` + PR:n Dependency Review + Dependabot                                                              | npm-haavoittuvuudet ja PR:n riippuvuusmuutokset                                                                                                        |

Tyhjät domain/scoring/lähdeadapteri-testikansiot ohitetaan `--passWithNoTests`-valitsimella, jotta infrastruktuurin PR ei väitä olematonta tuotetestausta. Kun kyseinen domain, pisteytys tai lähdeadapteri toteutetaan, ensimmäinen PR lisää sen todelliset testit ja fixturet samaan ryhmään.

## Ajaminen paikallisesti

Projektin runtime on Node `24.21.0` (`.nvmrc`, `.mise.toml`, Netlify).[71] Käytä projektin versionhallintaa:

```sh
mise exec -- npm ci
mise exec -- npm run format:check
mise exec -- npm run lint
mise exec -- npm run check
mise exec -- npm test
mise exec -- npm run build
mise exec -- npm run audit
```

Tietokantatestit tarvitsevat Docker-yhteensopivan paikallisen runtime-palvelun:

```sh
mise exec -- npx --yes supabase@2.119.0 start
mise exec -- npx --yes supabase@2.119.0 db reset --local
mise exec -- npx --yes supabase@2.119.0 test db --local
mise exec -- npx --yes supabase@2.119.0 db lint --local --schema app --fail-on warning
mise exec -- npx --yes supabase@2.119.0 stop --no-backup
```

Supabasen CLI erottaa paikallisen migraatio-/testikäytön etäympäristöstä; `--local` annetaan aina eksplisiittisesti.[59][70]

## Luotettavuusrajat

- GitHub Actions käyttää vain lukittua `package-lock.json`-tiedostoa. Riippuvuudet tarkastetaan myös npm auditilla ja PR:n Dependency Reviewllä.
- `database`-jobi nollaa vain CI-jobin paikallisen tietokannan, ajaa migraatiot puhtaaseen kantaan ja suorittaa pgTAP-testit; production secretsejä ei anneta jobille.
- `check-database-safety.js` hylkää tuotantoon soveltuvat `supabase db reset` -komennot, etä-`db push` -komennot sekä `DROP`/`TRUNCATE`/`DELETE FROM` -migraatiot ilman eksplisiittistä ADR-merkintää. Merkintä ei korvaa ihmisen katselmointia.
- Supabase-taulujen pgTAP-domain-testit eivät vielä ole TypeScript-pisteytys-, lähdeadapteri- tai varsinaisen API:n integraatiotestejä. Nämä lisätään vasta palvelukoodin valmistuessa.

GitHub suosittelee vähäisiä workflow-oikeuksia ja täyteen SHA:han kiinnitettyjä actioneita; Netlifyn Deploy Previewt antavat PR-kohtaisen tarkistus-URL:n.[62][66]

## Sources

[59] https://supabase.com/docs/guides/local-development/cli-workflows — Local development workflow | Supabase Docs
[62] https://docs.github.com/en/actions/reference/security/secure-use — GitHub Actions secure use reference
[66] https://docs.netlify.com/deploy/deploy-types/deploy-previews — Netlify Deploy Previews
[70] https://supabase.com/docs/guides/local-development/cli/testing-and-linting — Supabase testing and linting
[71] https://nodejs.org/en/about/previous-releases — Node.js previous releases
[75] https://svelte.dev/docs/kit/project-structure — SvelteKit project structure
