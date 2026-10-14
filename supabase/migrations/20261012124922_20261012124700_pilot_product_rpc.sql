BEGIN;

CREATE OR REPLACE FUNCTION public.get_pilot_product()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'resorts', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'slug', r.slug,
          'name', r.display_name,
          'countryCode', r.country_code,
          'region', r.region_name,
          'size', r.resort_size,
          'location', jsonb_build_object(
            'latitude', r.latitude,
            'longitude', r.longitude,
            'sourceUrl', r.location_source_url,
            'attribution', r.location_attribution
          ),
          'inventory', jsonb_build_object(
            'lifts', r.inventory_lifts,
            'pistes', r.inventory_pistes,
            'sourceUrl', r.inventory_source_url,
            'attribution', r.inventory_attribution
          ),
          'status', jsonb_build_object(
            'lifts', jsonb_build_object('open', r.status_open_lifts, 'total', r.status_total_lifts),
            'pistes', jsonb_build_object('open', r.status_open_pistes, 'total', r.status_total_pistes),
            'freshness', CASE
              WHEN r.status_state = 'unavailable' OR r.status_checked_at IS NULL THEN 'unavailable'
              WHEN r.status_checked_at > now() + interval '5 minutes' THEN 'unavailable'
              WHEN r.status_checked_at <= now() - interval '6 hours' THEN 'stale'
              ELSE r.status_state
            END,
            'checkedAt', r.status_checked_at,
            'sourceUrl', r.status_source_url,
            'attribution', r.status_attribution
          ),
          'weather', jsonb_build_object(
            'provider', r.weather_provider,
            'sourceUrl', r.weather_source_url,
            'attribution', r.weather_attribution,
            'freshness', CASE
              WHEN r.weather_fetched_at IS NULL THEN 'unavailable'
              WHEN r.weather_fetched_at <= now() - interval '6 hours' THEN 'stale'
              ELSE r.weather_freshness
            END,
            'fetchedAt', r.weather_fetched_at,
            'sourceUpdatedAt', r.weather_source_updated_at,
            'current', NULLIF(r.weather_current, '{}'::jsonb),
            'forecast', r.forecast_points,
            'snow', jsonb_build_object(
              'depthCm', r.snow_depth_cm,
              'recentSnowfall24hCm', r.recent_snowfall_24h_cm,
              'observedAt', r.snow_observed_at,
              'sourceUrl', r.snow_source_url
            )
          )
        ) ORDER BY r.country_code, r.display_name
      ),
      '[]'::jsonb
    ),
    'lastCollectionRun', (
      SELECT jsonb_build_object(
        'completedAt', c.completed_at,
        'outcome', c.outcome,
        'totalProviderRequests', c.total_provider_requests,
        'providerRequestsByProvider', c.provider_requests_by_provider,
        'resortsAttempted', c.resorts_attempted,
        'resortsSucceeded', c.resorts_succeeded,
        'resortsFailed', c.resorts_failed,
        'resortsStale', c.resorts_stale
      )
      FROM public.pilot_collection_runs AS c
      ORDER BY c.completed_at DESC
      LIMIT 1
    )
  )
  FROM public.pilot_resorts AS r
  WHERE r.status_display_approved AND r.weather_display_approved;
$$;

REVOKE ALL ON FUNCTION public.get_pilot_product() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pilot_product() TO anon, authenticated;

COMMIT;
