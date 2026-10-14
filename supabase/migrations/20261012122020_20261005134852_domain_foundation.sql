BEGIN;

CREATE SCHEMA IF NOT EXISTS app;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

CREATE TYPE app.source_kind AS ENUM (
  'resort_website', 'national_api', 'licensed_feed', 'open_dataset', 'manual'
);
CREATE TYPE app.approval_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');
CREATE TYPE app.access_method AS ENUM ('manual', 'documented_api', 'partner_feed');
CREATE TYPE app.validation_state AS ENUM ('pending', 'validated', 'rejected', 'needs_review');
CREATE TYPE app.confidence_level AS ENUM ('unknown', 'low', 'medium', 'high');
CREATE TYPE app.translation_state AS ENUM ('draft', 'reviewed', 'published');
CREATE TYPE app.map_feature_kind AS ENUM ('resort_boundary', 'lift', 'piste', 'point_of_interest', 'other');

CREATE FUNCTION app.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TABLE app.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  owner_name text NOT NULL,
  source_kind app.source_kind NOT NULL,
  home_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.source_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES app.sources(id) ON DELETE RESTRICT,
  data_scope text NOT NULL,
  status app.approval_status NOT NULL DEFAULT 'pending',
  access_method app.access_method NOT NULL,
  permitted_fields text[] NOT NULL DEFAULT '{}',
  collection_allowed boolean NOT NULL DEFAULT false,
  normalized_storage_allowed boolean NOT NULL DEFAULT false,
  normalized_retention_days integer,
  raw_storage_allowed boolean NOT NULL DEFAULT false,
  raw_retention_days integer,
  commercial_display_allowed boolean NOT NULL DEFAULT false,
  derived_use_allowed boolean NOT NULL DEFAULT false,
  attribution_text text,
  terms_url text,
  terms_version text,
  reviewed_at timestamptz,
  valid_until timestamptz,
  approved_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, source_id),
  CONSTRAINT source_approval_terms_when_approved CHECK (
    status <> 'approved' OR (terms_url IS NOT NULL AND terms_version IS NOT NULL AND reviewed_at IS NOT NULL)
  ),
  CONSTRAINT source_approval_attribution_when_displayed CHECK (
    NOT commercial_display_allowed OR NULLIF(btrim(attribution_text), '') IS NOT NULL
  ),
  CONSTRAINT source_approval_normalized_retention CHECK (
    (NOT normalized_storage_allowed AND normalized_retention_days IS NULL)
    OR (normalized_storage_allowed AND normalized_retention_days > 0)
  ),
  CONSTRAINT source_approval_raw_retention CHECK (
    (NOT raw_storage_allowed AND raw_retention_days IS NULL)
    OR (raw_storage_allowed AND raw_retention_days > 0)
  ),
  CONSTRAINT source_approval_validity CHECK (valid_until IS NULL OR reviewed_at IS NULL OR valid_until > reviewed_at)
);
CREATE INDEX source_approvals_source_scope_idx ON app.source_approvals(source_id, data_scope, status);

CREATE TABLE app.source_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL,
  approval_id uuid NOT NULL,
  field_key text NOT NULL CHECK (field_key ~ '^[a-z][a-z0-9_]*$'),
  source_url text NOT NULL CHECK (source_url ~* '^https?://'),
  source_updated_at timestamptz,
  accessed_at timestamptz NOT NULL,
  attribution_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (approval_id, source_id)
    REFERENCES app.source_approvals(id, source_id) ON DELETE RESTRICT,
  UNIQUE (id, source_id, approval_id),
  UNIQUE (approval_id, source_url, field_key)
);
CREATE INDEX source_references_source_accessed_idx ON app.source_references(source_id, accessed_at DESC);

CREATE FUNCTION app.enforce_approved_source_reference()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, app
AS $$
DECLARE
  approval app.source_approvals%ROWTYPE;
  reference_field text;
  reference_id uuid;
BEGIN
  reference_id := COALESCE(
    (to_jsonb(NEW) ->> 'source_reference_id')::uuid,
    (to_jsonb(NEW) ->> 'primary_source_reference_id')::uuid
  );

  SELECT * INTO approval
  FROM app.source_approvals
  WHERE id = NEW.approval_id AND source_id = NEW.source_id;

  SELECT field_key INTO reference_field
  FROM app.source_references
  WHERE id = reference_id
    AND source_id = NEW.source_id
    AND approval_id = NEW.approval_id;

  IF approval.id IS NULL
     OR reference_field IS NULL
     OR approval.status <> 'approved'
     OR NOT approval.collection_allowed
     OR NOT approval.normalized_storage_allowed
     OR (approval.valid_until IS NOT NULL AND approval.valid_until <= now())
     OR NOT (reference_field = ANY(approval.permitted_fields) OR '*' = ANY(approval.permitted_fields)) THEN
    RAISE EXCEPTION 'source-backed record has no current storage approval for source %', NEW.source_id
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TABLE app.raw_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL,
  approval_id uuid NOT NULL,
  source_reference_id uuid NOT NULL,
  fetched_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  purge_after timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (approval_id, source_id)
    REFERENCES app.source_approvals(id, source_id) ON DELETE RESTRICT,
  FOREIGN KEY (source_reference_id, source_id, approval_id)
    REFERENCES app.source_references(id, source_id, approval_id) ON DELETE RESTRICT,
  UNIQUE (source_id, payload_sha256, fetched_at),
  UNIQUE (id, source_id),
  CONSTRAINT raw_observation_purge_after_fetch CHECK (purge_after > fetched_at)
);
CREATE INDEX raw_observations_purge_after_idx ON app.raw_observations(purge_after);
CREATE INDEX raw_observations_source_fetched_idx ON app.raw_observations(source_id, fetched_at DESC);

CREATE FUNCTION app.enforce_raw_observation_rights()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, app
AS $$
DECLARE
  approval app.source_approvals%ROWTYPE;
BEGIN
  SELECT * INTO approval
  FROM app.source_approvals
  WHERE id = NEW.approval_id AND source_id = NEW.source_id;

  IF NOT FOUND
     OR approval.status <> 'approved'
     OR NOT approval.collection_allowed
     OR NOT approval.raw_storage_allowed
     OR (approval.valid_until IS NOT NULL AND approval.valid_until <= now()) THEN
    RAISE EXCEPTION 'raw payload storage is not approved for source %', NEW.source_id
      USING ERRCODE = '42501';
  END IF;

  IF NEW.purge_after > NEW.fetched_at + make_interval(days => approval.raw_retention_days) THEN
    RAISE EXCEPTION 'raw payload retention exceeds approved maximum'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER raw_observations_rights_guard
BEFORE INSERT OR UPDATE OF source_id, approval_id, fetched_at, purge_after
ON app.raw_observations
FOR EACH ROW EXECUTE FUNCTION app.enforce_raw_observation_rights();

CREATE TABLE app.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL,
  country_code char(2) NOT NULL CHECK (country_code IN ('FI', 'SE', 'NO')),
  region_name text,
  municipality_name text,
  point extensions.geography(Point, 4326) NOT NULL,
  elevation_m numeric(7,2) CHECK (elevation_m IS NULL OR elevation_m BETWEEN -500 AND 9000),
  source_reference_id uuid REFERENCES app.source_references(id) ON DELETE RESTRICT,
  confidence_level app.confidence_level NOT NULL DEFAULT 'unknown',
  validation_state app.validation_state NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX locations_point_gix ON app.locations USING GIST (point);

CREATE TABLE app.resorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  official_name text NOT NULL CHECK (length(btrim(official_name)) > 0),
  location_id uuid NOT NULL REFERENCES app.locations(id) ON DELETE RESTRICT,
  source_id uuid NOT NULL,
  approval_id uuid NOT NULL,
  primary_source_reference_id uuid NOT NULL,
  homepage_url text CHECK (homepage_url IS NULL OR homepage_url ~* '^https?://'),
  confidence_level app.confidence_level NOT NULL DEFAULT 'unknown',
  validation_state app.validation_state NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (approval_id, source_id)
    REFERENCES app.source_approvals(id, source_id) ON DELETE RESTRICT,
  FOREIGN KEY (primary_source_reference_id, source_id, approval_id)
    REFERENCES app.source_references(id, source_id, approval_id) ON DELETE RESTRICT
);
CREATE INDEX resorts_location_idx ON app.resorts(location_id);
CREATE INDEX resorts_name_idx ON app.resorts(official_name);
CREATE TRIGGER resorts_source_rights_guard
BEFORE INSERT OR UPDATE OF source_id, approval_id, primary_source_reference_id
ON app.resorts FOR EACH ROW EXECUTE FUNCTION app.enforce_approved_source_reference();

CREATE TABLE app.resort_translations (
  resort_id uuid NOT NULL REFERENCES app.resorts(id) ON DELETE CASCADE,
  locale text NOT NULL CHECK (locale IN ('fi', 'en', 'sv', 'no')),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  short_description text,
  translation_state app.translation_state NOT NULL DEFAULT 'draft',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (resort_id, locale)
);

CREATE TABLE app.map_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resort_id uuid NOT NULL REFERENCES app.resorts(id) ON DELETE RESTRICT,
  feature_kind app.map_feature_kind NOT NULL,
  geometry extensions.geometry(Geometry, 4326) NOT NULL,
  source_id uuid NOT NULL,
  approval_id uuid NOT NULL,
  source_reference_id uuid NOT NULL,
  external_feature_key text,
  confidence_level app.confidence_level NOT NULL DEFAULT 'unknown',
  validation_state app.validation_state NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (approval_id, source_id)
    REFERENCES app.source_approvals(id, source_id) ON DELETE RESTRICT,
  FOREIGN KEY (source_reference_id, source_id, approval_id)
    REFERENCES app.source_references(id, source_id, approval_id) ON DELETE RESTRICT,
  CONSTRAINT map_features_geometry_valid CHECK (extensions.ST_IsValid(geometry)),
  UNIQUE (resort_id, source_id, external_feature_key)
);
CREATE INDEX map_features_geometry_gix ON app.map_features USING GIST (geometry);
CREATE INDEX map_features_resort_kind_idx ON app.map_features(resort_id, feature_kind);
CREATE TRIGGER map_features_source_rights_guard
BEFORE INSERT OR UPDATE OF source_id, approval_id, source_reference_id
ON app.map_features FOR EACH ROW EXECUTE FUNCTION app.enforce_approved_source_reference();

CREATE TABLE app.lifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resort_id uuid NOT NULL REFERENCES app.resorts(id) ON DELETE RESTRICT,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL,
  lift_kind text,
  map_feature_id uuid REFERENCES app.map_features(id) ON DELETE RESTRICT,
  source_id uuid NOT NULL,
  approval_id uuid NOT NULL,
  source_reference_id uuid NOT NULL,
  confidence_level app.confidence_level NOT NULL DEFAULT 'unknown',
  validation_state app.validation_state NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (approval_id, source_id)
    REFERENCES app.source_approvals(id, source_id) ON DELETE RESTRICT,
  FOREIGN KEY (source_reference_id, source_id, approval_id)
    REFERENCES app.source_references(id, source_id, approval_id) ON DELETE RESTRICT,
  UNIQUE (resort_id, slug),
  UNIQUE (map_feature_id)
);
CREATE INDEX lifts_resort_idx ON app.lifts(resort_id);
CREATE TRIGGER lifts_source_rights_guard
BEFORE INSERT OR UPDATE OF source_id, approval_id, source_reference_id
ON app.lifts FOR EACH ROW EXECUTE FUNCTION app.enforce_approved_source_reference();

CREATE TABLE app.pistes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resort_id uuid NOT NULL REFERENCES app.resorts(id) ON DELETE RESTRICT,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL,
  difficulty text,
  length_m numeric(9,2) CHECK (length_m IS NULL OR length_m >= 0),
  map_feature_id uuid REFERENCES app.map_features(id) ON DELETE RESTRICT,
  source_id uuid NOT NULL,
  approval_id uuid NOT NULL,
  source_reference_id uuid NOT NULL,
  confidence_level app.confidence_level NOT NULL DEFAULT 'unknown',
  validation_state app.validation_state NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (approval_id, source_id)
    REFERENCES app.source_approvals(id, source_id) ON DELETE RESTRICT,
  FOREIGN KEY (source_reference_id, source_id, approval_id)
    REFERENCES app.source_references(id, source_id, approval_id) ON DELETE RESTRICT,
  UNIQUE (resort_id, slug),
  UNIQUE (map_feature_id)
);
CREATE INDEX pistes_resort_idx ON app.pistes(resort_id);
CREATE TRIGGER pistes_source_rights_guard
BEFORE INSERT OR UPDATE OF source_id, approval_id, source_reference_id
ON app.pistes FOR EACH ROW EXECUTE FUNCTION app.enforce_approved_source_reference();

CREATE TRIGGER sources_touch_updated_at BEFORE UPDATE ON app.sources
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER source_approvals_touch_updated_at BEFORE UPDATE ON app.source_approvals
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER locations_touch_updated_at BEFORE UPDATE ON app.locations
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER resorts_touch_updated_at BEFORE UPDATE ON app.resorts
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER map_features_touch_updated_at BEFORE UPDATE ON app.map_features
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER lifts_touch_updated_at BEFORE UPDATE ON app.lifts
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER pistes_touch_updated_at BEFORE UPDATE ON app.pistes
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

COMMIT;
