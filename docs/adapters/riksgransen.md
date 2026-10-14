# Riksgränsen adapter

- Slug/country: `riksgransen` / SE
- Operator count URL: https://riksgransen.se/en/snow-report-mountain-status/
- Captured lift total: 6. Current open lifts, piste total and open pistes are `null` in the pilot snapshot; freshness is unavailable.
- Do not reuse older values or infer an open count when a current numeric counter is unavailable.
- Weather: SMHI SNOW v1 deterministic forecast adapter; documentation: https://opendata.smhi.se/metfcst/snow1gv1
- Operator-page input is limited to the four count fields. No other page content is collected.
