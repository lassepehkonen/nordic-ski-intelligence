# Ympäristöt

**Tila:** GitHub-repo on julkinen ja `main` suojattu. Netlify-projekti on luotu, mutta sitä ei ole vielä yhdistetty GitHubiin eikä se ole julkaissut deployta. Staging- ja tuotantotietokantoja ei ole luotu.

## Valinta

MVP:lle ei tarvita erillistä jatkuvasti julkaistua staging-verkkosivua tai `staging`-Git-haaraa. PR-kohtainen Netlify Deploy Preview toimii käyttöliittymän katselmointiympäristönä; GitHub Actions ajaa tietokantatestit eristetyllä paikallisella Supabase-stackilla.[66][69]

Ei-tuotannon Supabase-projekti on silti perusteltu ennen ensimmäisiä tuotantointegraatioita: se erottaa schema-/palvelinkokeilut tuotantodatasta. Tämä noudattaa ADR-0006:n erillisen staging-tietokannan valintaa. Staging-projektia ei ole vielä luotu; luonti odottaa erillistä kustannushyväksyntää.

## Ympäristömatriisi

| Ympäristö      | Käyttö                                                      | Tietokanta ja data                                                                          | Salaisuudet / pääsy                                                                                                     |
| -------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **local**      | Kehittäjän SvelteKit-sovellus ja integraatiot               | Supabase CLI:n paikallinen Docker/Podman-stack; testidata, ei tuotantoresursseja            | Paikallinen `.env` gitin ulkopuolella; ei tuotantotunnuksia                                                             |
| **test**       | GitHub Actionsin PR- ja main-tarkistukset                   | Jobin ajaksi käynnistetty paikallinen Supabase; `db reset --local`, pgTAP ja schema lint    | Ei salaisuuksia eikä etä-Supabase-projektia                                                                             |
| **preview**    | PR:n julkisesti avattava UI/API-esikatselu                  | Tällä hetkellä ei tietokantakytkentää; myöhemmin vain stagingin eristetty/synteettinen data | Netlify Deploy Preview -kontekstissa ei tuotantosalaisuuksia; build saa vain julkiset arvot, jos niitä joskus tarvitaan |
| **staging**    | Ennen tuotantoa tehtävät palvelin- ja migraatiotarkistukset | Yksi erillinen Supabase-projekti; ei tuotannon tunnuksia tai dataa                          | Erilliset staging-tunnukset palvelinpuolella. Projektia ei ole luotu; kustannusarvio/hyväksyntä vaaditaan               |
| **production** | Julkinen pääsovellus `main`-haaran mergejen jälkeen         | Tuleva erillinen Supabase-tuotantoprojekti; ei yhteiskäyttöä stagingin kanssa               | Netlify-funktioiden runtimeen rajatut salaisuudet. Ei tuotantosalaisuuksia frontend-buildiin, PR:ään tai agentille      |

`DEPLOY_URL` on Netlifyn yksittäisen deployn URL; `URL` on sivuston ensisijainen osoite. Smoke-testi käyttää deploy-kohtaista osoitetta eikä vaadi salaisuutta.[84]

## Salaisuuksien rajaus

- Salaisuutta ei nimetä `PUBLIC_*`- tai `VITE_*`-muuttujaksi: ne on tarkoitettu selaimeen toimitettavalle tiedolle.
- Server-only-tunnukset lisätään Netlifyn tuotantokontekstin function/runtime-scopeen vasta kun palvelin niitä tarvitsee. Preview-konteksti jää ilman niitä; staging saa korkeintaan omat staging-tunnuksensa.
- GitHub Actionsin `pull_request`-workflowilla on vain `contents: read`; se ei tarvitse tuotantosalaisuuksia. Salaisuuksia ei lisätä repo- tai ympäristömuuttujiin tämän vaiheen aikana.
- Tällä hetkellä ei ole tuotannon eikä stagingin Supabase-salaisuuksia. Supabase CLI:llä etäympäristöön linkitys, reset tai suora SQL-ajo on CI:ssä kielletty.

GitHubin environment-secrets ja hyväksyntäsäännöt ovat suunnitelmakohtaisia; varmista ominaisuuksien saatavuus yksityisessä repossa ennen kuin tuotannon salaisuuksia tai migraatioavaimia luodaan.[64][76]

## Sources

[64] https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments — GitHub Actions deployments and environments
[66] https://docs.netlify.com/deploy/deploy-types/deploy-previews — Netlify Deploy Previews
[69] https://supabase.com/docs/guides/local-development/testing/overview — Supabase testing overview
[76] https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule — GitHub branch protection rules
[84] https://docs.netlify.com/build/configure-builds/environment-variables — Netlify build environment variables
