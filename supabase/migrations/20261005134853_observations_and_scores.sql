BEGIN;

CREATE TYPE app.observation_metric AS ENUM (
  'snow_depth', 'new_snow_24h', 'new_snow_72h', 'surface_condition', 'snow_quality',
  'open_lift_count', 'total_lift_count', 'open_piste_count', 'total_piste_count', 'operating_status',
  'temperature', 'precipitation', 'wind_speed', 'wind_direction', 'humidity', 'weather_code'
);
CREATE TYPE app.score_version_state AS ENUM ('draft', 'active', 'retired');

CREATE TABLE app.source_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL,
  approval_id uuid NOT NULL,
  source_reference_id uuid NOT NULL,
  raw_observation_id uuid,
  field_key text NOT NULL CHECK (field_key ~ '^[a-z][a-z0-9_]*$'),
  source_observed_at timestamptz,
  fetched_at timestamptz NOT NULL,
  valid_until timestamptz,
  retention_expires_at timestamptz NOT NULL,
  confidence_level app.confidence_level NOT NULL DEFAULT 'unknown',
  validation_state app.validation_state NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (approval_id, source_id)
    REFERENCES app.source_approvals(id, source_id) ON DELETE RESTRICT,
  FOREIGN KEY (source_reference_id, source_id, approval_id)
    REFERENCES app.source_references(id, source_id, approval_id) ON DELETE RESTRICT,
  FOREIGN KEY (raw_observation_id, source_id)
    REFERENCES app.raw_observations(id, source_id) ON DELETE SET NULL (raw_observation_id),
  UNIQUE (id, source_id),
  CONSTRAINT source_observation_retention CHECK (retention_expires_at > fetched_at)
);
CREATE INDEX source_observations_source_field_time_idx
  ON app.source_observations(source_id, field_key, fetched_at DESC);
CREATE INDEX source_observations_valid_until_idx
  ON app.source_observations(valid_until) WHERE valid_until IS NOT NULL;
CREATE INDEX source_observations_retention_idx
  ON app.source_observations(retention_expires_at);

CREATE FUNCTION app.enforce_normalized_observation_rights()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, app
AS $$
DECLARE
  approval app.source_approvals%ROWTYPE;
  reference_field text;
BEGIN
  SELECT * INTO approval
  FROM app.source_approvals
  WHERE id = NEW.approval_id AND source_id = NEW.source_id;

  SELECT field_key INTO reference_field
  FROM app.source_references
  WHERE id = NEW.source_reference_id
    AND source_id = NEW.source_id
    AND approval_id = NEW.approval_id;

  IF NOT FOUND
     OR approval.status <> 'approved'
     OR NOT approval.collection_allowed
     OR NOT approval.normalized_storage_allowed
     OR (approval.valid_until IS NOT NULL AND approval.valid_until <= now())
     OR NOT (NEW.field_key = ANY(approval.permitted_fields) OR '*' = ANY(approval.permitted_fields))
     OR reference_field <> NEW.field_key THEN
    RAISE EXCEPTION 'normalized observation use is not approved for field %', NEW.field_key
      USING ERRCODE = '42501';
  END IF;

  IF NEW.retention_expires_at > NEW.fetched_at + make_interval(days => approval.normalized_retention_days) THEN
    RAISE EXCEPTION 'normalized observation retention exceeds approved maximum'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER source_observations_rights_guard
BEFORE INSERT OR UPDATE OF source_id, approval_id, source_reference_id, field_key, fetched_at, retention_expires_at
ON app.source_observations
FOR EACH ROW EXECUTE FUNCTION app.enforce_normalized_observation_rights();

CREATE FUNCTION app.enforce_observation_field_match()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, app
AS $$
DECLARE
  row_field text;
  approved_field text;
BEGIN
  row_field := COALESCE(to_jsonb(NEW) ->> 'metric_key', to_jsonb(NEW) ->> 'fact_key');
  SELECT field_key INTO approved_field
  FROM app.source_observations
  WHERE id = NEW.source_observation_id;

  IF approved_field IS NULL OR row_field IS DISTINCT FROM approved_field THEN
    RAISE EXCEPTION 'observation field does not match its approved source field'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE app.resort_facts (
  source_observation_id uuid PRIMARY KEY REFERENCES app.source_observations(id) ON DELETE RESTRICT,
  resort_id uuid NOT NULL REFERENCES app.resorts(id) ON DELETE RESTRICT,
  fact_key text NOT NULL,
  value jsonb NOT NULL,
  unit text,
  UNIQUE (resort_id, fact_key, source_observation_id)
);
CREATE INDEX resort_facts_lookup_idx ON app.resort_facts(resort_id, fact_key);
CREATE TRIGGER resort_facts_field_guard
BEFORE INSERT OR UPDATE OF source_observation_id, fact_key
ON app.resort_facts FOR EACH ROW EXECUTE FUNCTION app.enforce_observation_field_match();

CREATE TABLE app.condition_observations (
  source_observation_id uuid PRIMARY KEY REFERENCES app.source_observations(id) ON DELETE RESTRICT,
  resort_id uuid REFERENCES app.resorts(id) ON DELETE RESTRICT,
  lift_id uuid REFERENCES app.lifts(id) ON DELETE RESTRICT,
  piste_id uuid REFERENCES app.pistes(id) ON DELETE RESTRICT,
  metric_key app.observation_metric NOT NULL,
  numeric_value numeric,
  text_value text,
  unit text,
  CONSTRAINT condition_observation_one_target CHECK (num_nonnulls(resort_id, lift_id, piste_id) = 1),
  CONSTRAINT condition_observation_one_value CHECK (num_nonnulls(numeric_value, text_value) = 1)
);
CREATE INDEX condition_observations_resort_metric_idx ON app.condition_observations(resort_id, metric_key);
CREATE INDEX condition_observations_lift_idx ON app.condition_observations(lift_id, metric_key);
CREATE INDEX condition_observations_piste_idx ON app.condition_observations(piste_id, metric_key);
CREATE TRIGGER condition_observations_field_guard
BEFORE INSERT OR UPDATE OF source_observation_id, metric_key
ON app.condition_observations FOR EACH ROW EXECUTE FUNCTION app.enforce_observation_field_match();

CREATE TABLE app.weather_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL,
  approval_id uuid NOT NULL,
  source_reference_id uuid NOT NULL,
  location_id uuid NOT NULL REFERENCES app.locations(id) ON DELETE RESTRICT,
  external_station_id text NOT NULL,
  name text NOT NULL,
  elevation_m numeric(7,2) CHECK (elevation_m IS NULL OR elevation_m BETWEEN -500 AND 9000),
  confidence_level app.confidence_level NOT NULL DEFAULT 'unknown',
  validation_state app.validation_state NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (approval_id, source_id)
    REFERENCES app.source_approvals(id, source_id) ON DELETE RESTRICT,
  FOREIGN KEY (source_reference_id, source_id, approval_id)
    REFERENCES app.source_references(id, source_id, approval_id) ON DELETE RESTRICT,
  UNIQUE (source_id, external_station_id),
  UNIQUE (id, source_id)
);
CREATE INDEX weather_stations_location_idx ON app.weather_stations(location_id);
CREATE TRIGGER weather_stations_source_rights_guard
BEFORE INSERT OR UPDATE OF source_id, approval_id, source_reference_id
ON app.weather_stations FOR EACH ROW EXECUTE FUNCTION app.enforce_approved_source_reference();

CREATE TABLE app.weather_observations (
  source_observation_id uuid PRIMARY KEY,
  source_id uuid NOT NULL,
  station_id uuid NOT NULL,
  metric_key app.observation_metric NOT NULL,
  numeric_value numeric,
  text_value text,
  unit text,
  FOREIGN KEY (source_observation_id, source_id)
    REFERENCES app.source_observations(id, source_id) ON DELETE RESTRICT,
  FOREIGN KEY (station_id, source_id)
    REFERENCES app.weather_stations(id, source_id) ON DELETE RESTRICT,
  CONSTRAINT weather_observation_one_value CHECK (num_nonnulls(numeric_value, text_value) = 1)
);
CREATE INDEX weather_observations_station_metric_idx
  ON app.weather_observations(station_id, metric_key, source_observation_id);
CREATE TRIGGER weather_observations_field_guard
BEFORE INSERT OR UPDATE OF source_observation_id, metric_key
ON app.weather_observations FOR EACH ROW EXECUTE FUNCTION app.enforce_observation_field_match();

CREATE TABLE app.forecast_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL,
  approval_id uuid NOT NULL,
  source_reference_id uuid NOT NULL,
  raw_observation_id uuid,
  location_id uuid NOT NULL REFERENCES app.locations(id) ON DELETE RESTRICT,
  source_run_key text,
  issued_at timestamptz NOT NULL,
  fetched_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (approval_id, source_id)
    REFERENCES app.source_approvals(id, source_id) ON DELETE RESTRICT,
  FOREIGN KEY (source_reference_id, source_id, approval_id)
    REFERENCES app.source_references(id, source_id, approval_id) ON DELETE RESTRICT,
  FOREIGN KEY (raw_observation_id, source_id)
    REFERENCES app.raw_observations(id, source_id) ON DELETE SET NULL (raw_observation_id),
  UNIQUE (id, source_id),
  UNIQUE (id, location_id),
  UNIQUE (source_id, location_id, source_run_key)
);
CREATE INDEX forecast_runs_location_issued_idx ON app.forecast_runs(location_id, issued_at DESC);
CREATE TRIGGER forecast_runs_source_rights_guard
BEFORE INSERT OR UPDATE OF source_id, approval_id, source_reference_id
ON app.forecast_runs FOR EACH ROW EXECUTE FUNCTION app.enforce_approved_source_reference();

CREATE TABLE app.forecasts (
  source_observation_id uuid PRIMARY KEY,
  source_id uuid NOT NULL,
  forecast_run_id uuid NOT NULL,
  location_id uuid NOT NULL,
  valid_at timestamptz NOT NULL,
  metric_key app.observation_metric NOT NULL,
  numeric_value numeric,
  text_value text,
  unit text,
  FOREIGN KEY (source_observation_id, source_id)
    REFERENCES app.source_observations(id, source_id) ON DELETE RESTRICT,
  FOREIGN KEY (forecast_run_id, source_id)
    REFERENCES app.forecast_runs(id, source_id) ON DELETE RESTRICT,
  FOREIGN KEY (forecast_run_id, location_id)
    REFERENCES app.forecast_runs(id, location_id) ON DELETE RESTRICT,
  CONSTRAINT forecast_one_value CHECK (num_nonnulls(numeric_value, text_value) = 1),
  UNIQUE (forecast_run_id, valid_at, metric_key)
);
CREATE INDEX forecasts_location_metric_valid_idx ON app.forecasts(location_id, metric_key, valid_at);
CREATE TRIGGER forecasts_field_guard
BEFORE INSERT OR UPDATE OF source_observation_id, metric_key
ON app.forecasts FOR EACH ROW EXECUTE FUNCTION app.enforce_observation_field_match();

CREATE TABLE app.condition_score_versions (
  version_key text PRIMARY KEY CHECK (version_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  description text NOT NULL,
  parameters jsonb NOT NULL,
  state app.score_version_state NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz
);
CREATE UNIQUE INDEX condition_score_versions_one_active_uidx
  ON app.condition_score_versions(state) WHERE state = 'active';

CREATE TABLE app.condition_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resort_id uuid NOT NULL REFERENCES app.resorts(id) ON DELETE RESTRICT,
  version_key text NOT NULL REFERENCES app.condition_score_versions(version_key) ON DELETE RESTRICT,
  score numeric(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  explanation jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL,
  valid_until timestamptz,
  confidence_level app.confidence_level NOT NULL DEFAULT 'unknown',
  validation_state app.validation_state NOT NULL DEFAULT 'pending',
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT condition_score_validity CHECK (valid_until IS NULL OR valid_until > computed_at)
);
CREATE UNIQUE INDEX condition_scores_one_current_per_resort_uidx
  ON app.condition_scores(resort_id) WHERE is_current;
CREATE INDEX condition_scores_history_idx ON app.condition_scores(resort_id, computed_at DESC);

CREATE TABLE app.condition_score_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_score_id uuid NOT NULL REFERENCES app.condition_scores(id) ON DELETE CASCADE,
  source_observation_id uuid NOT NULL REFERENCES app.source_observations(id) ON DELETE RESTRICT,
  normalized_value numeric NOT NULL,
  weight numeric NOT NULL,
  contribution numeric NOT NULL,
  explanation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (condition_score_id, source_observation_id)
);
CREATE INDEX condition_score_inputs_observation_idx ON app.condition_score_inputs(source_observation_id);

CREATE FUNCTION app.enforce_score_input_rights()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, app
AS $$
DECLARE
  derived_allowed boolean;
  observation_validated boolean;
BEGIN
  SELECT a.derived_use_allowed, so.validation_state = 'validated'
    INTO derived_allowed, observation_validated
  FROM app.source_observations so
  JOIN app.source_approvals a
    ON a.id = so.approval_id AND a.source_id = so.source_id
  WHERE so.id = NEW.source_observation_id;

  IF NOT FOUND OR NOT derived_allowed OR NOT observation_validated THEN
    RAISE EXCEPTION 'score input requires a validated observation with approved derived use'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER condition_score_inputs_rights_guard
BEFORE INSERT OR UPDATE OF source_observation_id
ON app.condition_score_inputs
FOR EACH ROW EXECUTE FUNCTION app.enforce_score_input_rights();

CREATE VIEW app.v_condition_freshness AS
SELECT co.*, so.source_id, so.source_reference_id, so.source_observed_at, so.fetched_at,
       so.valid_until, so.confidence_level, so.validation_state,
       CASE
         WHEN so.validation_state = 'rejected' THEN 'invalid'
         WHEN so.valid_until IS NULL THEN 'unknown'
         WHEN so.valid_until <= now() THEN 'stale'
         ELSE 'fresh'
       END AS freshness_state,
       (a.status = 'approved' AND a.commercial_display_allowed
         AND (a.valid_until IS NULL OR a.valid_until > now())) AS display_permitted
FROM app.condition_observations co
JOIN app.source_observations so ON so.id = co.source_observation_id
JOIN app.source_approvals a ON a.id = so.approval_id AND a.source_id = so.source_id;

CREATE VIEW app.v_weather_observation_freshness AS
SELECT wo.*, so.source_reference_id, so.source_observed_at, so.fetched_at,
       so.valid_until, so.confidence_level, so.validation_state,
       CASE
         WHEN so.validation_state = 'rejected' THEN 'invalid'
         WHEN so.valid_until IS NULL THEN 'unknown'
         WHEN so.valid_until <= now() THEN 'stale'
         ELSE 'fresh'
       END AS freshness_state,
       (a.status = 'approved' AND a.commercial_display_allowed
         AND (a.valid_until IS NULL OR a.valid_until > now())) AS display_permitted
FROM app.weather_observations wo
JOIN app.source_observations so ON so.id = wo.source_observation_id
JOIN app.source_approvals a ON a.id = so.approval_id AND a.source_id = so.source_id;

CREATE VIEW app.v_forecast_freshness AS
SELECT f.*, so.source_reference_id, so.fetched_at, so.valid_until,
       so.confidence_level, so.validation_state, fr.issued_at,
       CASE
         WHEN so.validation_state = 'rejected' THEN 'invalid'
         WHEN so.valid_until IS NULL THEN 'unknown'
         WHEN so.valid_until <= now() THEN 'stale'
         ELSE 'fresh'
       END AS freshness_state,
       (a.status = 'approved' AND a.commercial_display_allowed
         AND (a.valid_until IS NULL OR a.valid_until > now())) AS display_permitted
FROM app.forecasts f
JOIN app.source_observations so ON so.id = f.source_observation_id
JOIN app.forecast_runs fr ON fr.id = f.forecast_run_id
JOIN app.source_approvals a ON a.id = so.approval_id AND a.source_id = so.source_id;

CREATE VIEW app.v_condition_score_freshness AS
SELECT s.*,
       CASE
         WHEN s.validation_state = 'rejected' THEN 'invalid'
         WHEN s.valid_until IS NULL THEN 'unknown'
         WHEN s.valid_until <= now() THEN 'stale'
         ELSE 'fresh'
       END AS freshness_state
FROM app.condition_scores s;

COMMIT;
