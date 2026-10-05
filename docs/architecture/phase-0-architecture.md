# Archived draft: Nordic Ski Intelligence architecture

> **Superseded on 5 October 2026.** This was an initial architecture sketch. Do not treat its Next.js or collector recommendations as current decisions. The authoritative Phase 0 documents are [overview](overview.md), [technology comparison](technology-comparison.md), and the [ADRs](decisions/). The earlier source notes are retained for reference.

- **Tila:** ehdotettu perusta, ei vielä toteutus
- **Päivitetty:** 5.10.2026
- **Rajaus:** FI/SE/NO, noin 10 keskuksen vertikaalinen tuotesiivu, kaupallinen käyttö
- **Lähdevaatimus:** tässä dokumentissa ulkoisiin teknisiin tai lisenssiväitteisiin on merkitty lähdeviitteet. Lähteen yleinen lisenssi ei yksin hyväksy yksittäistä datasettiä tai käyttötapaa.

## 1. Päätösesitys

Rakennetaan ensin kapea, lähteiltään todennettava käyttökokemus: käyttäjä näkee kartalta missä olosuhteet ovat parhaat, voi tarkastella keskuksen ajantasaisia tietoja ja ymmärtää milloin sekä mistä ne on saatu. Järjestelmä ei väitä tietoa reaaliaikaiseksi, jos lähde ei sitä takaa.

**Ehdotettu tekninen lähtökohta, vahvistetaan kustannus- ja tilitarkistuksen jälkeen:**

- **Web:** TypeScript + Next.js App Router. Reitit ovat lokalisoituja alihakemistoja (`/fi/`, `/en/`, `/sv/`, `/no/`); palvelinrenderöinti tuottaa indeksoitavan keskussisällön. Next.js dokumentoi locale-reitityksen alihakemistoilla ja palvelinkomponentit; Netlify dokumentoi App Routerin, SSR:n ja ISR:n tuen nykyisellä adapterillaan.[9][12]
- **Lokalisaatio:** yksi keskitetty locale-rekisteri ja viestiluettelot; komponentit eivät sisällä käyttäjälle näkyviä kovakoodattuja tekstejä. Reititys, navigointi, suodattimet, resort-sisältö, SEO, päivämäärät, luvut, yksiköt ja säätermit lokalisoidaan. Englanti on väliaikainen käyttöliittymän fallback, mutta puutteellista käännöstä ei merkitä valmiiksi eikä keskeneräisiä lokalisoituja sivuja indeksoida. CI estää julkaisun, jos käännösten kattavuus alittaa määritellyn rajan. Locale-rekisteri tekee viidennen kielen lisäämisestä konfiguraatio- ja sisältötyön, ei komponenttien uudelleenrakentamista.
- **Tietokanta:** PostgreSQL + PostGIS. Supabase on ensisijainen ehdokas, koska se tarjoaa hallitun Postgresin ja PostGIS-laajennuksen; tuotantoprojektin alue, varmistukset, kustannukset ja oikeudet varmistetaan ennen päätöstä.[10][13]
- **Kartta:** MapLibre GL JS kartan renderöintiin, erillinen rajapinta kaupallisesti soveltuvalle vektorikartta-/tile-palvelulle. MapLibre on vektoritiilikarttoja selaimessa renderöivä kirjasto.[5] MapTiler on arvioitava ehdokas, ei sopimus- tai hankintapäätös; sen tällä hetkellä dokumentoitu maksullinen Flex-taso alkaa 30 USD/kk.[6]
- **Kerääjät:** erillinen ajastettava palvelinpuolinen työ, joka kutsuu hyväksyttyjä lähteitä, tallentaa lähdevastauksen, validoi ja päivittää tuotantokyselyihin sopivan lukunäkymän. Kerääjät eivät kuulu selaimeen. Ajastimen ja raakadatavaraston palveluntarjoaja päätetään, kun päivitysväli, säilytysaika, datan sijainti ja budjetti on sovittu.

Valinnat ovat tarkoituksella tavallisia ja vaihdettavia: domain-malli, lähdeadapterit ja karttatiilien URL eivät saa riippua yhdestä kaupallisesta kumppanista. Tämä ei vielä ole lupa ottaa yhtäkään tuotantopalvelua käyttöön.

## 2. Arkkitehtuurin rajat

### 2.1 Tiedon kulku

```text
Hyväksytty ulkoinen lähde
  → lähdeadapteri/kerääjä
  → muuttumaton raakahavainto + lähde- ja lisenssimetatiedot
  → jäsennys
  → yhteinen domain-malli ja yksikkömuunnokset
  → skeema-, järkevyys-, tuoreus- ja ristiriitatarkistukset
  → luottamusarvio
  → PostgreSQL/PostGIS (havaintohistoria + nykytilan projektiot)
  → vain luku -tuote-API
  → palvelinrenderöidyt paikalliset sivut + selainkartta
```

Selain ei kutsu sää-, hiihtokeskus- tai lisensoidun kartan lähde-API:a suoraan. Palvelin tallentaa, milloin lähde nouti tiedon, mitä lähde ilmoitti ja milloin tieto oli voimassa. Raakadatan säilytys, pääsy, poistaminen ja lisenssirajoitteet kirjataan lähdekohtaisesti; raakamuotoa ei säilytetä automaattisesti rajattomasti.

### 2.2 Käyttöoikeusrekisteri (hard gate)

Jokaiselle lähteelle ja datasetille pidetään rekisteri, jossa on vähintään omistaja, endpoint, tietoluokat, lisenssi/ehtoversio ja tarkistuspäivä, sallittu kaupallinen käyttö, attribuutioteksti, cache-/säilytysrajat, pyyntörajat, muokkaus-/johdannaisrajoitteet ja kontaktitiedot. Lähde saa kerätä tuotantodataa vasta, kun sen tila on `approved`; `pending`-lähteelle ei rakenneta tuotantokerääjää eikä näytetä tietoja asiakkaille. Ehtojen muuttuessa lähde voidaan pysäyttää ilman muiden adapterien muutoksia.

Lisenssiarvio tehdään **datasetti + endpoint + tallennus + esitystapa** -tasolla.

- FMI kertoo, että suurin osa sen aineistoista on avointa dataa; avoimen datan lisenssi on CC BY 4.0 ja käyttäjän on hyväksyttävä lisenssi ennen latausta.[2][11][15]
- SMHI:n avoimen datan ehtosivu kertoo CC BY 4.0 SE:n sallivan myös kaupallisen käytön ja vaatii lähdemerkinnän sekä muutosten ilmoittamisen.[3]
- MET Norwayn säädata on pääsääntöisesti NLOD 2.0- tai CC BY 4.0 -lisenssillä, ellei datasetin yhteydessä sanota muuta; lähdemerkintä ja yhteydenottokelpoinen User-Agent vaaditaan, eikä palvelulla ole SLA-takuuta.[14][1]

Nämä ehdot **eivät** kata hiihtokeskusten omia nosto-/rinne-/lumitietoja, kuvia, webcam-lähetyksiä tai kaikkia mahdollisia meteo-varoituksia. Niiden oikeudet selvitetään erikseen.

Open-Meteon maksuton API on ehtojen mukaan ei-kaupalliseen käyttöön; mainoksia tai tilauksia sisältävän tuotteen on käytettävä kaupallista lisenssiä.[16][7] Se on siksi vain maksullisen tuotantosopimuksen varavaihtoehto, ei ilmainen MVP:n tuotantolähde.

### 2.3 Raakatiedot ja havainnot

- Raakadata säilytetään versioituna ja käyttöoikeusrekisteriin linkitettynä sovitun säilytysajan puitteissa. Kehityksessä siitä muodostetaan anonymisoidut/parannetut parseritestien fixturet vain, jos ehdot sallivat tallennuksen ja testikäytön.
- Jokainen havainto on lisättävä aikasarjatieto, ei hiljainen päivitys: lähde, kohde, mittari, arvo/yksikkö, havainto-/julkaisuaika, noutoaika, voimassaolo, validoitu tila ja parseriversio.
- Nykytilan API-lukunäkymä muodostetaan tuoreimmista hyväksytyistä havainnoista. Hylätty tai ristiriitainen arvo ei korvaa aiempaa hyvää havaintoa huomaamatta.
- Kaikki sisäiset yksiköt ovat eksplisiittisiä; koordinaatisto tallennetaan SRID-tiedolla. Julkinen kartta käyttää GeoJSON/WGS84-koordinaatteja.

## 3. Domain- ja score-malli

Erota neljä elinkaarta: **staattinen resort-sisältö**, **dynaamiset olosuhdehavainnot**, **kaupalliset tarjoukset** ja **editoriaalinen sisältö**. Näitä ei yhdistetä yhdeksi resort-taulukoksi tai yhdeksi ulkoisen lähteen kuvaukseksi.

Alustavat käsitteet:

- `Resort`, `Country`, lokalisoidut `ResortTranslation`-sisällöt ja karttasijainti/rajaukset.
- `Source`, `Dataset`, `LicenseApproval`, `FetchRun`, raakahavainto sekä normalisoitu `Observation`.
- `SkiArea`, `Lift`, `Run` ja niiden dynaamiset `StatusObservation`-havainnot; resort-/lift-tason kattavuus on MVP:n minimi. Rinnetason tilat lisätään vain, jos lähde ja tiedon kattavuus mahdollistavat sen.
- `WeatherObservation` ja `SnowObservation`, joilla on korkeustieto aina kun lähde sen tarjoaa. Ennuste ja toteutunut havainto ovat eri tietotyyppejä.
- `ConditionsScore` on 0–100, versiokohtainen ja selitettävä; laskenta asuu domain-/palvelukerroksessa, ei käyttöliittymässä. Ehdokkaina ovat lumensyvyys, viimeaikainen ja ennustettu lumisade, avoimien rinteiden ja hissien osuudet, lämpötila, tuuli, lumen laatu ja sade. Jokainen osa-arvo, käytetty havainto, sovellettu paino ja score-version tunniste säilytetään, jotta tulos voidaan perustella ja laskea uudelleen. Puuttuva tieto ei muutu nollaksi huomaamatta.
- `ResortRating` on erillinen, pysyvä arvio eikä sekoitu hetkelliseen `ConditionsScore`-arvoon. Master promptin alustavat kategoriapainot säilytetään konfiguroitavina: tunnelma/ympäristö 15 %, rinteet 25 %, hissit 15 %, off-piste 20 %, majoitus 10 %, ruoka 7,5 %, après-ski 7,5 %. Ulkoiset arviot pysyvät omissa kentissään ja lähdemerkintöineen.

Alustava luottamus ei ole score: jokaisella mittarilla on lähteen luotettavuusluokka, validointitulos, ikä/tuoreus ja ristiriitojen tila. Käyttöliittymä näyttää ymmärrettävän tilan (esim. luotettava / vanhentunut / ristiriitainen) ja `päivitetty`-ajan. Numeerista luottamusarvoa ei julkaista ennen kuin kalibrointi on testattu. Conditions Score otetaan yleisölle käyttöön vasta, kun yksiköiden, kattavuuden, virhetilojen ja version päivityssäännöt on määritelty ja testit osoittavat sen toimivan.

## 4. Web, paikallisuus, SEO ja kartta

- Kaikki käyttäjän näkyvät tekstit tulevat lokalisaatiokerroksesta. Locale-lista on konfiguraatio, ei reittikomponentteihin hajautettu ehtolause.
- URL-rakenne käyttää kielialihakemistoja (`/fi/`, `/en/`, `/sv/`, `/no/`). Keskusten slugit voidaan lokalisoida erikseen; kielenvaihto käyttää saman keskuksen kielivastinetta, ei saman tekstin mekaanista käännöstä.
- Indeksoitava sisältö kattaa tarpeen mukaan keskusten lisäksi maa-, alue- ja vertailusivut; jokaisella julkaistulla sivulla on lokalisoitu title/description, Open Graph -metadata, canonical ja vastaavien sivujen `hreflang`-viitteet. Sitemap sisältää vain julkaistut, laadultaan riittävät sivut; `robots.txt` ohjaa indeksointia ja soveltuva strukturoitu data kuvaa resort-sisällön ilman oletusta hakutuloksen rich-resultista. Google suosittelee lokalisoitujen versioiden merkitsemistä keskenään ja self-referential canonicalin käyttöä.[8]
- SSR/ISR tuottaa varsinaisen sisällön HTML:ään; kartta ja interaktio ovat client-side. Latauksen epäonnistuminen ei saa piilottaa tekstimuotoista olosuhdeyhteenvetoa tai SEO-sisältöä.
- Kartan renderöinti, tile/style URL, attribution ja mahdolliset maastokerrokset ovat vaihdettavan provider-sovittimen takana. OSM-aineiston lisenssi ja OSM Foundationin tile-palvelu ovat eri asioita: `tile.openstreetmap.org` on donation-rahoitteinen best-effort-palvelu, jolla ei ole SLA:ta ja jonka käyttöehdot vaativat mm. attribuution, tunnistettavan User-Agentin ja välimuistin; sitä ei valita kaupallisen tuotteen hallitsemattomaksi tuotantotiilipalveluksi.[4] Sopiva maksullinen palvelu, sen attribuutio ja karttakohtainen kustannus vahvistetaan ennen julkaisua.

## 5. Turvallisuus ja kaupallinen valmius

MVP on anonyymi; käyttäjätilejä, henkilötietoja tai maksamista ei rakenneta. Julkinen API palauttaa vain hyväksyttyä tuotetietoa, on lukurajattu ja välimuistitettava. Tietokannan kirjoitusoikeus on vain palvelin-/keräjäympäristöllä; mitään palvelimen salaisuutta ei toimiteta selaimelle. Jos selain myöhemmin käyttää Supabasea suoraan, RLS ja jokaisen taulun politiikat ovat julkaisun estävä tarkistuslista; Supabase itse korostaa RLS:n, SSL:n, verkkorajoitteiden ja varmistusten tarkistamista tuotannossa.[10]

Kerääjä käsittelee ulkoista dataa epäluotettavana: sallittujen domainien lista, redirectin kohteen tarkistus, aikakatkaisut, vastauskoon ja sisältötyypin rajat, schema-validointi, retry/backoff ja yksilöidyt virheraportit. Tuotantotunnuksia ei anneta koodausagenteille; työ tapahtuu haaroissa, testeissä ja preview-ympäristössä. Julkaisu edellyttää CI:tä, ihmisen katselmointia, tuotantoon rajattua tunnistetta, smoke-testejä ja monitorointia.

Kaupalliset kumppanit mallinnetaan adapterein: majoitus, liput, vuokraus ja muut tarjoukset voivat vaihtua rikkomatta resort- tai olosuhdemallia. Kumppanin sisältö on erotettava orgaanisesta suosituksesta ja merkittävä sponsoroinniksi. Premium, henkilökohtaiset hälytykset ja käyttäjätilit ovat myöhempiä ominaisuuksia; MVP:n datamalli ei saa edellyttää niitä.

## 6. MVP ja vaiheistus

**Ensimmäinen julkinen vertikaalisiivu:** noin 10 keskusta FI/SE/NO; jokaisella lokalisoitu perustieto, karttasijainti, saatavilla olevat lumi-/sää-/aukiolotiedot lähteineen ja päivitysaikoineen, vertailu sekä selitetty olosuhdetieto. Paikkamäärä ei mene kattavuuden ja luotettavuuden edelle.

**Ei MVP:ssä:** tilit/favoriitit/hälytykset, cross-country, off-piste-reittien turvallisuusesitykset, webcam-kuvat, käyttäjäarviot, historialliset analyysit, affiliate-checkout, maksulliset ominaisuudet, sovelluskauppasovellukset tai 10 keskuksen jälkeinen massalaajennus. Myöhemmässä off-piste-toteutuksessa data erottaa selvästi hoidetun rinteen, ski touringin, backcountryn ja off-pisten; hallitsematonta reittiä ei esitetä turvalliseksi tai taattuna. Cross-country lisätään vasta omassa vaiheessaan, jossa klassinen/luistelu, latujen kunto, viimeisin kunnostus, valaistus ja pituus mallinnetaan.

Eteneminen:

1. **Vaihe 0 — arkkitehtuuri (valmis dokumentoitavaksi).** Reunaehdot, komponenttirajat, lähdepolitiikka, alustava domain ja avoimet päätökset. Ei sovelluskoodia.
2. **Vaihe 1 — toteutettavuus ja käyttöoikeudet.** Päätä 10 kohdetta; inventoi viralliset operaattori- ja säädatalähteet; kirjaa kunkin käytön laillinen peruste, attribuutio, rajoitteet ja rajapinta; tee hankinta-/kulupäätökset sekä tuoreustavoite. Hylkää sellainen lähde, jonka lupa tai ehdot eivät riitä. Acceptance: jokaisella MVP:n kentällä on hyväksytty lähde tai kenttä poistetaan/merkitään ei saatavaksi.
3. **Vaihe 2 — domain + ingestio.** Migraatiot, lähderekisteri, yhteiset skeemat, havaintohistoria, ensimmäiset adapterit, golden fixturet, validointi ja confidence. Acceptance: jokainen adapteri tuottaa saman normalisoidun mallin ja väärä/vanha/ristiriitainen data ei päädy nykytilaan.
4. **Vaihe 3 — käyttäjälle näkyvä web-vertikaalisiivu.** Paikallistetut SSR-resort-sivut, kartta, suodatus/vertailu, API ja SEO-metatieto. Acceptance: FI/EN/SV/NO käännösten kattavuustesti, hreflang/canonical/sitemap tarkistus, mobiili- ja Core Web Vitals -testit, tiedon lähde/tuoreus näkyy.
5. **Vaihe 4 — pilotti ja kaupallistamisen validointi.** Häiriötilanteet, lähdevalvonta, käyttö-/tile-kulujen mittaus, hakukonenäkyvyyden sisältörajat ja ensimmäiset hyväksytyt affiliate-kokeilut. Laajenna ominaisuuksia vasta mittaustiedon ja käyttäjäarvon perusteella.

Jokainen vaihe päättyy omaan katselmointiin, arkkitehtuurin johdonmukaisuustarkistukseen, acceptance-listaan ja päätöslokiin. Seuraavaan vaiheeseen ei siirrytä hiljaisesti.

## 7. Avoimet päätökset ennen toteutusta

1. **Keskukset:** täsmällinen 10 kohteen lista ja valintakriteeri (maat, koko, operaattorit, aineiston saatavuus).
2. **Keskusdata ja oikeudet:** operaattorikontaktit, kirjallinen lupa/ehdot, tieto- ja kuvakohtaiset käyttöoikeudet sekä viralliset API/feedit. Älä tulkitse julkista sivua tai teknistä endpointia käyttöluvaksi.
3. **Meteo-data:** valitaan kullekin maalle/API:lle konkreettiset datasetit ja endpointit; vahvistetaan niiden saatavuus, attribuutiomuoto, pyyntörajat, tallennus/redistribuutio sekä mahdolliset erikoisehdot.
4. **MVP:n tarkkuus:** resort-/lift-/rinnetaso sen mukaan, mitä lisenssit, lähteet ja validointi oikeasti tukevat.
5. **Palvelut ja budjetti:** omistettava hosting-/DB-/raakadatavarasto, alue, varmistukset, ajoittaja ja kuukausibudjetti. Selvitä nykyiset Netlify-/Supabase-tilit ja oikea organisaatio ennen resurssien luontia.
6. **Kartta:** kaupallisen karttapalvelun ehdot, tile-/MAU-volyymi, attribution, offline/cache-rajat ja kustannuskatto.
7. **Laatu:** hyväksyttävä päivitystiheys per kenttä, stale-raja, virhetilanteiden UI ja mitä vertailussa tapahtuu kun resortilta puuttuu tietoa.
8. **Scoret:** `Conditions Score` -kertoimet/puuttuvan datan käsittely, versiointi ja julkaisemisen kynnys; pysyvän Resort Ratingin lähteet ja ylläpito.
9. **Brändi/SEO:** nimi, vapaa domain, alkuperäinen sisältö/käännösten vastuu sekä julkaistavien lokalisoitujen sivujen indeksointiraja.

## 8. Vaiheen 0 itsearviointi

Master promptin ydinehdot on säilytetty: aloitusrajauksen pienuus, neljän kielen rakenteellinen tuki, server-renderöity SEO-sisältö, lähdeadapterit, käyttöoikeudet, erillinen domain-/conditions-/rating-/commercial-malli, selitettävät versioidut scoret, vaihdettava karttapalvelu, käyttäjätilien ja tulevien ominaisuuksien lykkäys sekä PR/CI/preview-julkaisupolku. **Arkkitehtuuri ei kuitenkaan ole vielä toteutusvalmis ennen kohtien 1–6 päättämistä**; niissä on kustannus- ja lisenssiriskiä, jota ei pidä korvata oletuksilla.

Tämän vaiheen lopputulos on dokumentaatio, ei toimiva sovellus. Seuraavaksi käynnistetään Vaihe 1 vasta, kun lähde- ja infrastruktuuripäätökset voidaan tehdä oikealla tiedolla.

## Sources

[1] https://docs.astro.build/en/guides/internationalization — Internationalization (i18n) Routing | Docs
[2] https://docs.astro.build/en/concepts/islands — Islands architecture | Docs
[3] https://docs.astro.build/en/guides/server-side-rendering — On-demand rendering | Docs
[4] https://svelte.dev/docs/kit/introduction — Introduction • SvelteKit Docs
[5] https://svelte.dev/docs/kit/adapter-netlify — Netlify • SvelteKit Docs
[6] https://nextjs.org/docs/app/guides/internationalization — Guides: Internationalization | Next.js
[7] https://docs.netlify.com/frameworks/sveltekit/overview — 404 | Netlify Docs
[8] https://supabase.com/docs/guides/cron — Cron | Supabase Docs
[9] https://supabase.com/docs/guides/functions/limits — Limits | Supabase Docs
[10] https://supabase.com/docs/guides/database/extensions/postgis — PostGIS: Geo queries | Supabase Docs
[11] https://supabase.com/pricing — Pricing & Fees | Supabase
[12] https://supabase.com/docs/guides/platform/regions — Available regions | Supabase Docs
[13] https://neon.com/docs/extensions/postgis — The postgis extension - Neon Docs
[14] https://neon.com/pricing — Pricing — Neon
[15] https://developers.cloudflare.com/workers/configuration/cron-triggers — Cron Triggers · Cloudflare Workers docs
[16] https://developers.cloudflare.com/workers/platform/limits — Limits · Cloudflare Workers docs
