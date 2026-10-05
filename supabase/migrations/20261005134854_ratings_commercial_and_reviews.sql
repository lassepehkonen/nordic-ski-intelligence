BEGIN;

CREATE TYPE app.rating_version_state AS ENUM ('draft', 'active', 'retired');
CREATE TYPE app.review_state AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');
CREATE TYPE app.offer_kind AS ENUM ('lift_ticket', 'rental', 'lesson', 'accommodation', 'activity', 'other');

CREATE TABLE app.resort_rating_versions (
  version_key text PRIMARY KEY CHECK (version_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  scale_min numeric,
  scale_max numeric,
  state app.rating_version_state NOT NULL DEFAULT 'draft',
  rationale text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rating_scale_both_or_neither CHECK (
    (scale_min IS NULL AND scale_max IS NULL)
    OR (scale_min IS NOT NULL AND scale_max IS NOT NULL AND scale_max > scale_min)
  )
);

CREATE UNIQUE INDEX resort_rating_versions_one_active_uidx
  ON app.resort_rating_versions(state) WHERE state = 'active';

CREATE TABLE app.resort_rating_categories (
  version_key text NOT NULL REFERENCES app.resort_rating_versions(version_key) ON DELETE RESTRICT,
  category_key text NOT NULL CHECK (category_key IN (
    'atmosphere_environment', 'slopes', 'lifts', 'off_piste',
    'accommodation', 'food', 'apres_ski'
  )),
  weight numeric(5,3) NOT NULL CHECK (weight BETWEEN 0 AND 1),
  PRIMARY KEY (version_key, category_key)
);

INSERT INTO app.resort_rating_versions (version_key, scale_min, scale_max, state, rationale)
VALUES (
  'initial-v1', NULL, NULL, 'draft',
  'Master Product Context category weights; rating scale is intentionally undecided.'
);
INSERT INTO app.resort_rating_categories (version_key, category_key, weight) VALUES
  ('initial-v1', 'atmosphere_environment', 0.150),
  ('initial-v1', 'slopes', 0.250),
  ('initial-v1', 'lifts', 0.150),
  ('initial-v1', 'off_piste', 0.200),
  ('initial-v1', 'accommodation', 0.100),
  ('initial-v1', 'food', 0.075),
  ('initial-v1', 'apres_ski', 0.075);

CREATE TABLE app.resort_rating_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resort_id uuid NOT NULL REFERENCES app.resorts(id) ON DELETE RESTRICT,
  version_key text NOT NULL,
  category_key text NOT NULL,
  rating_value numeric NOT NULL,
  rationale text NOT NULL,
  source_reference_id uuid REFERENCES app.source_references(id) ON DELETE RESTRICT,
  validation_state app.validation_state NOT NULL DEFAULT 'pending',
  assessed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (version_key, category_key)
    REFERENCES app.resort_rating_categories(version_key, category_key) ON DELETE RESTRICT,
  UNIQUE (resort_id, version_key, category_key)
);
CREATE INDEX resort_rating_values_resort_version_idx
  ON app.resort_rating_values(resort_id, version_key);

CREATE FUNCTION app.enforce_rating_scale()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, app
AS $$
DECLARE
  scale_min_value numeric;
  scale_max_value numeric;
  version_state app.rating_version_state;
BEGIN
  SELECT scale_min, scale_max, state
    INTO scale_min_value, scale_max_value, version_state
  FROM app.resort_rating_versions
  WHERE version_key = NEW.version_key;

  IF NOT FOUND OR scale_min_value IS NULL OR scale_max_value IS NULL THEN
    RAISE EXCEPTION 'rating scale must be explicitly configured before values are stored'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.rating_value < scale_min_value OR NEW.rating_value > scale_max_value THEN
    RAISE EXCEPTION 'rating value is outside the configured scale'
      USING ERRCODE = '23514';
  END IF;
  IF version_state <> 'active' THEN
    RAISE EXCEPTION 'rating values can only be recorded for an active rating version'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER resort_rating_values_scale_guard
BEFORE INSERT OR UPDATE OF version_key, rating_value
ON app.resort_rating_values
FOR EACH ROW EXECUTE FUNCTION app.enforce_rating_scale();

CREATE TABLE app.resort_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resort_id uuid NOT NULL REFERENCES app.resorts(id) ON DELETE RESTRICT,
  source_id uuid NOT NULL,
  approval_id uuid NOT NULL,
  source_reference_id uuid NOT NULL,
  external_review_id text NOT NULL,
  rating_value numeric,
  rating_scale_label text,
  review_text text,
  locale text CHECK (locale IS NULL OR locale IN ('fi', 'en', 'sv', 'no')),
  original_created_at timestamptz,
  retrieved_at timestamptz NOT NULL,
  valid_until timestamptz,
  retention_expires_at timestamptz NOT NULL,
  confidence_level app.confidence_level NOT NULL DEFAULT 'unknown',
  validation_state app.validation_state NOT NULL DEFAULT 'pending',
  review_state app.review_state NOT NULL DEFAULT 'pending',
  FOREIGN KEY (approval_id, source_id)
    REFERENCES app.source_approvals(id, source_id) ON DELETE RESTRICT,
  FOREIGN KEY (source_reference_id, source_id, approval_id)
    REFERENCES app.source_references(id, source_id, approval_id) ON DELETE RESTRICT,
  UNIQUE (source_id, external_review_id),
  CONSTRAINT resort_review_validity CHECK (valid_until IS NULL OR valid_until > retrieved_at),
  CONSTRAINT resort_review_retention CHECK (retention_expires_at > retrieved_at),
  CONSTRAINT resort_review_rating CHECK (rating_value IS NULL OR rating_value >= 0)
);
CREATE INDEX resort_reviews_resort_time_idx ON app.resort_reviews(resort_id, original_created_at DESC);
CREATE TRIGGER resort_reviews_source_rights_guard
BEFORE INSERT OR UPDATE OF source_id, approval_id, source_reference_id
ON app.resort_reviews FOR EACH ROW EXECUTE FUNCTION app.enforce_approved_source_reference();

CREATE TABLE app.webcams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resort_id uuid NOT NULL REFERENCES app.resorts(id) ON DELETE RESTRICT,
  source_id uuid NOT NULL,
  approval_id uuid NOT NULL,
  source_reference_id uuid NOT NULL,
  name text NOT NULL,
  operator_page_url text NOT NULL CHECK (operator_page_url ~* '^https?://'),
  embed_url text CHECK (embed_url IS NULL OR embed_url ~* '^https?://'),
  embed_permitted boolean NOT NULL DEFAULT false,
  retrieved_at timestamptz NOT NULL,
  valid_until timestamptz,
  retention_expires_at timestamptz NOT NULL,
  confidence_level app.confidence_level NOT NULL DEFAULT 'unknown',
  validation_state app.validation_state NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (approval_id, source_id)
    REFERENCES app.source_approvals(id, source_id) ON DELETE RESTRICT,
  FOREIGN KEY (source_reference_id, source_id, approval_id)
    REFERENCES app.source_references(id, source_id, approval_id) ON DELETE RESTRICT,
  CONSTRAINT webcam_embed_permission CHECK (embed_url IS NULL OR embed_permitted),
  CONSTRAINT webcam_validity CHECK (valid_until IS NULL OR valid_until > retrieved_at),
  CONSTRAINT webcam_retention CHECK (retention_expires_at > retrieved_at)
);
CREATE INDEX webcams_resort_idx ON app.webcams(resort_id);
CREATE TRIGGER webcams_source_rights_guard
BEFORE INSERT OR UPDATE OF source_id, approval_id, source_reference_id
ON app.webcams FOR EACH ROW EXECUTE FUNCTION app.enforce_approved_source_reference();

CREATE TABLE app.commercial_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resort_id uuid NOT NULL REFERENCES app.resorts(id) ON DELETE RESTRICT,
  source_id uuid NOT NULL,
  approval_id uuid NOT NULL,
  source_reference_id uuid NOT NULL,
  offer_kind app.offer_kind NOT NULL,
  title text NOT NULL,
  offer_url text NOT NULL CHECK (offer_url ~* '^https?://'),
  price_amount numeric(12,2) CHECK (price_amount IS NULL OR price_amount >= 0),
  price_currency char(3) CHECK (price_currency IS NULL OR price_currency ~ '^[A-Z]{3}$'),
  valid_from timestamptz,
  valid_to timestamptz,
  retrieved_at timestamptz NOT NULL,
  retention_expires_at timestamptz NOT NULL,
  confidence_level app.confidence_level NOT NULL DEFAULT 'unknown',
  validation_state app.validation_state NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (approval_id, source_id)
    REFERENCES app.source_approvals(id, source_id) ON DELETE RESTRICT,
  FOREIGN KEY (source_reference_id, source_id, approval_id)
    REFERENCES app.source_references(id, source_id, approval_id) ON DELETE RESTRICT,
  CONSTRAINT commercial_offer_validity CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to > valid_from),
  CONSTRAINT commercial_offer_retention CHECK (retention_expires_at > retrieved_at)
);
CREATE INDEX commercial_offers_resort_validity_idx
  ON app.commercial_offers(resort_id, valid_from, valid_to);
CREATE TRIGGER commercial_offers_source_rights_guard
BEFORE INSERT OR UPDATE OF source_id, approval_id, source_reference_id
ON app.commercial_offers FOR EACH ROW EXECUTE FUNCTION app.enforce_approved_source_reference();

CREATE TRIGGER commercial_offers_touch_updated_at BEFORE UPDATE ON app.commercial_offers
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

COMMIT;
