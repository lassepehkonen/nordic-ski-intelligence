# Vaihe 7 — Monikielinen tuotekäyttöliittymä

- **Tila:** Toteutettu ja varmennettu Deploy Preview'ssa (fi, en, sv, no)
- **Päiväys:** 2026-10-12
- **Haara / PR:** `feat/phase-7-product-ui-i18n` / PR #6
- **Vaiheen rajaus:** asiakastuote neljällä kielellä. Ei live-lähteitä, ei kerääjiä, ei tuotanto-Supabasea.

## Tavoite

Rakentaa asiakkaalle näkyvä tuote: karttavetoinen etusivu, kohdesivu ja vertailu — täysin käytettävänä
suomeksi, englanniksi, ruotsiksi ja norjaksi. Yksi sovellus, ei neljää.

## Kielireititys (ADR-0007)

| Asia                 | Toteutus                                                                                                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reitit               | Jokainen kieli omalla etuliitteellä: `/fi`, `/en`, `/sv`, `/no`. Etuliitteetön juuri on kielentunnistuksen sisääntulo, joka ohjaa 308:lla ratkaistuun kieleen eikä ole indeksoitava.      |
| Polut komponenteissa | Sivukomponentit eivät sisällä kielisegmenttiä. `reroute`-hook (src/hooks.ts) kirjoittaa `/fi/resort/levi` → `/resort/levi`, ja linkit rakennetaan `#lib/i18n/ui`-apureilla.               |
| Kielen ratkaisu      | `paraglideMiddleware` (src/hooks.server.ts) URL-etuliite → `Accept-Language` → oletuskieli. `%lang%`/`%dir%` korvataan `app.html`:ssa.                                                    |
| Kielenvaihtaja       | Säilyttää nykyisen sivun ja kyselyparametrit (myös suodattimet) ja merkitsee nykyisen kielen `aria-current`:lla.                                                                          |
| Fallback             | Puuttuva viesti putoaa englantiin kehityksen aikana. Se ei ole sisältöpoikkeus: kielten avainpariteetti ja placeholdereiden yhtenevyys testataan (`tests/domain/i18n-catalog.spec.ts`).   |
| Metadata             | Jokaisella sivulla lokalisoitu `title`, `description`, itseen viittaava `canonical`, `hreflang` kaikille neljälle kielelle sekä `x-default` (en), Open Graph ja `og:locale:alternate`.    |
| Sitemap ja robots    | `sitemap.xml` listaa jokaisen sivun kaikilla kielillä `xhtml:link`-vaihtoehdoin; `robots.txt` on dynaaminen ja osoittaa sitemapiin. Molemmat on suljettu locale-middlewaren ulkopuolelle. |
| Strukturoitu data    | Kohdesivulla schema.org `SkiResort` (nimi, maa, koordinaatit, virallinen sivusto).                                                                                                        |

Viestikatalogi: 200 avainta × 4 kieltä (`messages/{fi,en,sv,no}.json`), käännetty käsin, ei
konekäännöspohjaa.

## Sivut

**Etusivu (`/{kieli}`)** — karttavetoinen: Leaflet-kartta (vaalea tumma-taustakartta
`prefers-color-scheme`-asetuksen mukaan, hillitty CARTO-pohja + OSM-attribuutio), kohdemerkinnät
olosuhdepistein, suodattimet (maa, olosuhdepisteet, uusi lumi 24 h, avoimien rinteiden osuus),
hakukenttä, lajittelu sekä nostot "parhaat olosuhteet" ja "uusi lumi" ja koko kohdelista.
Suodattimet elävät URL-kyselyparametreissa: ne toimivat ilman JavaScriptiä (`method="get"`),
jakautuvat linkkeinä ja päivittyvät selain-JS:llä ilman koko sivun latausta (haku viivästettynä).

**Kohdesivu (`/{kieli}/resort/{slug}`)** — nykyiset olosuhteet (piste, tuoreustila, viimeksi
päivitetty, havaintoasema, kattavuus), olosuhdepisteiden erittely syötekohtaisesti, lumi
(syvyys, uusi lumi 24 h / 72 h, ennustelumi, lumen laatu), hissit, rinteet, sää, viiden päivän
ennuste, arvosana painotuksineen, faktat (korkeus, pudotus, rinteet, rinne-km, hissit, alue, maa,
koordinaatit) sekä lähteet ja niiden tila.

**Vertailu (`/{kieli}/compare?resorts=…`)** — 2–3 kohdetta rinnakkain: olosuhteet, arvosana, sää ja
ennuste, maasto. Paras arvo per rivi merkitään, ja tuulen kaltaisilla riveillä "parempi" on
pienempi arvo. Valinta tehdään ilman JavaScriptiä toimivalla lomakkeella; enimmäismäärä on kolme.

**Virhesivu (`+error.svelte`)** — lokalisoitu, `noindex`.

## Data ja rehellisyys

- **Conditions Score v1** on versioitu ja konfiguroitava (`src/lib/domain/scoring/config.ts`):
  painot, normalisointikäyrät ja kattavuusrajat. Puuttuva syöte ei ole nolla vaan laskee
  kattavuutta; alle 50 % kattavuudella numeerista pistettä ei julkaista ja alle 80 %:lla piste
  merkitään osittaiseksi (ADR-0009).
- **Resort Rating** on rakenteellisesti erillään olosuhdepisteistä, omalla 0–10-asteikollaan ja
  painotuksillaan. Käyttöliittymä kertoo, että arvot ovat preview-arvoja.
- **Tuoreus** johdetaan lukuhetkellä validointitilasta ja voimassaolosta: `fresh`, `stale`,
  `unknown`, `invalid`. Vanhentunut havainto ei muutu tuoreeksi eikä katoa näkyvistä.
- **Kymmenen kohdetta** (4 × FI, 3 × SE, 3 × NO): identiteetti, koordinaatit ja ilmoitetut
  rinne-/hissiluvut on lähteistetty. Jokainen arvo kantaa lähdeviitteen ja luotettavuusluokan
  (`reference` / `operator-claim` / `unverified`); lähteetön arvo on `null`, ei arvaus. Esimerkki
  ristiriidasta, joka näytetään eikä siivota: Åren rinnemäärä on operaattoritaulukossa 89 ja
  englanninkielisessä artikkelissa 112 — molemmat on kirjattu.
- **Olosuhde-, sää- ja ennustearvot ovat kuvitteellista sample-dataa** (`dataState: 'illustrative'`,
  lähde `sample-conditions`). Ne on merkitty käyttöliittymässä sekä lyhyellä että pitkällä
  huomautuksella, eikä niitä saa käyttää turvallisuuspäätöksiin. Live-lähteet odottavat
  lähdeoikeuksien hyväksyntää (ADR-0008).
- **Lähdenäkymä** kertoo jokaisesta lähteestä tyypin, tilan (hyväksytty / odottaa hyväksyntää /
  havainnollinen), lisenssin ja varmennuspäivän; yksikään lähde ei ole tässä vaiheessa
  `approved`-tilassa.

## Suunnittelu

Moderni pohjoismainen ulkoilmaestetiikka: lumen ja kiven sävyt, kuusen vihreä aksentti,
yhden asteikon typografia taulukkonumeroilla, hillitty karttapohja ja selkeä hierarkia.
Suunnittelutokenit ovat CSS-muuttujia, ja tumma teema on tokenien ohitus
(`prefers-color-scheme`), ei toinen tyylitiedosto. Mobiilikäyttö edellä: yhden palstan asettelu,
kosketusystävälliset kohteet, vaakasuunnassa vieritettävä ennuste, kartta täydellä leveydellä.
Liikkumisen vähentämisen asetus huomioidaan, samoin näppäimistöfokus ja "siirry sisältöön" -linkki.

## Portit

Kaikki ajettu vihreänä ennen PR:ää: `npm run format:check`, `npm run lint`, `npm run check`
(0 virhettä), `npm test` (69 testiä: domain, scoring, adapters, api, security) ja `npm run build`.

Testit kattavat muun muassa: painojen summautuminen 1:een, pisteiden rajaluokat, puuttuvien
syötteiden vaikutus kattavuuteen (ei nollana), kattavuusrajan alle jäävän pisteen piilottaminen,
hylättyjen havaintojen invalid-tila, vanhentumisen välittyminen, avoin/suljettu-suhdelukujen
johtaminen, suodattimet ja lajittelu (myös diakriitit ja kielikohtainen aakkostus),
vertailun "paras rivi" -logiikka molempiin suuntiin, katalogien avain- ja placeholder-pariteetti
sekä sample-adapterin deterministisyys ja merkinnät.

## Julkaisu ja varmennus

Tuotantoon ei ole julkaistu tässä vaiheessa: Netlifyn tuotantojulkaisu on rajattu `main`-haaran
Git-julkaisuun. Lopputulos on varmennettu PR #6:n Deploy Preview'ssa kaikilla neljällä kielellä:
kielireititys ja uudelleenohjaus, lokalisoitu metadata ja hreflang, kohdesivun JSON-LD, vertailun
taulukko, sitemap ja robots sekä 404-sivun lokalisointi. Varmennus on tehty pyyntöinä preview-
osoitteeseen (HTTP-tulokset ja HTML-sisältö) sekä selainajona kartan ja suodattimien osalta.

## Rajat ja seuraavat askeleet

- **Live-data puuttuu tarkoituksella.** Kerääjät, lähdeoikeudet ja tuoreusputki ovat oma vaiheensa;
  käyttöliittymä lukee dataa yhdestä repositoriokerroksesta (`src/lib/data/repository.ts`), joten
  live-lähteiden vaihtaminen ei muuta sivuja.
- **Kausitiedot puuttuvat.** `season`-kenttä on olemassa mutta arvot ovat `null`; rivi jätetään
  näyttämättä, kunnes lähde on hyväksytty.
- **Karttatiilet** tulevat CARTO:n julkisesta pohjakarttapalvelusta OSM-attribuutiolla. Tuotantoon
  tarvitaan oma tai lisensoitu tiilipalvelu ja käyttöbudjetti (ks. ADR-0005 ja
  [data-cost-model.md](../data-cost-model.md)).
- **Arvosanan editorial-prosessi** (omistajuus, kalibrointi, päivitysrytmi) on yhä avoin
  tuotepäätös; nyt näytettävät arvot ovat preview-arvoja.
- **Käännösten ylläpito:** katalogit ovat käsin kirjoitettuja ja testattu pariteetiltaan, mutta
  kielikohtainen katselmointi (erityisesti norja ja ruotsi) on syytä tehdä ennen julkista
  julkaisua.
