# data/

Reference data snapshots used by the preview dataset and future collector development.

- `openskidata-ski-areas.csv` — OpenSkiData ski-areas CSV snapshot, downloaded 13 October 2026
  (build OSM timestamp 2026-10-12). Contains all ten pilot resorts. Source:
  <https://tiles.openskimap.org/csv/ski_areas.csv>, served by <https://openskidata.org/>.

  **Licence:** ODbL — the data derive from OpenStreetMap and other sources. Required
  attribution: `Data from OpenSkiData / OpenSkiMap.org, © OpenStreetMap contributors (ODbL),
  Skimap.org, Who's On First, © Mapterhorn`. Automated downloads at most once per day; hosted
  vector tiles at `tiles.openskimap.org` may not be consumed directly. Feature IDs are content
  hashes (unstable across builds) — join on the OSM or Skimap.org source URLs in the `sources`
  column, or Wikidata where present.

  Caveats verified against the snapshot: statistics are uneven (several Ylläs features carry
  empty statistics), nordic flags depend on OSM tagging, and resort counts differ from operator
  figures. Use for discovery/geometry, not as the published totals.