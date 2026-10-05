# Julkaisu ja palautus

## Julkaisupolku

1. Kehittäjä/agentti avaa feature-haarasta PR:n `main`-haaraan.
2. GitHub Actions ajaa laadun, tyyppien, testien, tietokantamigraatioiden ja riippuvuusturvan tarkistukset.
3. Netlify rakentaa PR:stä Deploy Previewn; katselmoija tarkistaa sivun ja `/api/health`-sopimuksen.
4. Ihminen hyväksyy muutoksen ja mergeää PR:n `main`-haaraan.
5. Netlify rakentaa tuotannon `main`-haarasta. Netlifyn Git-pohjaisen julkaisun suojaus pidetään päällä, jotta tuotantoon julkaistaan Git-työnkulusta eikä agentin suoralla CLI/API-julkaisulla.[68][79]
6. Repo sisältää Netlify Build Pluginin, jonka `onSuccess` kutsuu deploy-kohtaisen `DEPLOY_URL`-osoitteen `/api/health`-reittiä. Se tarkistaa HTTP-tuloksen, JSON-tyypin ja `{ "status": "ok" }` -sopimuksen ja kirjaa tuloksen Netlifyn deploy-lokiin.[81][82][84]

Netlify ajaa `onSuccess`-hookin vasta onnistuneen deployn jälkeen; se ei voi estää jo julkaistua versiota. Smoke-virhe merkitään build-/plugin-tulokseen ja vaatii välittömän palautuksen.[82][83]

## Netlify-asetukset

`netlify.toml` määrittää SvelteKit-buildin, Node-version ja paikallisen smoke-pluginin. Netlify-projekti on luotu ja sen tarkoitettu lähde on julkinen GitHub-repo; GitHub OAuth -yhdistäminen odottaa passkey-vahvistusta, eikä sivustolla ole vielä deployta. Yhdistäessä tuotantohaaraksi asetetaan `main` ja PR Deploy Previewt otetaan käyttöön. Repo-linkitys antaa Netlifyn GitHub-integraatiolle pääsyn lähdekoodiin.[80]

Erillisiä build-hookeja tai token-pohjaista suoraa tuotantojulkaisua ei lisätä; tuotanto alkaa vain suojatusta `main`-haaran Git-julkaisusta.[79][85]

Buildin pitää onnistua ilman `SUPABASE_SERVICE_ROLE_KEY`-, tietokantasalaisuutta tai muuta tuotantotunnusta. Tämän vaiheen sovellusskeleton ei käytä ulkoisia tunnuksia.

## Smoke-testin epäonnistuminen ja palautus

- Jos build tai migraatioiden paikallinen validointi epäonnistuu ennen julkaisuun asti pääsyä, uusi tuotantodeploy ei valmistu ja aiempi sivusto jää käyttöön.
- Jos jälkideployn smoke-testi epäonnistuu, tarkista Netlifyn deploy-loki ja avaa Netlifyn Deploys-näkymä. Julkaise viimeinen toimiva deploy uudelleen (Publish deploy); vaihtoehtoisesti tee virheellisen commitin revert-PR, jolloin `main` rakentuu uudelleen. Netlify säilyttää deployt ja tukee aiemman deployn palauttamista; tätä MVP:tä varten API-pohjaista suoraa tuotantojulkaisua ei käytetä.[72][73]
- Kun Git-pohjainen julkaisusuojaus on päällä, käytä palautukseen ensisijaisesti revert-PR:ää, jos vanhan artefaktin suora julkaisu ei ole sallittu. Älä kierrä suojausta Netlify CLI:llä tai API:lla.
- Tietokannan palautus on erillinen toimenpide: sovelluksen rollback ei palauta skeemaa tai dataa. Tuotantomuutokset tehdään myöhemmin hyväksytyillä migraatioilla; älä koskaan käytä tuotannossa `supabase db reset` -komentoa. Jos migraatio ei ole turvallisesti palautettavissa, tee korjaava forward-migraatio tai käytä hyväksyttyä varmistuspalautusta.

## Julkaisun raportointi

Kun GitHub-yhteys on valmis, Netlify näyttää build/deploy-lokin, deploy-URL:n ja smoke-pluginin tuloksen; GitHub PR näyttää CI-checkit ja Previewn. Suojattuun `main`-haaraan mergetty PR käynnistää tuotantobuildin. Julkaisua ei raportoida onnistuneeksi ennen kuin deploy-tila ja smoke-tulos on luettu takaisin.

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
