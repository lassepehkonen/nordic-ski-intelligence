# Phase 5 pilot adapters

The pilot is configuration-driven across ten resorts. The common product schema is `src/lib/server/resorts/pilot.ts`; the frontend receives the same DTO for every resort.

## Resort-page boundary

The product owner authorized only four numeric values from resort pages: total lifts, open lifts, total pistes and open pistes. Enter those values manually from the linked status/count view. Keep only the source URL and our local `fetchedAt`; do not collect page timestamps, text, opening schedules, weather, snow reports, maps, prices, HTML, embedded payloads or any other page field. Do not automate resort-page requests, parse the DOM, or use AI extraction. Unknown remains `null`; never infer zero from an absent counter. Manual status expires after six hours and is then displayed as stale/unavailable.

The Finnish inventory totals may instead come from the LIPAS open dataset; those rows cite LIPAS separately. Operator-page open/total snapshots are not mixed with non-count page details.

## Weather source boundary

Weather and forecast data come from documented national APIs, not resort pages: FMI for Finland, SMHI for Sweden and MET Norway for Norway. Parsers are deterministic and fixture-tested. A full pilot run makes one request per resort (six FMI, two SMHI, two MET Norway); these requests happen only in the server-side collector, never per browser view. Snow/station measurements remain `null` unless an approved documented source actually returns them.

## Resort adapters

- [Ylläs](yllas.md)
- [Levi](levi.md)
- [Ruka](ruka.md)
- [Himos](himos.md)
- [Tahko](tahko.md)
- [Iso-Syöte](iso-syote.md)
- [Åre](are.md)
- [Riksgränsen](riksgransen.md)
- [Trysil](trysil.md)
- [Hemsedal](hemsedal.md)

Add resort #11 by adding its catalog record, count-source reference and this adapter note. The common UI and API remain unchanged.
