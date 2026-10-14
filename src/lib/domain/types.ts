/**
 * Product domain types.
 *
 * Shape follows `docs/architecture/domain-model.md` and the API read DTOs in
 * `docs/architecture/api.md`: stable resort identity, translations, provenance-carrying
 * observations, weather, forecast, Conditions Score and the separate Resort Rating stay as
 * different concepts. Nothing here knows about SvelteKit or the database.
 */

import type { Locale } from '../i18n/locales.js';

export type Country = 'FI' | 'SE' | 'NO';

export const COUNTRIES: readonly Country[] = ['FI', 'SE', 'NO'];

export type MetricKey =
	| 'snow_depth_cm'
	| 'new_snow_24h_cm'
	| 'new_snow_72h_cm'
	| 'forecast_snow_72h_cm'
	| 'open_pistes'
	| 'total_pistes'
	| 'open_lifts'
	| 'total_lifts'
	| 'temperature_c'
	| 'wind_ms'
	| 'precipitation_mm'
	| 'snow_quality';

export type WeatherMetricKey = 'temperature_c' | 'wind_ms' | 'precipitation_mm';

export type SnowQuality = 'powder' | 'packed' | 'wet' | 'icy' | 'spring';

/** Validation is independent of confidence and of Conditions Score (ADR-0009). */
export type ValidationState = 'pending' | 'validated' | 'rejected' | 'needs_review';

/** Qualitative only: an uncalibrated numeric confidence must not be published (ADR-0009). */
export type Confidence = 'unknown' | 'low' | 'medium' | 'high';

/** Freshness is derived at read time, never stored as a boolean that goes stale. */
export type FreshnessState = 'fresh' | 'stale' | 'unknown' | 'invalid';

/**
 * Distinguishes sourced product data from the illustrative sample dataset used by this preview
 * build. Every value the sample adapter produces carries `illustrative`.
 */
export type DataState = 'live' | 'illustrative';

export type SourceStatus = 'approved' | 'rights_pending' | 'illustrative';

export interface SourceRef {
	id: string;
	/** Short product-facing label; the localized wording lives in the message catalog. */
	kind: 'operator-site' | 'reference' | 'sample-conditions';
	url: string;
	status: SourceStatus;
	retrievedAt: string | null;
	license: string | null;
	note: string | null;
}

export interface Observation {
	resortId: string;
	metric: MetricKey;
	value: number | SnowQuality;
	unit: string | null;
	observedAt: string;
	fetchedAt: string;
	validUntil: string | null;
	validationState: ValidationState;
	confidence: Confidence;
	dataState: DataState;
	sourceId: string;
}

export interface WeatherStation {
	id: string;
	/** Product-facing station label; sample stations are labelled as such. */
	name: string;
	distanceKm: number;
}

export interface WeatherObservation extends Observation {
	metric: WeatherMetricKey;
	value: number;
}

/** A forecast is never presented as an observation (domain model). */
export interface ForecastPoint {
	date: string;
	tempMinC: number | null;
	tempMaxC: number | null;
	snowCm: number | null;
	windMs: number | null;
	precipitationMm: number | null;
}

export interface ForecastSeries {
	resortId: string;
	issuedAt: string;
	points: ForecastPoint[];
	sourceId: string;
	dataState: DataState;
}

export type FactVerification = 'reference' | 'operator-claim' | 'unverified';

export interface ResortFact {
	key: 'elevation' | 'vertical' | 'pistes' | 'piste_km' | 'lifts' | 'season';
	value: number | null;
	unit: string | null;
	sourceIds: string[];
	verification: FactVerification;
	note: string | null;
}

export interface ResortTranslation {
	locale: Locale;
	name: string;
	region: string;
	municipality: string;
	summary: string;
}

export interface ResortCoordinates {
	lat: number;
	lon: number;
	elevationM: number | null;
}

export interface Resort {
	id: string;
	country: Country;
	coordinates: ResortCoordinates;
	elevations: {
		baseM: number | null;
		topM: number | null;
		verticalM: number | null;
	};
	terrain: {
		pistes: number | null;
		pisteKm: number | null;
		lifts: number | null;
	};
	season: {
		opensMonth: number | null;
		closesMonth: number | null;
	};
	officialSite: string | null;
	facts: ResortFact[];
	sources: SourceRef[];
	translations: Record<Locale, ResortTranslation>;
}

export interface ResortConditions {
	resortId: string;
	observations: Observation[];
	weather: WeatherObservation[];
	station: WeatherStation | null;
	forecast: ForecastSeries;
	/** Latest `fetchedAt` across usable observations, or null when nothing has been collected. */
	lastUpdated: string | null;
	dataState: DataState;
}

export type RatingCategory =
	'atmosphere' | 'slopes' | 'lifts' | 'offpiste' | 'accommodation' | 'food' | 'apres';

export type ScoreBand = 'excellent' | 'good' | 'fair' | 'poor';

export interface ScoreInputView {
	/** Configuration id of the input (e.g. `snow_depth`). */
	id: string;
	/** Message-catalog key for the localized input label. */
	labelKey: string;
	metric: MetricKey;
	weight: number;
	normalized: number | null;
	contribution: number | null;
	raw: number | SnowQuality | null;
	unit: string | null;
	missing: boolean;
}

export interface ConditionsScoreView {
	version: string;
	resortId: string;
	score: number | null;
	band: ScoreBand | null;
	coverage: number;
	partial: boolean;
	computedAt: string;
	freshness: FreshnessState;
	confidence: Confidence;
	inputs: ScoreInputView[];
	missingMetrics: MetricKey[];
}

export interface RatingCategoryView {
	category: RatingCategory;
	value: number;
	weight: number;
	contribution: number;
}

export interface ResortRatingView {
	version: string;
	resortId: string;
	scaleMax: number;
	overall: number | null;
	coverage: number;
	categories: RatingCategoryView[];
	dataState: DataState;
}

export type RepositoryResult<T> =
	| { ok: true; value: T }
	| { ok: false; reason: 'not_found' | 'unavailable' | 'invalid' | 'rights_blocked' };
