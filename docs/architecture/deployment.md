# Julkaisu ja palautus

## Julkaisupolku

1. Kehittäjä/agentti avaa feature-haarasta PR:n `main`-haaraan.
2. GitHub Actions ajaa laadun, tyyppien, testien, tietokantamigraatioiden ja riippuvuusturvan tarkistukset.
3. Netlify rakentaa PR:stä Deploy Previewn; katselmoija tarkistaa sivun ja `/api/health`-sopimuksen.
4. Ihminen hyväksyy muutoksen ja mergeää PR:n `main`-haaraan.
5. Netlify rakentaa tuotannon `main`-haarasta. Ensimmäinen julkaisu tuli GitHubin `main`-haarasta, mutta Netlifyn asetussivu sallii vielä myös CLI-, MCP- ja API-julkaisut tuotantoon. Rajoita nämä pois ennen kuin agenteille annetaan tuotantojulkaisuoikeus; kunnes asetus on muutettu, käytä vain GitHubin suojattua PR-polku.[68][79]
6. Repo sisältää Netlify Build Pluginin, jonka `onSuccess` kutsuu deploy-kohtaisen `DEPLOY_URL`-osoitteen `/api/health`-reittiä. Se tarkistaa HTTP-tuloksen, JSON-tyypin ja `{ "status": "ok" }` -sopimuksen ja kirjaa tuloksen Netlifyn deploy-lokiin.[81][82][84]

Netlify ajaa `onSuccess`-hookin vasta onnistuneen deployn jälkeen; se ei voi estää jo julkaistua versiota. Smoke-virhe merkitään build-/plugin-tulokseen ja vaatii välittömän palautuksen.[82][83]

## Netlify-asetukset

`netlify.toml` määrittää SvelteKit-buildin, Node-version ja smoke-pluginin. Netlify on yhdistetty julkiseen GitHub-repoon `lassepehkonen/nordic-ski-intelligence`; tuotantohaara on `main`, Deploy Previewt ovat käytössä PR:ille ja muut kuin tuotantohaarat eivät saa erillisiä branch-deployta. Netlifyn Git-yhteys antaa build-järjestelmälle pääsyn lähdekoodiin.[80] Tuotantodeploy `6ac3e90949031a6686fe840d` julkaisi commitin `e824f34afe37daa8a2cd3e33e0b73c693f19673a`; deploy on `ready`, plugin-tila `success` ja `/api/health` palauttaa `{"status":"ok"}`.

Build-hookeja ei ole lisätty. Vaikka käytännön julkaisupolku on Git, Netlify-asetus sallii tällä hetkellä myös suorat CLI-, MCP- ja API-julkaisut. Rajoita ne Netlifyn deployment-methods-asetuksella ennen agenttien tuotantokäyttöä.[79][85]

Buildin pitää onnistua ilman `SUPABASE_SERVICE_ROLE_KEY`-, tietokantasalaisuutta tai muuta tuotantotunnusta. Tämän vaiheen sovellusskeleton ei käytä ulkoisia tunnuksia.

## Smoke-testin epäonnistuminen ja palautus

- Jos build tai migraatioiden paikallinen validointi epäonnistuu ennen julkaisuun asti pääsyä, uusi tuotantodeploy ei valmistu ja aiempi sivusto jää käyttöön.
- Jos jälkideployn smoke-testi epäonnistuu, tarkista Netlifyn deploy-loki ja avaa Netlifyn Deploys-näkymä. Julkaise viimeinen toimiva deploy uudelleen (Publish deploy); vaihtoehtoisesti tee virheellisen commitin revert-PR, jolloin `main` rakentuu uudelleen. Netlify säilyttää deployt ja tukee aiemman deployn palauttamista; tätä MVP:tä varten API-pohjaista suoraa tuotantojulkaisua ei käytetä.[72][73]
- Kun Git-pohjainen julkaisusuojaus on päällä, käytä palautukseen ensisijaisesti revert-PR:ää, jos vanhan artefaktin suora julkaisu ei ole sallittu. Älä kierrä suojausta Netlify CLI:llä tai API:lla.
- Tietokannan palautus on erillinen toimenpide: sovelluksen rollback ei palauta skeemaa tai dataa. Tuotantomuutokset tehdään myöhemmin hyväksytyillä migraatioilla; älä koskaan käytä tuotannossa `supabase db reset` -komentoa. Jos migraatio ei ole turvallisesti palautettavissa, tee korjaava forward-migraatio tai käytä hyväksyttyä varmistuspalautusta.

## Julkaisun raportointi

Netlify näyttää build/deploy-lokin, deploy-URL:n ja smoke-pluginin tuloksen; GitHub PR näyttää CI-checkit ja Previewn. `main`-haaran tuotantodeploy ja `/api/health`-smoke on luettu takaisin onnistuneiksi. PR Deploy Previewn erillinen onnistuminen varmennetaan seuraavalla PR:llä ennen kuin pipeline merkitään kokonaan valmiiksi.

Erillistä sähköposti-/chat-ilmoitusintegraatiota ei tässä vaiheessa konfiguroida; Netlifyn deploy-notifications-palvelu on mahdollinen myöhempi lisä, mutta nykyinen raportointipolku on deploy-loki ja GitHub-status.[67]

## Nykyinen raja

Tuotannon ja stagingin Supabase-projekteja ei ole luotu eikä tuotantomigraatioiden automaattista etäajoa ole kytketty. CI validoi nykyiset migraatiot vain paikallisessa stackissa; tuotantoon ei ole asetettu tunnuksia.

## Sources

[67] https://docs.netlify.com/deploy/deploy-notifications — Netlify deploy notifications
[68] https://docs.netlify.com/deploy/create-deploys — Netlify create deploys
[72] https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview — Netlify manage deploys and rollbacks
[73] https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api — Netlify API deploy and rollback
[79] https://docs.netlify.com/build/git-workflows/overview — Netlify Git workflows and production protection
[80] https://docs.netlify.com/build/git-workflows/repo-permissions-linking — Netlify repository linking
[81] https://docs.netlify.com/build/build-plugins/overview — Netlify Build Plugins overview
[82] https://docs.netlify.com/build/build-plugins/create-plugins — Netlify create Build Plugins
[83] https://docs.netlify.com/extend/develop-and-share/develop-build-plugins — Develop Netlify Build Plugins
[84] https://docs.netlify.com/build/configure-builds/environment-variables — Netlify build environment variables
[85] https://docs.netlify.com/build/configure-builds/build-hooks — Netlify Build hooks
