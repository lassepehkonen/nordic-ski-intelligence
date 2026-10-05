# ADR-0006: Netlify-hosting ja GitHub Actions CI

- **Tila:** Hyväksytty. Netlify-Git-yhteys, tuotantodeploy ja PR #5 Deploy Preview on todennettu; `main` vaatii CI:n lisäksi Preview-checkin. Tuotantojulkaisu on rajattu Netlifyn asetuksella `main`-haaran Git-workflow’hun; CLI/MCP/API eivät voi julkaista tuotantoon. Supabasen staging- ja tuotantoprojekteja ei ole luotu.
- **Päivä:** 2026-10-05

## Konteksti

Tuote tarvitsee SvelteKit SSR:n, PR-kohtaiset esikatselut, erilliset staging- ja tuotantotietokannat sekä agenttimuutoksille turvallisen julkaisupolun. Käytössä on julkinen GitHub-repo `lassepehkonen/nordic-ski-intelligence`, joka on yhdistetty Netlify-projektiin. Tuotantohaara on `main`; Deploy Previewt on asetettu PR:ille ja Netlify-projektin ensimmäinen deploy on valmis.

## Päätös

Web-sovellus julkaistaan Netlifyyn SvelteKit-adapterilla; Netlifyn virallinen ohje kattaa SvelteKit-asennuksen.[37] PR-kohtaisia Deploy Preview -julkaisuja käytetään UI:n katselmointiin, ja tuotantohaara on `main`.[66][79]

GitHubin `main`-haara vaatii PR:n ja tarkistukset `quality`, `database`, `dependency-review` sekä `netlify/nordic-ski-intelligence/deploy-preview`. Suorat pushit, force-pushit ja ylläpitäjien poikkeukset on estetty; lineaarinen historia ja keskustelujen ratkaisu vaaditaan. Nämä asetukset on luettu takaisin GitHubin branch protection -rajapinnasta.[76]

Repositoriossa on yksi yhteistyökumppani, joten vaadittujen hyväksyntöjen määrä on nolla. Ihminen tarkistaa silti diffi- ja Preview-sisällön ennen mergeä; agentti ei mergeä ilman käyttäjän nimenomaista pyyntöä.

PR-esikatselu korvaa erillisen staging-verkkosivun MVP:ssä. Staging-tietokanta on edelleen perusteltu ennen tuotantointegraatioita, mutta se luodaan vasta erillisen kustannushyväksynnän jälkeen. CI:n tietokantatestit käyttävät paikallista Supabase-stackia ja vain migraatioita.[59][70]

Netlify-Git-yhteys käynnistää tuotantobuildin `main`-haarasta; ensimmäisen tuotantodeployn smoke onnistui. PR #5 Deploy Previewn `/api/health`-smoke onnistui, ja `main` vaatii nyt Preview-checkin ennen mergeä. Rollback tehdään palauttamalla viimeinen toimiva deploy tai revert-PR:llä.[72][83]

## Vaihtoehdot

- Jatkuvaa staging-verkkosivua ei ylläpidetä: PR Deploy Previewt tarjoavat muutoksen erillisen tarkistusosoitteen.[66]
- Tuotantopolku on GitHub PR → vaaditut CI- ja Netlify Preview -checkit → suojattu `main` → Netlify Git deploy. Enforce deployment methods -asetus estää CLI-, MCP- ja API-julkaisut tuotantoon. Build-hookeja ei ole lisätty.[79][85]
- Tuotantosalaisuuksia ei anneta PR-buildille, GitHub Actionsille tai frontend-bundleen. Netlify-muuttujat lisätään tarvittaessa vain oikeisiin server/runtime-scopeihin.[64][84]

## Seuraukset ja avoimet asiat

- CI ajaa formatoinnin, lintin, TypeScript/Svelte-tarkistukset, testiryhmät, paikallisen Supabase-migraatiovalidoinnin, skeemalintin, buildin ja riippuvuustarkistukset.
- Netlify-Git-yhteys, ensimmäinen tuotantodeploy ja PR #5 Deploy Preview on todennettu; kummankin deployn smoke-plugin onnistui. `main` vaatii myös Netlify Preview -checkin.
- Supabasen etäprojekteja, tuotantotunnuksia tai migraatioavaimia ei ole luotu. Tuotannon etämigraatiot eivät kuulu CI-jobiin.
- Kustannus, alue ja erillisten staging-/tuotantotietokantojen luonti vahvistetaan ennen niiden provisiointia.

## Uudelleenarvioi, kun

Uudelleenarvioi, jos Netlify Git-only -rajaus muuttuu, Supabasen alue- ja kustannuspäätös tehdään tai hostingin kustannus, suorituskyky, käytettävyys tai tietojen sijaintivaatimukset muuttuvat.

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
