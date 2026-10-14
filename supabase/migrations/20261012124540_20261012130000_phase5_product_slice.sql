BEGIN;

-- Public read model: typed numeric status fields, normalized weather and source links only.
CREATE TABLE public.pilot_resorts (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  display_name text NOT NULL,
  country_code char(2) NOT NULL CHECK (country_code IN ('FI','SE','NO')),
  region_name text NOT NULL,
  resort_size text NOT NULL CHECK (resort_size IN ('small','medium','large')),
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  location_source_url text NOT NULL CHECK (location_source_url ~* '^https?://'),
  location_attribution text NOT NULL,

  inventory_lifts integer CHECK (inventory_lifts IS NULL OR inventory_lifts BETWEEN 0 AND 200),
  inventory_pistes integer CHECK (inventory_pistes IS NULL OR inventory_pistes BETWEEN 0 AND 500),
  inventory_source_url text NOT NULL CHECK (inventory_source_url ~* '^https?://'),
  inventory_attribution text NOT NULL,

  status_open_lifts integer CHECK (status_open_lifts IS NULL OR status_open_lifts BETWEEN 0 AND 200),
  status_total_lifts integer CHECK (status_total_lifts IS NULL OR status_total_lifts BETWEEN 0 AND 200),
  status_open_pistes integer CHECK (status_open_pistes IS NULL OR status_open_pistes BETWEEN 0 AND 500),
  status_total_pistes integer CHECK (status_total_pistes IS NULL OR status_total_pistes BETWEEN 0 AND 500),
  status_state text NOT NULL CHECK (status_state IN ('fresh','partial','unavailable')),
  status_checked_at timestamptz,
  status_source_url text NOT NULL CHECK (status_source_url ~* '^https?://'),
  status_attribution text NOT NULL,
  status_display_approved boolean NOT NULL DEFAULT false,
  status_approval_basis text NOT NULL DEFAULT 'explicit_user_scope_only_count_fields'
    CHECK (status_approval_basis = 'explicit_user_scope_only_count_fields'),

  weather_provider text NOT NULL CHECK (weather_provider IN ('fmi','smhi','met-no')),
  weather_source_url text NOT NULL CHECK (weather_source_url ~* '^https?://'),
  weather_attribution text NOT NULL,
  weather_display_approved boolean NOT NULL DEFAULT false,
  weather_fetched_at timestamptz,
  weather_source_updated_at timestamptz,
  weather_freshness text NOT NULL DEFAULT 'unavailable' CHECK (weather_freshness IN ('fresh','stale','unavailable')),
  weather_current jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(weather_current) = 'object'),
  forecast_points jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(forecast_points) = 'array'),
  snow_depth_cm numeric CHECK (snow_depth_cm IS NULL OR snow_depth_cm BETWEEN 0 AND 2000),
  recent_snowfall_24h_cm numeric CHECK (recent_snowfall_24h_cm IS NULL OR recent_snowfall_24h_cm BETWEEN 0 AND 500),
  snow_observed_at timestamptz,
  snow_source_url text CHECK (snow_source_url IS NULL OR snow_source_url ~* '^https?://'),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CHECK (status_open_lifts IS NULL OR (status_total_lifts IS NOT NULL AND status_open_lifts <= status_total_lifts)),
  CHECK (status_open_pistes IS NULL OR (status_total_pistes IS NOT NULL AND status_open_pistes <= status_total_pistes)),
  CHECK (status_state <> 'fresh' OR (status_checked_at IS NOT NULL AND status_display_approved)),
  CHECK (NOT weather_display_approved OR length(btrim(weather_attribution)) > 0)
);

COMMENT ON COLUMN public.pilot_resorts.status_display_approved IS
  'Owner authorization applies only to open/total lift and piste counts; it is not blanket permission for other resort-page content.';
COMMENT ON COLUMN public.pilot_resorts.status_checked_at IS
  'Local manual capture time, not a timestamp copied from the resort page.';

CREATE TABLE public.pilot_collection_runs (
  run_id uuid PRIMARY KEY,
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('success','partial','failed')),
  resorts_attempted integer NOT NULL CHECK (resorts_attempted BETWEEN 0 AND 10),
  resorts_succeeded integer NOT NULL CHECK (resorts_succeeded BETWEEN 0 AND resorts_attempted),
  resorts_failed integer NOT NULL CHECK (resorts_failed BETWEEN 0 AND resorts_attempted),
  resorts_stale integer NOT NULL CHECK (resorts_stale BETWEEN 0 AND resorts_attempted),
  total_provider_requests integer NOT NULL CHECK (total_provider_requests >= 0),
  provider_requests_by_provider jsonb NOT NULL CHECK (jsonb_typeof(provider_requests_by_provider) = 'object'),
  total_latency_ms bigint NOT NULL CHECK (total_latency_ms >= 0),
  result_summary jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(result_summary) = 'array'),
  CHECK (completed_at >= started_at),
  CHECK (resorts_succeeded + resorts_failed = resorts_attempted)
);
CREATE INDEX pilot_collection_runs_completed_idx ON public.pilot_collection_runs(completed_at DESC);

ALTER TABLE public.pilot_resorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_collection_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY pilot_resorts_public_read ON public.pilot_resorts
  FOR SELECT TO anon, authenticated
  USING (status_display_approved AND weather_display_approved);

GRANT SELECT ON public.pilot_resorts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pilot_resorts TO service_role;
GRANT SELECT, INSERT ON public.pilot_collection_runs TO service_role;
REVOKE ALL ON public.pilot_collection_runs FROM anon, authenticated;

INSERT INTO public.pilot_resorts (
  slug, display_name, country_code, region_name, resort_size, latitude, longitude,
  location_source_url, location_attribution,
  inventory_lifts, inventory_pistes, inventory_source_url, inventory_attribution,
  status_open_lifts, status_total_lifts, status_open_pistes, status_total_pistes,
  status_state, status_checked_at, status_source_url, status_attribution,
  status_display_approved, weather_provider, weather_source_url, weather_attribution,
  weather_display_approved
) VALUES
('yllas','Ylläs','FI','Kolari, Lapland','large',67.551,24.2573,
 'https://api.lipas.fi/v2/sports-sites?type-codes=4110&page-size=100&page=1','LIPAS, CC BY 4.0',
 26,63,'https://api.lipas.fi/v2/sports-sites?type-codes=4110&page-size=100&page=1','LIPAS, CC BY 4.0',
 NULL,NULL,NULL,NULL,'unavailable','2026-10-12T11:29:27Z','https://ski.yllas.fi/en/slopes-and-lifts/opening-hours/','Ylläs official count page; numeric counts only',
 true,'fmi','https://en.ilmatieteenlaitos.fi/open-data-manual-fmi-wfs-services','FMI, CC BY 4.0',true),
('levi','Levi','FI','Kittilä, Lapland','large',67.8038,24.8088,
 'https://api.lipas.fi/v2/sports-sites?type-codes=4110&page-size=100&page=1','LIPAS, CC BY 4.0',
 28,44,'https://www.levi.fi/en/ski/ski-resort-today/','Levi official count page; numeric totals only',
 3,28,3,44,'fresh','2026-10-12T11:29:27Z','https://www.levi.fi/en/ski/ski-resort-today/','Levi official count page; four numeric counts only',
 true,'fmi','https://en.ilmatieteenlaitos.fi/open-data-manual-fmi-wfs-services','FMI, CC BY 4.0',true),
('ruka','Ruka','FI','Kuusamo, North Ostrobothnia','large',66.1652,29.1514,
 'https://api.lipas.fi/v2/sports-sites?type-codes=4110&page-size=100&page=1','LIPAS, CC BY 4.0',
 22,41,'https://www.ruka.fi/en/skiresort/slopes','Ruka official count page; numeric totals only',
 3,22,3,41,'fresh','2026-10-12T11:29:27Z','https://www.ruka.fi/en/skiresort/slopes','Ruka official count page; four numeric counts only',
 true,'fmi','https://en.ilmatieteenlaitos.fi/open-data-manual-fmi-wfs-services','FMI, CC BY 4.0',true),
('himos','Himos','FI','Jämsä, Central Finland','medium',61.8792,25.2994,
 'https://api.lipas.fi/v2/sports-sites?type-codes=4110&page-size=100&page=1','LIPAS, CC BY 4.0',
 17,26,'https://himos.fi/en/skiing/slope-info/','Himos official count page; numeric totals only',
 0,17,0,26,'fresh','2026-10-12T11:29:27Z','https://himos.fi/en/skiing/slope-info/','Himos official count page; four numeric counts only',
 true,'fmi','https://en.ilmatieteenlaitos.fi/open-data-manual-fmi-wfs-services','FMI, CC BY 4.0',true),
('tahko','Tahko','FI','Kuopio, North Savo','medium',63.292,28.0255,
 'https://api.lipas.fi/v2/sports-sites?type-codes=4110&page-size=100&page=1','LIPAS, CC BY 4.0',
 14,25,'https://www.tahko.com/en/things-to-do/activities/skiing-and-snowboarding/','Tahko official count page; numeric totals only',
 0,15,0,25,'fresh','2026-10-12T11:29:27Z','https://www.tahko.com/en/things-to-do/activities/skiing-and-snowboarding/','Tahko official count page; four numeric counts only',
 true,'fmi','https://en.ilmatieteenlaitos.fi/open-data-manual-fmi-wfs-services','FMI, CC BY 4.0',true),
('iso-syote','Iso-Syöte','FI','Pudasjärvi, North Ostrobothnia','small',65.6248,27.6292,
 'https://api.lipas.fi/v2/sports-sites?type-codes=4110&page-size=100&page=1','LIPAS, CC BY 4.0',
 9,18,'https://www.isosyote.fi/en/slopes-and-lifts','Iso-Syöte official count page; numeric totals only',
 NULL,9,NULL,18,'partial','2026-10-12T11:29:27Z','https://www.isosyote.fi/en/slopes-and-lifts','Iso-Syöte official count page; numeric totals only',
 true,'fmi','https://en.ilmatieteenlaitos.fi/open-data-manual-fmi-wfs-services','FMI, CC BY 4.0',true),
('are','Åre','SE','Åre, Jämtland','medium',63.415,13.062,
 'https://www.openstreetmap.org/copyright','© OpenStreetMap contributors, ODbL',
 47,89,'https://www.skistar.com/en/ski-destinations/are/winter-in-are/','SkiStar official count page; numeric totals only',
 0,16,0,39,'fresh','2026-10-12T11:29:27Z','https://www.skistar.com/en/ski-destinations/are/winter-in-are/weather-and-slopes/','SkiStar official count page; four numeric counts only',
 true,'smhi','https://opendata.smhi.se/metfcst/snow1gv1','SMHI, CC BY 4.0',true),
('riksgransen','Riksgränsen','SE','Kiruna, Norrbotten','medium',68.4278,18.1222,
 'https://www.openstreetmap.org/copyright','© OpenStreetMap contributors, ODbL',
 6,NULL,'https://riksgransen.se/en/snow-report-mountain-status/','Riksgränsen official count page; lift total only',
 NULL,6,NULL,NULL,'partial','2026-10-12T11:29:27Z','https://riksgransen.se/en/snow-report-mountain-status/','Riksgränsen official count page; numeric counts only',
 true,'smhi','https://opendata.smhi.se/metfcst/snow1gv1','SMHI, CC BY 4.0',true),
('trysil','Trysil','NO','Trysil, Innlandet','large',61.31,12.315,
 'https://www.openstreetmap.org/copyright','© OpenStreetMap contributors, ODbL',
 41,69,'https://www.skistar.com/en/ski-destinations/trysil/winter-in-trysil/ski-area/','SkiStar official count page; numeric totals only',
 0,15,0,23,'fresh','2026-10-12T11:29:27Z','https://www.skistar.com/en/ski-destinations/trysil/winter-in-trysil/weather-and-slopes/','SkiStar official count page; four numeric counts only',
 true,'met-no','https://api.met.no/weatherapi/locationforecast/2.0/documentation','MET Norway, CC BY 4.0',true),
('hemsedal','Hemsedal','NO','Hemsedal, Buskerud','large',60.9058,8.5147,
 'https://www.openstreetmap.org/copyright','© OpenStreetMap contributors, ODbL',
 22,47,'https://www.skistar.com/en/ski-destinations/hemsedal/winter-in-hemsedal/weather-and-slopes/','SkiStar official count page; numeric totals only',
 0,22,0,47,'fresh','2026-10-12T11:29:27Z','https://www.skistar.com/en/ski-destinations/hemsedal/winter-in-hemsedal/weather-and-slopes/','SkiStar official count page; four numeric counts only',
 true,'met-no','https://api.met.no/weatherapi/locationforecast/2.0/documentation','MET Norway, CC BY 4.0',true);

COMMIT;
