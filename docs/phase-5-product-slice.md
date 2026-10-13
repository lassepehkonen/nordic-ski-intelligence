# Phase 5 — 10 keskuksen tuoteviipale

- **Tila:** sovellus- ja tietokantaviipale toteutettu `feature/phase-4-collection-pipeline`-haarassa; Supabase-projekti on staging, ei tuotanto.
- **Keskukset:** 10 (FI 6, SE 2, NO 2), eri kokoluokat.
- **Käyttötarkoitus:** näytä käsin varmennetut hissi- ja rinnemäärät sekä kansallisten säärajapintojen ennusteet.
- **Lähderajaus:** hiihtokeskusten sivuilta käytetään ainoastaan hissien ja rinteiden kokonaismäärää sekä auki olevien määriä. Sivujen muuta sisältöä ei kerätä. Jokaisen keskuksen sallittu lähde ja kenttärajat ovat [`docs/adapters/`](adapters/README.md)-hakemistossa; yleinen hyväksyntä- ja lisenssitilanne on tiedostoissa [`docs/official-resort-source-policy.md`](official-resort-source-policy.md), [`docs/data-source-matrix.md`](data-source-matrix.md) ja [`docs/data-licensing.md`](data-licensing.md).

## Tietovirta ja kustannusraja

1. **Hissi-/rinnestatus:** `src/lib/server/resorts/pilot.ts` sisältää käsin varmennetun snapshotin, lähde-URL:n ja tarkistusajan. `status-writer.ts` tarkistaa käyttöluvan, aikaleiman, määrien järkevyyden ja tuoreuden sekä päivittää vain neljä numeerista statuskenttää ja niiden lähdemetatiedot. Lähdesivua ei lueta sovelluksen tai selaimen pyynnöstä.
2. **Sää:** `src/lib/server/weather/` hakee FMI:n, SMHI:n ja MET Norjan rajapinnoista, normalisoi ja validoi vastaukset. `runPilotWeather` kirjaa todelliset provider-pyynnöt; `weather-writer.ts` tallentaa normalisoidut pisteet sekä `pilot_collection_runs`-ajon. Tietokantaan kirjataan kokonaispyyntömäärä ja provider-kohtaiset määrät.
3. **Tuoterajapinta:** server-only-lukija kutsuu `public.get_pilot_product()`-RPC:tä publishable-avaimella. `public.pilot_resorts`-tauluun ei ole `anon`/`authenticated`-rooleilla suoraa `SELECT`-oikeutta; julkinen luku kulkee muotoillun RPC:n kautta. Kirjoitus käyttää vain server-side `SUPABASE_SERVICE_ROLE_KEY`-avainta.
4. **Frontend ja lokalisointi:** `GET /api/pilot` palauttaa tietokantacachen. SSR-sivu toimii Paraglide-reiteillä `/en`, `/fi`, `/sv` ja `/no`; `/` ohjaa englanninkieliselle reitille. Kieli, päivämäärät, numerot ja maakohtaiset aikavyöhykkeet ovat lokalisoituja. Tuote-API pysyy reitillä `/api/pilot`. Selain ei kutsu FMI:tä, SMHI:tä, MET Norjaa eikä keskusten sivuja, joten käyttäjämäärä ei monista provider-pyyntöjä. API-vastauksen välimuistipolitiikka on `max-age=60`, `s-maxage=300`, `stale-while-revalidate=600`. Staging-sivu on `noindex`, kunnes resorttien sisältö- ja SEO-käännökset sekä tuotantolähteiden oikeudet on hyväksytty.

Supabase-muuttujat on määritelty `src/env.ts`:ssä SvelteKitin `$app/env/private`-rajapinnan kautta. Ne ovat yksityisiä ja runtime-muuttujia; puuttuva asetus antaa rajapinnasta hallitun 503-vastauksen eikä paljasta arvoja.

Supabase Security Advisor raportoi tarkoituksella julkisesti kutsuttavan `SECURITY DEFINER`-RPC:n ja `pilot_collection_runs`-taulun RLS:n ilman allow-politiikkaa. RPC:n `search_path` on lukittu, tulosrajapinta on kenttäkohtaisesti rajattu eikä julkiseen rooliin ole taulu-SELECT-oikeutta; ajotaulu jää julkisille rooleille deny-all-tilaan. Tuotantoon siirrossa nämä havainnot tarkistetaan uudelleen ([SECURITY DEFINER -linter](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [RLS-linter](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)). Tehokerroksen advisorissa on lisäksi vaiheiden 1–2 yksityisen `app`-skeeman käyttämättömiä indeksejä ja indeksoimattomia viiteavaimia; niitä ei muutettu tässä vaiheessa.

## Päivitys ja käyttö

Kopioi `.env.example` paikalliseen `.env`-tiedostoon ja täytä staging-projektin arvot. `.env` on gitignore-säännössä; service-role-avain kuuluu vain serverille eikä sitä saa nimetä `PUBLIC_`-muuttujaksi.

- `npm run dev` käynnistää käyttöliittymän.
- `GET /api/pilot` on JSON-tuoterajapinta.
- Hissien/rinteiden määrät tarkistetaan käsin vain adapterin dokumentoimasta lähteestä. Päivitä neljä lukua ja `status.fetchedAt` tiedostoon `src/lib/server/resorts/pilot.ts`, aja `npm run publish:pilot-counts` ja varmista API:n palauttamat arvot. Yli 6 tuntia vanhaa `fresh`-snapshotia ei julkaista tuoreena.
- `npm run collect:pilot` suorittaa live-sääkeruun ja tietokantaan tallennuksen. Se vaatii `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` ja server-only `SUPABASE_SERVICE_ROLE_KEY` -ympäristömuuttujat. Kymmenen kohteen tyypillinen ajo käyttää 10 provider-pyyntöä; todellinen määrä tallentuu ajon yhteyteen.
- Keräys on tarkoituksella erillinen ajettava toiminto: ajastinta tai selainkäynnisteistä keräystä ei ole tässä vaiheessa.

## Staging-varmennus

Supabase staging -projektiin `ugeoxrfagumamxyhqnjw` on sovellettu kaikki yhdeksän migraatiota. Viimeinen versio on `20261012151355` (`allow_stale_pilot_status`); vastaava paikallinen tiedosto alkaa samalla versiolla. Read-back vahvisti, että `pilot_resorts_status_state_check` sallii tilat `fresh`, `partial`, `stale`, `scheduled` ja `unavailable`, 10 resort-riviä säilyi ja `get_pilot_product()` palauttaa 10 resortia. Nykyiset tilamäärät: 7 `fresh`, 2 `partial`, 1 `unavailable`; migraatio ei muuttanut rivien dataa. `get_pilot_product()` toimii `anon`-roolissa, mutta suora `SELECT` `pilot_resorts`-tauluun on estetty.

Live-sääajon ja tietokannan read-backin tulos:

- ajo `0ff2edf7-9f76-4af7-93af-7af6e0b16d2a`, 2026-10-12 13:03:20.385–13:03:21.269 UTC;
- 10/10 keskusta onnistui, 0 virhettä ja 0 stale-tulosta;
- 10 provider-pyyntöä: FMI 6, SMHI 2, MET Norway 2; mitattu summa 866 ms;
- tietokannassa on 10 keskusriviä ja `weather_current`; kerääjä tallentaa enintään 48 aikajärjestyksessä olevaa ennustepistettä per keskus, ja RPC palauttaa tallennetun listan;
- käyttöliittymä näyttää neljä ensimmäistä ennustepistettä; `current` osoittaa lähimmän validiajan. Keräysajon lokissa `forecastPointsParsed` erotetaan enintään 48 pisteeseen rajatusta `forecastPointsStored`-määrästä.

Erillinen status-read-back: seitsemän resorttia on `fresh`, kaksi `partial` ja yksi `unavailable`. Iso-Syötteen avoimet hissi-/rinneluvut ovat `null`; Riksgränseniltä puuttuvat avoimet luvut ja rinnekokonaismäärä; Ylläksen operaattorilaskurit ovat `null`, vaikka inventaariossa on LIPAS-luvut. Käyttöliittymä säilyttää nämä tuntemattomina eikä esitä niitä nollina. Siksi säädata on kattava 10/10, mutta hissi-/rinne-statuksen numeerinen kattavuus ei ole 10/10.

Staging-HTTP-tarkistuksessa `GET /api/pilot` palautti 10 keskusta ja SSR-HTML sisälsi kaikkien 10 keskuksen kortit. Uusi paikallinen reittismoke varmisti `/` → `/en`-ohjauksen sekä 200-vastaukset ja oikeat `<html lang>`-arvot kaikilla neljällä kielireitillä. Tässä työympäristössä ei ole Supabase-ympäristömuuttujia, joten nykyinen sivu näyttää hallitun tietokannan 503-tilan eikä staging-dataa.

## Rajaukset ja avoimet käytännön vaatimukset

- Lumensyvyys ja 24 tunnin havaittu lumisade pysyvät `null`-arvoina, ja käyttöliittymä näyttää `—`. Nykyinen live-ennustedata ei sisällä luotettavaa havaintoa näihin kenttiin. Nollaa ei päätellä puuttuvasta arvosta eikä näitä lukuja oteta keskusten muilta sivuilta.
- Tämän työympäristön `SUPABASE_*`-kirjoitusavaimia ei ole asetettu. Live-provider-ajo ja staging-tietokannan read-back varmennettiin erikseen Supabase-yhteyden kautta; `weather-writer`- ja `status-writer`-kirjoituspolut on katettu testein. `npm run collect:pilot` ja `npm run publish:pilot-counts` voidaan ajaa paikallisesti, kun staging-ympäristömuuttujat on asetettu.
- Tuotantodeploy, ajastus ja kaupallisten datalisenssien hyväksyntä eivät kuulu tähän viipaleeseen. Lähde- ja lisenssistatukset pysyvät dokumentoidun politiikan mukaisina; tässä toteutus ei oikeuta laajempaa sivustokaavintaa.

## Varmennuskomennot

```sh
npm run check
npm run test:adapters
npm run test:api
npm run test:security
npm run build
npm run format:check
```
