# Kehitys, haaramalli ja CI/CD

**Tila:** Vaiheen 3 toteutus. Netlify- ja GitHub-etäasetusten tarkistus kirjataan erikseen; tuotannon Supabase-projektia ei ole luotu.

## Julkaisupolku

```text
feat/* / fix/* / docs/* / ci/*
        → pull request main-haaraan
        → GitHub Actions CI + Netlify Deploy Preview
        → ihmisen katselmointi ja esikatselun tarkistus
        → merge main-haaraan
        → Netlifyn tuotantodeploy
        → /api/health-smoke ja tuloksen raportointi
```

`main` on ainoa pitkäikäinen haara. Staging-haaraa ei ylläpidetä; vaiheistus tehdään PR-esikatseluilla ja erillisellä ei-tuotannon tietokannalla. Netlify voi muodostaa PR:stä Deploy Previewn ja julkaista tuotantoon valitun Git-haaran perusteella.[66][79]

Nykyinen SvelteKit-skeleton on generoitu kevyestä TypeScript-pohjasta Netlify-adapterilla; se on build-/health-check-fixture, ei tuotteen käyttöliittymä.[74]

## Haarat ja PR:t

- Käytä lyhyitä `feat/<asia>`, `fix/<asia>`, `docs/<asia>` tai `ci/<asia>` -haaroja.
- Kaikki muutokset, myös agenttien tekemät, toimitetaan PR:nä `main`-haaraan. Suorat pushit ja force-pushit `main`-haaraan estetään repoasetuksilla.
- PR:n pitää odottaa näitä CI-tarkistuksia: `quality`, `database` ja `dependency-review`. Netlify Preview tarkistetaan erikseen ennen mergeä.
- Solo-ylläpitäjän MVP:ssä vaaditaan PR ja vihreät tarkistukset; toista hyväksyjää ei aseteta pakolliseksi ennen kuin toinen katselmoija on nimetty. PR:n tekijä tai ylläpitäjä tarkistaa diffi- ja preview-sisällön ennen mergeä.
- Ota GitHubin sääntöjen mukaan käyttöön lineaarinen historia, keskustelujen ratkaisu sekä ylläpitäjien suojaus. Yksityisten repositorien suojausominaisuuksien saatavuus riippuu GitHub-tilin suunnitelmasta; varmista asetukset API:sta ennen kuin kytket automaattisen tuotantojulkaisun päälle.[76][77][78]

## CI-tarkistukset

Workflow on [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). PR:t ja `main`-pushit suorittavat:

1. lukitun `npm ci` -asennuksen, Prettier-muotoilun tarkistuksen, ESLintin ja Svelte/TypeScript-tarkistuksen;
2. yksikkö-, domain-, scoring-, adapteri-, API-sopimus- ja tietoturvatestit;
3. Supabase CLI:llä paikallisen tietokannan tuoreen resetin, pgTAP-testit ja `app`-skeeman varoitukset pysäyttävän lintin;
4. Netlify-adapterin tuotantobuildin ja korkean tason riippuvuusauditoinnin;
5. PR:ssä muuttuneiden riippuvuuksien erillisen Dependency Review -tarkistuksen. GitHub Actionsin build/test-työnkulku on määritelty niin, että PR- ja `main`-muutokset saavat saman CI-portin.[65]

Supabasen reset-komento on aina `--local`; workflow ei saa tuotantotunnuksia eikä tee etätietokantaan komentoja. Paikallisen Supabase-CLI:n migraatio- ja testikäyttö vastaa Supabasen dokumentoitua paikalliskehityksen työnkulkua.[59][70]

Kolmannen osapuolen GitHub Actions -toiminnot on kiinnitetty täyteen commit-SHA:han, `GITHUB_TOKEN` on vain luku -tilassa ja checkout ei säilytä tunnistetietoja. Workflow ei käytä `pull_request_target`-tapahtumaa eikä sijoita PR:n hallitsemaa tekstiä shell-komentoihin. GitHub suosittelee actionien SHA-kiinnitystä, oikeuksien rajaamista ja epäluotettavan PR-sisällön eristämistä.[62][63]

## Riippuvuus- ja tietoturvapäivitykset

Dependabot tarkistaa viikoittain npm-riippuvuudet ja GitHub Actions -versiot. CI ajaa `npm audit --audit-level=high`; PR:lle suoritetaan lisäksi Dependency Review. Action-SHA:t päivitetään PR:n kautta, ei muuttuvilla tageilla.

Tuotantosalaisuuksia ei anneta PR:lle, preview-buildille, GitHub Actionsille tai selainbundleen. Kun palvelinpuolen integraatio lisätään, salaisuus asetetaan erikseen Netlifyn palvelin-/funktiokäyttöön eikä `PUBLIC_*`/`VITE_*`-muuttujaksi.[62][84]

## Mitä ei ole vielä tuotantokäytössä

- Tuotannon/stagingin Supabase-projekteja tai niiden tunnuksia ei ole luotu. Tuotannon migraatioiden etäjulkaisu pysyy suljettuna, kunnes projektien kustannukset on hyväksytty ja ympäristöt on konfiguroitu.
- Scoring-moottorin, lähdeadapterien ja varsinaisen tuotteen API:n TypeScript-testit lisätään niiden toteutuksen yhteydessä. Nykyiset tyhjät testiluokat ohitetaan näkyvästi `--passWithNoTests`-valitsimella; ne eivät väitä testikattavuutta. Domain-skeeman nykyiset 72 pgTAP-väitettä ajetaan oikeasti.
- Yksityisen GitHub-repon branch protection ja Netlify-Git-kytkentä ovat ulkoisia repo-/sivustoasetuksia: niitä ei saa pitää valmiina ennen kuin ne luetaan takaisin palvelusta.

## Sources

[59] https://supabase.com/docs/guides/local-development/cli-workflows — Local development workflow | Supabase Docs
[62] https://docs.github.com/en/actions/reference/security/secure-use — GitHub Actions secure use reference
[63] https://docs.github.com/en/actions/reference/security — GitHub Actions security reference
[65] https://docs.github.com/en/actions/tutorials/build-and-test-code — GitHub Actions build and test code
[66] https://docs.netlify.com/deploy/deploy-types/deploy-previews — Netlify Deploy Previews
[70] https://supabase.com/docs/guides/local-development/cli/testing-and-linting — Supabase testing and linting
[74] https://svelte.dev/docs/kit/creating-a-project — SvelteKit create project
[76] https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule — GitHub branch protection rules
[77] https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets — GitHub rulesets
[78] https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository — Create GitHub rulesets
[79] https://docs.netlify.com/build/git-workflows/overview — Netlify Git workflows and production protection
[84] https://docs.netlify.com/build/configure-builds/environment-variables — Netlify build environment variables
