# Phase 4 — tiedonkeruuputken toteutus

- **Tila:** fixture-pohjainen putki toteutettu ja testattu eristetyssä haarassa
- **Rajaus:** ei live-lähteitä, ajastusta, tietokantakirjoitinta, frontend-triggeriä tai 100+ kohteen skaalausta
- **Perusta:** [domain-malli](domain-model.md), [tietokanta](database.md), [lähdeoikeuksien käytäntö](../official-resort-source-policy.md) ja [ADR-0008](decisions/0008-data-rights-gate.md)

## Putken rakenne

Server-only-moduulit ovat `src/lib/server/collect/`-hakemistossa. `runCollectPipeline` yhdistää valitun Levi-adapterin vaiheisiin:

1. **Approval gate:** tarkistaa hyväksyntätilan, voimassaolon, keräysluvan, normalisoidun tallennuksen luvan ja sallitut kenttäavaimet ennen collectorin kutsua.
2. **Collect:** HTTP-adapteri toteuttaa rajatut uudelleenyritykset, aikakatkaisun, lähdekohtaisen nopeusrajoituksen, TTL-välimuistin, stale-fallbackin ja 1 MiB vastausrajan. `providerRequests` laskee toteutuneet ulospäin tehdyt pyynnöt.
3. **Parse:** Levi-snow-, hissi- ja rinneadapterit vastaanottavat JSON-tekstin/olion; ne eivät tee verkkokutsuja. Parserit hylkäävät liian suuret, virheelliset ja tuntemattomia tiloja sisältävät vastaukset.
4. **Normalize:** tuottaa yhteiset faktakandidaatit, kanonisen avaimen, hyväksyntään sidotun `fieldKey`-avaimen ja lähteen ilmoittaman havaintoajan.
5. **Validate:** soveltaa numeerisia rajoja, yksikkö- ja tekstiarvojen sallittuja listoja sekä duplikaattien hylkäystä. Yli viisi minuuttia tulevaisuuteen päivätyt havainnot hylätään.
6. **Confidence ja konfliktit:** lähdetyyppi ja tuoreus vaikuttavat luottamustasoon. Konfliktissa vanhaa validia arvoa ei korvata.
7. **Persist-rajapinta:** runner kirjoittaa vain hyväksytyt faktat, konfliktit ja ajon yhteenvedon `Persister`-rajapinnan kautta. Fixture-testeissä käytetään muistipohjaista toteutusta; Supabase/PostgreSQL-toteutusta ei ole tässä vaiheessa.

Rakenteiset lokit poistavat herkkiä avaimia myös sisäkkäisistä olioista. Lähteen terveystila seuraa onnistumisia, epäonnistumisia ja viivettä, mutta toteutettu muistipohjainen seuranta ei säily prosessin uudelleenkäynnistyksen yli. Tuotantokoosteen on injektoitava tarkoitukseen sopiva pysyvä toteutus ennen operatiivista käyttöä.

## Turvarajat ja tarkoituksella tekemättä jätetty

- Julkisesta API:sta ei voi käynnistää keräystä; `src/routes/api/collect/+server.ts` on poistettu.
- Parserit ja fixture-testit toimivat ilman live-internetiä. Kaikki tämän vaiheen resort-vastaukset ovat synteettisiä.
- Raakavastauksen säilytys on runnerissa pois käytöstä. Se voidaan ottaa käyttöön vasta, kun tietokantakirjoitin valvoo hyväksynnän mukaista `purge_after`-aikaa.
- Tuotantolähdettä, lähdekohtaista hyväksyntätietuetta, ajastusta, pysyvää lähdeterveydentilaa, kustannuslaskutusta tai oikeaa tietokantapersisteriä ei ole konfiguroitu. Pyyntölaskuri on kustannusvalvonnan mittauspiste, ei rahamääräinen hinta-arvio.
- Tietokantaan ei kirjoitettu eikä staging-/production-projektia käytetty putkitesteissä. Frontend ei voi kasvattaa provider-kustannuksia.

Nämä rajat ovat tietoisia: seuraava käyttöönotto vaatii ensin kenttäkohtaiset lähdeoikeudet ja niihin sopivan pysyvän persisterin; fixture-testien vihreys ei itsessään hyväksy yhtään ulkoista lähdettä.

## Fixturet ja toistettavuus

`tests/fixtures/resorts/levi/` sisältää synteettiset snow-, lift- ja slope-vastaukset, virheellisen snow-vastauksen sekä odotetut normalisoidut tulokset. Odotuksissa tarkistetaan myös kenttäavaimet ja lähteen ilmoittamat havaintoajat. Testikello on kiinnitetty, ja collectorin `fetch` sekä viive ovat testeissä injektoituja.

Kattavuus sisältää onnistuneen putken lisäksi oikeuseston, virheellisen/tuntemattoman datan, stale-arvon, provider-virheen ja uudelleenyritykset, nopeusrajoituksen, konfliktin, viimeisen validin arvon säilymisen, tulevaisuuteen päivätyn havainnon, raakavastauksen tallentamattomuuden, herkän lokisisällön suodatuksen sekä frontend-keräysreitin puuttumisen.

## Paikallinen verifiointi

Vaiheen tarkistus ajettiin phase4-worktreessä:

- `mise exec -- npm run check` — `svelte-check found 0 errors and 0 warnings`
- `mise exec -- npm run lint` — onnistui
- `mise exec -- npm run format:check` — kaikki tiedostot Prettier-muodossa
- `mise exec -- npm test` — unit 57/57, adapter 3/3, API 1/1 ja security 5/5. Domain- ja scoring-hakemistoista ei löytynyt testitiedostoja (`--passWithNoTests`). Tietokantaturvatarkistus läpäisi.
- `mise exec -- npm run build` — SvelteKit/Vite-tuotantobuild ja Netlify-adapteri onnistuivat.

Nämä ovat paikallisen fixture- ja build-tarkistuksen tuloksia, eivät tuotantokeräyksen tai tietokantaintegraation todennus.
