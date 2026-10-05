# ADR-0006: Netlify-hosting ja GitHub Actions CI

- **Tila:** Hyväksytty. GitHubin `main`-suojaus on aktiivinen; Netlify-projekti on luotu mutta GitHub-yhdistäminen ja ensimmäinen deploy odottavat passkey-vahvistusta. Supabasen staging- ja tuotantoprojekteja ei ole luotu.
- **Päivä:** 2026-10-05

## Konteksti

Tuote tarvitsee SvelteKit SSR:n, PR-kohtaiset esikatselut, erilliset staging- ja tuotantotietokannat sekä agenttimuutoksille turvallisen julkaisupolun. Käytössä on julkinen GitHub-repo `lassepehkonen/nordic-ski-intelligence`; Netlify-projekti on olemassa, mutta sitä ei ole vielä yhdistetty repoihin.

## Päätös

Web-sovellus julkaistaan Netlifyyn SvelteKit-adapterilla; Netlifyn virallinen ohje kattaa SvelteKit-asennuksen.[37] PR-kohtaisia Deploy Preview -julkaisuja käytetään UI:n katselmointiin, ja tuotantohaara on `main`.[66][79]

GitHubin `main`-haara vaatii PR:n ja seuraavat tarkistukset: `quality`, `database` ja `dependency-review`. Suorat pushit, force-pushit ja ylläpitäjien poikkeukset on estetty; lineaarinen historia ja keskustelujen ratkaisu vaaditaan. Nämä asetukset on luettu takaisin GitHubin branch protection -rajapinnasta.[76]

Repositoriossa on yksi yhteistyökumppani, joten vaadittujen hyväksyntöjen määrä on nolla. Ihminen tarkistaa silti diffi- ja Preview-sisällön ennen mergeä; agentti ei mergeä ilman käyttäjän nimenomaista pyyntöä.

PR-esikatselu korvaa erillisen staging-verkkosivun MVP:ssä. Staging-tietokanta on edelleen perusteltu ennen tuotantointegraatioita, mutta se luodaan vasta erillisen kustannushyväksynnän jälkeen. CI:n tietokantatestit käyttävät paikallista Supabase-stackia ja vain migraatioita.[59][70]

Kun Netlify-Git-yhteys on valmis, PR:t tuottavat Deploy Previewn ja `main`-haaran merge käynnistää tuotantobuildin. `onSuccess`-plugin tekee deployn jälkeisen `/api/health`-smoken; rollback tehdään palauttamalla viimeinen toimiva deploy tai revert-PR:llä.[72][83]

## Vaihtoehdot

- Jatkuvaa staging-verkkosivua ei ylläpidetä: PR Deploy Previewt tarjoavat muutoksen erillisen tarkistusosoitteen.[66]
- Tuotantojulkaisuja ei käynnistetä suoraan CLI:llä, API:lla tai build hookilla; GitHubin PR- ja branch-protection-polku pysyy julkaisun porttina.[79][85]
- Tuotantosalaisuuksia ei anneta PR-buildille, GitHub Actionsille tai frontend-bundleen. Netlify-muuttujat lisätään tarvittaessa vain oikeisiin server/runtime-scopeihin.[64][84]

## Seuraukset ja avoimet asiat

- CI ajaa formatoinnin, lintin, TypeScript/Svelte-tarkistukset, testiryhmät, paikallisen Supabase-migraatiovalidoinnin, skeemalintin, buildin ja riippuvuustarkistukset.
- Nykyinen Netlify-projekti on vielä ilman GitHub-yhteyttä ja deployta. OAuth kirjautuminen vaatii käyttäjän passkey-vahvistuksen; live Preview- tai tuotantojulkaisua ei vielä väitetä toimivaksi.
- Supabasen etäprojekteja, tuotantotunnuksia tai migraatioavaimia ei ole luotu. Tuotannon etämigraatiot eivät kuulu CI-jobiin.
- Kustannus, alue ja erillisten staging-/tuotantotietokantojen luonti vahvistetaan ennen niiden provisiointia.

## Uudelleenarvioi, kun

Netlify-Git-yhteys ja ensimmäinen Preview/tuotantodeploy on todennettu, Supabasen alue- ja kustannuspäätös on tehty tai hostingin kustannus, suorituskyky, käytettävyys tai tietojen sijaintivaatimukset muuttuvat.

## Sources

[37] https://docs.netlify.com/build/frameworks/framework-setup-guides/sveltekit — SvelteKit on Netlify
[59] https://supabase.com/docs/guides/local-development/cli-workflows — Local development workflow | Supabase Docs
[64] https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments — GitHub Actions deployments and environments
[66] https://docs.netlify.com/deploy/deploy-types/deploy-previews — Netlify Deploy Previews
[70] https://supabase.com/docs/guides/local-development/cli/testing-and-linting — Supabase testing and linting
[72] https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview — Netlify manage deploys and rollbacks
[76] https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule — GitHub branch protection rules
[79] https://docs.netlify.com/build/git-workflows/overview — Netlify Git workflows and production protection
[83] https://docs.netlify.com/extend/develop-and-share/develop-build-plugins — Develop Netlify Build Plugins
[84] https://docs.netlify.com/build/configure-builds/environment-variables — Netlify build environment variables
[85] https://docs.netlify.com/build/configure-builds/build-hooks — Netlify Build hooks
