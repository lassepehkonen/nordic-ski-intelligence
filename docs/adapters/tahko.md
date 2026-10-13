# Tahko adapter

- Slug/country: `tahko` / FI
- Operator count URL: https://www.tahko.com/en/things-to-do/activities/skiing-and-snowboarding/
- Inventory total: 14 lifts; 25 pistes. Status-board snapshot at `2026-10-12T11:29:27Z`: lifts open/total `0/15`; pistes open/total `0/25`.
- The two displayed lift totals differ; preserve both count records with their source scope, do not silently reconcile them.
- Weather: FMI WFS deterministic forecast adapter; source documentation: https://en.ilmatieteenlaitos.fi/open-data-manual-fmi-wfs-services
- Operator-page input is limited to the four count fields. No other page content is collected.
