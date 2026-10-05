# ADR-0006: Netlify-hosting ja GitHub Actions CI

- **Tila:** Hyväksytty. GitHubin `main`-suojaus, riippuvuusgraafi ja haavoittuvuusilmoitukset ovat aktiivisia. Netlify on yhdistetty repoihin; ensimmäinen `main`-tuotantodeploy ja smoke-tarkistus onnistuivat. PR Previewn erillinen testi on kesken; Supabasen staging- ja tuotantoprojekteja ei ole luotu.
- **Päivä:** 2026-10-05

## Konteksti

Tuote tarvitsee SvelteKit SSR:n, PR-kohtaiset esikatselut, erilliset staging- ja tuotantotietokannat sekä agenttimuutoksille turvallisen julkaisupolun. Käytössä on julkinen GitHub-repo `lassepehkonen/nordic-ski-intelligence`, joka on yhdistetty Netlify-projektiin. Tuotantohaara on `main`; Deploy Previewt on asetettu PR:ille ja Netlify-projektin ensimmäinen deploy on valmis.

## Päätös

Web-sovellus julkaistaan Netlifyyn SvelteKit-adapterilla; Netlifyn virallinen ohje kattaa SvelteKit-asennuksen.[37] PR-kohtaisia Deploy Preview -julkaisuja käytetään UI:n katselmointiin, ja tuotantohaara on `main`.[66][79]

GitHubin `main`-haara vaatii PR:n ja seuraavat tarkistukset: `quality`, `database` ja `dependency-review`. Suorat pushit, force-pushit ja ylläpitäjien poikkeukset on estetty; lineaarinen historia ja keskustelujen ratkaisu vaaditaan. Nämä asetukset on luettu takaisin GitHubin branch protection -rajapinnasta.[76]

Repositoriossa on yksi yhteistyökumppani, joten vaadittujen hyväksyntöjen määrä on nolla. Ihminen tarkistaa silti diffi- ja Preview-sisällön ennen mergeä; agentti ei mergeä ilman käyttäjän nimenomaista pyyntöä.

PR-esikatselu korvaa erillisen staging-verkkosivun MVP:ssä. Staging-tietokanta on edelleen perusteltu ennen tuotantointegraatioita, mutta se luodaan vasta erillisen kustannushyväksynnän jälkeen. CI:n tietokantatestit käyttävät paikallista Supabase-stackia ja vain migraatioita.[59][70]

Netlify-Git-yhteys käynnistää tuotantobuildin `main`-haarasta; `onSuccess`-pluginin `/api/health`-smoke onnistui ensimmäisessä deployssa. PR Preview on asetettu kaikille PR:ille, ja sen toiminta varmennetaan erillisellä testimuutoksella. Rollback tehdään palauttamalla viimeinen toimiva deploy tai revert-PR:llä.[72][83]

## Vaihtoehdot

- Jatkuvaa staging-verkkosivua ei ylläpidetä: PR Deploy Previewt tarjoavat muutoksen erillisen tarkistusosoitteen.[66]
- Tuotantopolku on käytännössä GitHub PR → suojattu `main` → Netlify Git deploy. Netlify-asetus sallii kuitenkin tällä hetkellä myös CLI-, MCP- ja API-julkaisut; rajaa ne pois ennen agenttien tuotantojulkaisuoikeutta. Build-hookeja ei ole lisätty.[79][85]
- Tuotantosalaisuuksia ei anneta PR-buildille, GitHub Actionsille tai frontend-bundleen. Netlify-muuttujat lisätään tarvittaessa vain oikeisiin server/runtime-scopeihin.[64][84]

## Seuraukset ja avoimet asiat

- CI ajaa formatoinnin, lintin, TypeScript/Svelte-tarkistukset, testiryhmät, paikallisen Supabase-migraatiovalidoinnin, skeemalintin, buildin ja riippuvuustarkistukset.
- Netlify-Git-yhteys ja `main`-tuotantodeploy `6ac3e90949031a6686fe840d` on todennettu; deploy viittaa `main`-commitin `e824f34afe37daa8a2cd3e33e0b73c693f19673a` ja smoke-plugin onnistui. PR Preview testataan erillisessä PR:ssä.
- Supabasen etäprojekteja, tuotantotunnuksia tai migraatioavaimia ei ole luotu. Tuotannon etämigraatiot eivät kuulu CI-jobiin.
- Kustannus, alue ja erillisten staging-/tuotantotietokantojen luonti vahvistetaan ennen niiden provisiointia.

## Uudelleenarvioi, kun

PR Deploy Preview on todennettu, Netlify-julkaisumenetelmät on rajattu Git-only-tilaan, Supabasen alue- ja kustannuspäätös on tehty tai hostingin kustannus, suorituskyky, käytettävyys tai tietojen sijaintivaatimukset muuttuvat.

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
