BEGIN;
SELECT plan(10);

INSERT INTO app.sources (id, slug, owner_name, source_kind, home_url)
VALUES ('10000000-0000-0000-0000-000000000001', 'rights-test', 'Test source', 'manual', 'https://example.invalid/');
INSERT INTO app.source_approvals (
  id, source_id, data_scope, status, access_method, permitted_fields,
  collection_allowed, normalized_storage_allowed, normalized_retention_days,
  raw_storage_allowed, raw_retention_days, commercial_display_allowed,
  derived_use_allowed, attribution_text, terms_url, terms_version, reviewed_at
) VALUES
  ('10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'conditions', 'pending', 'manual', ARRAY['snow_depth'], true, true, 30, false, NULL, false, false, NULL, NULL, NULL, NULL),
  ('10000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', 'conditions', 'approved', 'manual', ARRAY['snow_depth'], true, false, NULL, false, NULL, true, false, 'Test source', 'https://example.invalid/terms', 'test-1', now()),
  ('10000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001', 'conditions', 'approved', 'manual', ARRAY['snow_depth'], true, true, 30, true, 7, true, false, 'Test source', 'https://example.invalid/terms', 'test-1', now()),
  ('10000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000001', 'conditions', 'approved', 'manual', ARRAY['snow_depth'], true, true, 30, false, NULL, true, false, 'Test source', 'https://example.invalid/terms', 'test-1', now()),
  ('10000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000001', 'conditions', 'approved', 'manual', ARRAY['snow_depth'], true, true, 30, false, NULL, true, true, 'Test source', 'https://example.invalid/terms', 'test-1', now());
INSERT INTO app.source_references (id, source_id, approval_id, field_key, source_url, accessed_at) VALUES
  ('10000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000011', 'snow_depth', 'https://example.invalid/pending', now()),
  ('10000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000012', 'snow_depth', 'https://example.invalid/no-storage', now()),
  ('10000000-0000-0000-0000-000000000023', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000013', 'snow_depth', 'https://example.invalid/raw', now()),
  ('10000000-0000-0000-0000-000000000024', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000014', 'snow_depth', 'https://example.invalid/not-derived', now()),
  ('10000000-0000-0000-0000-000000000025', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000015', 'snow_depth', 'https://example.invalid/derived', now()),
  ('10000000-0000-0000-0000-000000000026', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000011', 'map_geometry', 'https://example.invalid/pending-map', now());

SELECT throws_ok($$INSERT INTO app.source_observations (source_id, approval_id, source_reference_id, field_key, fetched_at, retention_expires_at, validation_state) VALUES ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000021', 'snow_depth', now(), now() + interval '1 day', 'validated')$$, '42501', NULL, 'pending rights cannot create normalized observations');
SELECT throws_ok($$INSERT INTO app.source_observations (source_id, approval_id, source_reference_id, field_key, fetched_at, retention_expires_at, validation_state) VALUES ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000022', 'snow_depth', now(), now() + interval '1 day', 'validated')$$, '42501', NULL, 'normalized storage must be expressly permitted');
SELECT throws_ok($$INSERT INTO app.raw_observations (source_id, approval_id, source_reference_id, fetched_at, payload, payload_sha256, purge_after) VALUES ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000022', now(), '{}'::jsonb, repeat('a', 64), now() + interval '1 day')$$, '42501', NULL, 'raw storage must be separately approved');

INSERT INTO app.raw_observations (source_id, approval_id, source_reference_id, fetched_at, payload, payload_sha256, purge_after)
VALUES ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000023', now(), '{}'::jsonb, repeat('b', 64), now() + interval '3 days');
SELECT is((SELECT count(*)::integer FROM app.raw_observations WHERE approval_id = '10000000-0000-0000-0000-000000000013'), 1, 'raw payload is retained only within its approved window');
SELECT throws_ok($$INSERT INTO app.raw_observations (source_id, approval_id, source_reference_id, fetched_at, payload, payload_sha256, purge_after) VALUES ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000023', now(), '{}'::jsonb, repeat('c', 64), now() + interval '8 days')$$, '42501', NULL, 'raw payload retention cannot exceed source approval');

INSERT INTO app.locations (id, slug, name, country_code, point)
VALUES ('10000000-0000-0000-0000-000000000031', 'rights-test-location', 'Test location', 'FI', extensions.ST_SetSRID(extensions.ST_MakePoint(24.9, 60.2), 4326)::extensions.geography);
INSERT INTO app.resorts (id, slug, official_name, location_id, source_id, approval_id, primary_source_reference_id)
VALUES ('10000000-0000-0000-0000-000000000041', 'rights-test-resort', 'Test Resort', '10000000-0000-0000-0000-000000000031', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000024');
SELECT throws_ok($$INSERT INTO app.map_features (resort_id, feature_kind, geometry, source_id, approval_id, source_reference_id) VALUES ('10000000-0000-0000-0000-000000000041', 'resort_boundary', extensions.ST_GeomFromText('POLYGON((24.8 60.1,25.0 60.1,25.0 60.3,24.8 60.3,24.8 60.1))', 4326), '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000026')$$, '42501', NULL, 'pending source rights cannot store map geometry');
INSERT INTO app.source_observations (id, source_id, approval_id, source_reference_id, field_key, source_observed_at, fetched_at, valid_until, retention_expires_at, confidence_level, validation_state) VALUES
  ('10000000-0000-0000-0000-000000000051', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000024', 'snow_depth', now(), now(), now() + interval '1 day', now() + interval '7 days', 'high', 'validated'),
  ('10000000-0000-0000-0000-000000000052', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000025', 'snow_depth', now(), now(), now() + interval '1 day', now() + interval '7 days', 'high', 'validated');
INSERT INTO app.condition_score_versions (version_key, description, parameters)
VALUES ('rights-test-v1', 'rights guard test', '{}'::jsonb);
INSERT INTO app.condition_scores (id, resort_id, version_key, score, computed_at, valid_until, confidence_level, validation_state, is_current)
VALUES ('10000000-0000-0000-0000-000000000061', '10000000-0000-0000-0000-000000000041', 'rights-test-v1', 50, now(), now() + interval '1 hour', 'high', 'validated', true);
SELECT throws_ok($$INSERT INTO app.condition_score_inputs (condition_score_id, source_observation_id, normalized_value, weight, contribution) VALUES ('10000000-0000-0000-0000-000000000061', '10000000-0000-0000-0000-000000000051', 10, 1, 10)$$, '42501', NULL, 'score inputs require explicit derived-use permission');
INSERT INTO app.condition_score_inputs (condition_score_id, source_observation_id, normalized_value, weight, contribution)
VALUES ('10000000-0000-0000-0000-000000000061', '10000000-0000-0000-0000-000000000052', 10, 1, 10);
SELECT is((SELECT count(*)::integer FROM app.condition_score_inputs WHERE condition_score_id = '10000000-0000-0000-0000-000000000061'), 1, 'validated, rights-cleared inputs are linked to a score');

SELECT throws_ok($$INSERT INTO app.resort_rating_values (resort_id, version_key, category_key, rating_value, rationale) VALUES ('10000000-0000-0000-0000-000000000041', 'initial-v1', 'slopes', 3, 'fixture')$$, '23514', NULL, 'rating values are blocked until the rating scale is explicit');
UPDATE app.resort_rating_versions SET scale_min = 1, scale_max = 5, state = 'active' WHERE version_key = 'initial-v1';
INSERT INTO app.resort_rating_values (resort_id, version_key, category_key, rating_value, rationale)
VALUES ('10000000-0000-0000-0000-000000000041', 'initial-v1', 'slopes', 3, 'fixture');
SELECT is((SELECT count(*)::integer FROM app.resort_rating_values WHERE resort_id = '10000000-0000-0000-0000-000000000041'), 1, 'rating value can be stored after choosing a scale');

SELECT * FROM finish();
ROLLBACK;
