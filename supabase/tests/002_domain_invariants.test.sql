BEGIN;
SELECT plan(14);

INSERT INTO app.sources (id, slug, owner_name, source_kind, home_url)
VALUES ('00000000-0000-0000-0000-000000000001', 'test-manual', 'Test source', 'manual', 'https://example.invalid/');
INSERT INTO app.source_approvals (
  id, source_id, data_scope, status, access_method, permitted_fields,
  collection_allowed, normalized_storage_allowed, normalized_retention_days,
  raw_storage_allowed, raw_retention_days, commercial_display_allowed, derived_use_allowed,
  attribution_text, terms_url, terms_version, reviewed_at
) VALUES (
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000001',
  'resort_facts', 'approved', 'manual', ARRAY['resort_name', 'map_geometry', 'snow_depth'],
  true, true, 30, false, NULL, true, true,
  'Test source', 'https://example.invalid/terms', 'test-1', now()
);
INSERT INTO app.source_references (id, source_id, approval_id, field_key, source_url, accessed_at) VALUES
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'resort_name', 'https://example.invalid/resort', now()),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'map_geometry', 'https://example.invalid/map', now()),
  ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'snow_depth', 'https://example.invalid/snow', now());
INSERT INTO app.locations (id, slug, name, country_code, point)
VALUES ('00000000-0000-0000-0000-000000000031', 'test-location', 'Test location', 'FI', extensions.ST_SetSRID(extensions.ST_MakePoint(24.9, 60.2), 4326)::extensions.geography);
INSERT INTO app.resorts (id, slug, official_name, location_id, source_id, approval_id, primary_source_reference_id)
VALUES ('00000000-0000-0000-0000-000000000041', 'test-resort', 'Test Resort', '00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000021');
INSERT INTO app.resort_translations (resort_id, locale, name, translation_state)
VALUES ('00000000-0000-0000-0000-000000000041', 'fi', 'Testikeskus', 'published');
INSERT INTO app.map_features (id, resort_id, feature_kind, geometry, source_id, approval_id, source_reference_id, validation_state)
VALUES ('00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000041', 'resort_boundary', extensions.ST_GeomFromText('POLYGON((24.8 60.1,25.0 60.1,25.0 60.3,24.8 60.3,24.8 60.1))', 4326), '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000022', 'validated');
INSERT INTO app.source_observations (
  id, source_id, approval_id, source_reference_id, field_key, source_observed_at,
  fetched_at, valid_until, retention_expires_at, confidence_level, validation_state
) VALUES
  ('00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000023', 'snow_depth', now() - interval '2 hours', now(), now() - interval '1 hour', now() + interval '7 days', 'medium', 'validated'),
  ('00000000-0000-0000-0000-000000000062', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000023', 'snow_depth', now() - interval '2 hours', now(), now() - interval '1 hour', now() + interval '7 days', 'medium', 'validated'),
  ('00000000-0000-0000-0000-000000000063', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000023', 'snow_depth', now() - interval '2 hours', now(), now() - interval '1 hour', now() + interval '7 days', 'medium', 'validated');
INSERT INTO app.condition_score_versions (version_key, description, parameters)
VALUES ('test-v1', 'test score version', '{}'::jsonb);

SELECT is((SELECT count(*)::integer FROM app.resort_translations WHERE resort_id = '00000000-0000-0000-0000-000000000041'), 1, 'translation is stored independently of resort identity');
SELECT is(extensions.ST_SRID((SELECT geometry FROM app.map_features WHERE id = '00000000-0000-0000-0000-000000000051')), 4326, 'map geometry uses WGS84 SRID');
SELECT ok(extensions.ST_IsValid((SELECT geometry FROM app.map_features WHERE id = '00000000-0000-0000-0000-000000000051')), 'map geometry is valid');
SELECT throws_ok($$INSERT INTO app.resort_translations (resort_id, locale, name, translation_state) VALUES ('00000000-0000-0000-0000-000000000041', 'fi', 'Duplicate', 'published')$$, '23505', NULL, 'locale is unique per resort');
SELECT throws_ok($$INSERT INTO app.locations (slug, name, country_code, point) VALUES ('bad-country', 'Bad', 'DK', extensions.ST_SetSRID(extensions.ST_MakePoint(0, 0), 4326)::extensions.geography)$$, '23514', NULL, 'pilot country is constrained to FI/SE/NO');
SELECT throws_ok($$INSERT INTO app.condition_observations (source_observation_id, resort_id, metric_key, numeric_value, text_value, unit) VALUES ('00000000-0000-0000-0000-000000000062', '00000000-0000-0000-0000-000000000041', 'snow_depth', 42, 'forty-two', 'cm')$$, '23514', NULL, 'an observation must have exactly one typed value');
SELECT throws_ok($$INSERT INTO app.condition_observations (source_observation_id, resort_id, metric_key, numeric_value, unit) VALUES ('00000000-0000-0000-0000-000000000063', '00000000-0000-0000-0000-000000000041', 'new_snow_24h', 2, 'cm')$$, '23514', NULL, 'normalized observation metric must match approved source field');
SELECT is((SELECT round(sum(weight), 3) FROM app.resort_rating_categories WHERE version_key = 'initial-v1'), 1.000::numeric, 'rating weights sum to 100 percent');
SELECT is((SELECT count(*)::integer FROM app.resort_rating_categories WHERE version_key = 'initial-v1'), 7, 'all seven master-context rating categories are present');

INSERT INTO app.condition_observations (source_observation_id, resort_id, metric_key, numeric_value, unit)
VALUES ('00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000041', 'snow_depth', 42, 'cm');
SELECT is((SELECT freshness_state FROM app.v_condition_freshness WHERE resort_id = '00000000-0000-0000-0000-000000000041' LIMIT 1), 'stale', 'expired condition is marked stale by the view');
INSERT INTO app.condition_scores (resort_id, version_key, score, computed_at, valid_until, confidence_level, validation_state, is_current)
VALUES ('00000000-0000-0000-0000-000000000041', 'test-v1', 70, now(), now() + interval '1 hour', 'high', 'validated', true);
SELECT throws_ok($$INSERT INTO app.condition_scores (resort_id, version_key, score, computed_at, valid_until, confidence_level, validation_state, is_current) VALUES ('00000000-0000-0000-0000-000000000041', 'test-v1', 101, now(), now() + interval '1 hour', 'high', 'validated', true)$$, '23514', NULL, 'condition score is constrained to 0-100');
SELECT throws_ok($$INSERT INTO app.condition_scores (resort_id, version_key, score, computed_at, valid_until, confidence_level, validation_state, is_current) VALUES ('00000000-0000-0000-0000-000000000041', 'test-v1', 65, now(), now() + interval '1 hour', 'high', 'validated', true)$$, '23505', NULL, 'only one current score per resort is allowed');
SELECT ok((SELECT point IS NOT NULL FROM app.locations WHERE id = '00000000-0000-0000-0000-000000000031'), 'location stores spatial point');
SELECT ok((SELECT count(*) = 1 FROM app.resorts WHERE id = '00000000-0000-0000-0000-000000000041'), 'resort is linked to a stable location');

SELECT * FROM finish();
ROLLBACK;
