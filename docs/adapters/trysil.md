# Trysil adapter

- Slug/country: `trysil` / NO
- Operator status-count URL: https://www.skistar.com/en/ski-destinations/trysil/winter-in-trysil/weather-and-slopes/
- Inventory totals (from https://www.skistar.com/en/ski-destinations/trysil/winter-in-trysil/ski-area/): 41 lifts; 69 pistes. Captured status-board scope at `2026-10-12T11:29:27Z`: lifts open/total `0/15`; pistes open/total `0/23`.
- Keep resort inventory and status-board denominators separate; do not synthesize a single total.
- Weather: MET Norway Locationforecast deterministic adapter; documentation: https://api.met.no/weatherapi/locationforecast/2.0/documentation
- Operator-page input is limited to the four count fields. No other page content is collected.
