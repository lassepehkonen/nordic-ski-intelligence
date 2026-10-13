/**
 * Product view layer (Phase 7) — joins the Phase 5 pilot read model with the Phase 6 scoring
 * domain into the DTOs the product UI renders.
 *
 * Layer rules (see docs/architecture/decisions/0003-server-api-boundary.md and docs/scoring.md):
 * - Pure: no fetch, no DB, no SvelteKit, no clock or randomness — the caller injects `now`.
 * - No user-facing prose: every reason is a stable `scoring_*` key that the i18n layer renders.
 * - Missing data stays explicit. A missing metric is `null`, never 0, and an unpublished
 *   Conditions Score stays `published: false` instead of becoming a ranking.
 */
import type { PilotProductResort, PilotProductSnapshot } from './product-repository.js';
import type { WeatherPoint } from '../weather/adapters.js';
import {
	CONDITIONS_SCORE_ACTIVE_VERSION_ID,
	RESORT_RATING_ACTIVE_VERSION_ID,
	computeConditionsScore,
	computeResortRating,
	mapPilotResortToConditionsScoreInputs,
	resolveConditionsScoreConfig,
	resolveResortRatingConfig,
	type ConditionsComponentId,
	type ResortRatingCategoryId,
	type ResortRatingInputCategoryValues,
	type ScoringComponentStatus,
	type ScoringFreshnessState
} from '../scoring/index.js';
import { timeZoneFor } from '#lib/i18n/format.js';

export type SourceKind = 'location' | 'inventory' | 'status' | 'weather' | 'snow';

/** One attributed source behind a displayed figure. */
export interface ResortSourceView {
	readonly kind: SourceKind;
	readonly url: string;
	readonly attribution: string;
}

export interface ScoreComponentView {
	readonly id: ConditionsComponentId;
	readonly weight: number;
	/** Weight share among the components that actually contributed (0 when excluded). */
	readonly shareOfWeights: number;
	readonly raw: number | string | null;
	readonly observedAt: string | null;
	readonly freshnessState: ScoringFreshnessState;
	readonly normalized: number | null;
	readonly points: number | null;
	readonly status: ScoringComponentStatus;
	/** Stable i18n reason keys, never prose. */
	readonly reasonKeys: readonly string[];
}

export interface ConditionsScoreView {
	readonly published: boolean;
	readonly score: number | null;
	readonly version: string;
	readonly computedAt: string;
	readonly coverage: {
		readonly availableComponentCount: number;
		readonly totalComponentCount: number;
		readonly availableWeightShare: number;
		readonly publishThreshold: number;
	};
	readonly gatePassed: boolean;
	readonly gateReasonKeys: readonly string[];
	readonly components: readonly ScoreComponentView[];
	readonly missingComponentIds: readonly ConditionsComponentId[];
	readonly staleComponentIds: readonly ConditionsComponentId[];
	readonly outOfRangeComponentIds: readonly ConditionsComponentId[];
	readonly warningReasonKeys: readonly string[];
}

export interface ResortRatingCategoryView {
	readonly id: ResortRatingCategoryId;
	readonly weight: number;
	/** Always null while no approved editorial scale/values exist (ADR-0009). */
	readonly value: number | null;
}

export interface ResortRatingView {
	readonly published: boolean;
	readonly rating: number | null;
	readonly version: string;
	readonly computedAt: string;
	readonly coverageShare: number;
	readonly coverageThreshold: number;
	readonly categories: readonly ResortRatingCategoryView[];
	readonly missingCategoryIds: readonly ResortRatingCategoryId[];
	readonly reasonKeys: readonly string[];
}

export interface ForecastPointView {
	readonly validAt: string;
	readonly airTemperatureC: number | null;
	readonly windSpeedMs: number | null;
	readonly windDirectionDegrees: number | null;
	readonly precipitationMm: number | null;
	readonly snowfallMm: number | null;
	readonly snowDepthCm: number | null;
	readonly precipitationPeriodHours: number | null;
}

/**
 * One day in the four-day day-by-day forecast. Temperatures are the min/max over the day's
 * hourly points; precipitation and snowfall are daily sums (null when no point reports a
 * value — unknown is not zero).
 */
export interface ForecastDayView {
	/** ISO date of the forecast day in the resort's country timezone (YYYY-MM-DD). */
	readonly date: string;
	readonly tempMinC: number | null;
	readonly tempMaxC: number | null;
	readonly precipitationMm: number | null;
	readonly snowfallMm: number | null;
	readonly windMaxMs: number | null;
	readonly windDirectionPoints: string | null;
	readonly pointCount: number;
}

export interface ResortView {
	readonly slug: string;
	readonly name: string;
	readonly countryCode: PilotProductResort['countryCode'];
	readonly region: string;
	readonly size: PilotProductResort['size'];
	readonly location: {
		readonly latitude: number;
		readonly longitude: number;
		readonly sourceUrl: string;
		readonly attribution: string;
	};
	readonly inventory: {
		readonly lifts: number | null;
		readonly pistes: number | null;
		readonly sourceUrl: string;
		readonly attribution: string;
	};
	readonly status: {
		readonly lifts: { readonly open: number | null; readonly total: number | null };
		readonly pistes: { readonly open: number | null; readonly total: number | null };
		readonly freshness: PilotProductResort['status']['freshness'];
		readonly checkedAt: string | null;
		readonly sourceUrl: string;
		readonly attribution: string;
	};
	readonly weather: {
		readonly provider: PilotProductResort['weather']['provider'];
		readonly sourceUrl: string;
		readonly attribution: string;
		readonly freshness: PilotProductResort['weather']['freshness'];
		readonly fetchedAt: string | null;
		readonly sourceUpdatedAt: string | null;
		readonly current: ForecastPointView | null;
		readonly forecast: readonly ForecastPointView[];
		/** Day-by-day forecast (up to 4 days), aggregated from hourly points. */
		readonly forecastDaily: readonly ForecastDayView[];
		/** Snowfall summed over the scoring forecast window; null when no point reports any. */
		readonly forecastSnowMm48h: number | null;
		readonly snow: {
			readonly depthCm: number | null;
			readonly recentSnowfall24hCm: number | null;
			readonly observedAt: string | null;
			readonly sourceUrl: string | null;
		};
	};
	/** Open shares as fractions in [0, 1]; null whenever the counts are unknown or zero. */
	readonly terrain: {
		readonly pistesOpenRatio: number | null;
		readonly liftsOpenRatio: number | null;
	};
	readonly score: ConditionsScoreView;
	readonly rating: ResortRatingView;
	readonly sources: readonly ResortSourceView[];
	/** Newest of the status check time and the weather retrieval time, or null. */
	readonly lastUpdated: string | null;
}

export interface ProductView {
	readonly resorts: readonly ResortView[];
	readonly lastUpdated: string | null;
	readonly lastCollectionRun: PilotProductSnapshot['lastCollectionRun'];
}

const FALLBACK_SCORE: ConditionsScoreView = Object.freeze({
	published: false,
	score: null,
	version: CONDITIONS_SCORE_ACTIVE_VERSION_ID,
	computedAt: '',
	coverage: {
		availableComponentCount: 0,
		totalComponentCount: 0,
		availableWeightShare: 0,
		publishThreshold: 1
	},
	gatePassed: false,
	gateReasonKeys: ['scoring_coverage_below_threshold'],
	components: [],
	missingComponentIds: [],
	staleComponentIds: [],
	outOfRangeComponentIds: [],
	warningReasonKeys: []
});

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function isoOrNull(value: string | null | undefined): string | null {
	if (typeof value !== 'string') return null;
	return Number.isFinite(Date.parse(value)) ? value : null;
}

function newestIso(...values: (string | null | undefined)[]): string | null {
	let newest: string | null = null;
	let newestMs = Number.NEGATIVE_INFINITY;
	for (const value of values) {
		const iso = isoOrNull(value);
		if (iso === null) continue;
		const ms = Date.parse(iso);
		if (ms > newestMs) {
			newestMs = ms;
			newest = iso;
		}
	}
	return newest;
}

function openRatio(
	open: number | null | undefined,
	total: number | null | undefined
): number | null {
	if (!isFiniteNumber(open) || !isFiniteNumber(total) || total <= 0) return null;
	if (open < 0 || open > total) return null;
	return open / total;
}

function toForecastPoint(point: WeatherPoint): ForecastPointView {
	return {
		validAt: point.validAt,
		airTemperatureC: isFiniteNumber(point.airTemperatureC) ? point.airTemperatureC : null,
		windSpeedMs: isFiniteNumber(point.windSpeedMs) ? point.windSpeedMs : null,
		windDirectionDegrees: isFiniteNumber(point.windDirectionDegrees)
			? point.windDirectionDegrees
			: null,
		precipitationMm: isFiniteNumber(point.precipitationMm) ? point.precipitationMm : null,
		snowfallMm: isFiniteNumber(point.snowfallMm) ? point.snowfallMm : null,
		snowDepthCm: isFiniteNumber(point.snowDepthCm) ? point.snowDepthCm : null,
		precipitationPeriodHours: isFiniteNumber(point.precipitationPeriodHours)
			? point.precipitationPeriodHours
			: null
	};
}

function buildConditionsScoreView(resort: PilotProductResort, now: Date): ConditionsScoreView {
	try {
		const config = resolveConditionsScoreConfig(CONDITIONS_SCORE_ACTIVE_VERSION_ID);
		const inputs = mapPilotResortToConditionsScoreInputs(resort, config.forecastWindowHours, now);
		const result = computeConditionsScore(inputs, CONDITIONS_SCORE_ACTIVE_VERSION_ID, {
			now: () => now
		});
		const explanation = result.explanation();

		return {
			published: result.published,
			score: result.score,
			version: result.version,
			computedAt: result.computedAt,
			coverage: {
				availableComponentCount: result.coverage.availableComponentCount,
				totalComponentCount: result.coverage.totalComponentCount,
				availableWeightShare: result.coverage.availableWeightShare,
				publishThreshold: result.coverage.publishThreshold
			},
			gatePassed: explanation.gate.passed,
			gateReasonKeys: [...explanation.gate.reasonKeys],
			components: result.components.map((component) => ({
				id: component.id,
				weight: component.weight,
				shareOfWeights: component.shareOfWeights,
				raw: component.input.raw,
				observedAt: component.input.observedAt,
				freshnessState: component.input.freshnessState,
				normalized: component.normalized,
				points: component.points,
				status: component.status,
				reasonKeys: component.reasons.map((reason) => reason.key)
			})),
			missingComponentIds: [...result.missingComponentIds],
			staleComponentIds: [...result.staleComponentIds],
			outOfRangeComponentIds: [...result.outOfRangeComponentIds],
			warningReasonKeys: result.warnings.map((warning) => warning.key)
		};
	} catch {
		// The scoring layer never falls back silently; the product falls back to an explicit
		// "no score published" view rather than guessing a number.
		return { ...FALLBACK_SCORE, computedAt: now.toISOString() };
	}
}

/**
 * The permanent Resort Rating is wired to the same versioned config, but no editorial values
 * exist yet (ADR-0009: the scale and assessment process are an open product decision). Without
 * values the view reports the configured categories and weights, zero coverage and the publish
 * gate reason, so the UI can explain the state instead of hiding it or inventing a number.
 *
 * Passing a non-empty `values` record switches the view to the real computation, which is how
 * the feature lights up once an approved editorial process supplies category values.
 */
export function buildResortRatingView(
	values: ResortRatingInputCategoryValues | null = null,
	now: Date = new Date()
): ResortRatingView {
	const config = resolveResortRatingConfig(RESORT_RATING_ACTIVE_VERSION_ID);
	const pendingCategories: ResortRatingCategoryView[] = config.categories.map((category) => ({
		id: category.id,
		weight: category.weight,
		value: null
	}));

	if (values === null || Object.keys(values).length === 0) {
		return {
			published: false,
			rating: null,
			version: RESORT_RATING_ACTIVE_VERSION_ID,
			computedAt: now.toISOString(),
			coverageShare: 0,
			coverageThreshold: config.gates.minimumCategoryCoverageShare,
			categories: pendingCategories,
			missingCategoryIds: pendingCategories.map((category) => category.id),
			reasonKeys: ['scoring_coverage_below_threshold']
		};
	}

	try {
		const result = computeResortRating(RESORT_RATING_ACTIVE_VERSION_ID, values, {
			now: () => now
		});
		const explanation = result.explanation();
		return {
			published: result.published,
			rating: result.rating,
			version: result.version,
			computedAt: result.computedAt,
			coverageShare: result.coverage.coverageShare,
			coverageThreshold: result.coverage.coverageThreshold,
			categories: result.categories.map((category) => ({
				id: category.id,
				weight: category.weight,
				value: category.value
			})),
			missingCategoryIds: [...result.missingCategoryIds],
			reasonKeys: [...explanation.gate.reasonKeys]
		};
	} catch {
		return {
			published: false,
			rating: null,
			version: RESORT_RATING_ACTIVE_VERSION_ID,
			computedAt: now.toISOString(),
			coverageShare: 0,
			coverageThreshold: config.gates.minimumCategoryCoverageShare,
			categories: pendingCategories,
			missingCategoryIds: pendingCategories.map((category) => category.id),
			reasonKeys: ['scoring_coverage_below_threshold']
		};
	}
}

/**
 * Snowfall summed over the forecast window, ignoring points that report nothing. Returns null
 * when no point in the window reports snowfall at all — unknown is not zero.
 */
function sumSnowfall(
	points: readonly ForecastPointView[],
	now: Date,
	windowHours: number
): number | null {
	const cutoff = now.getTime() + windowHours * 3_600_000;
	let total: number | null = null;
	for (const point of points) {
		const validAt = Date.parse(point.validAt);
		if (!Number.isFinite(validAt) || validAt > cutoff) continue;
		if (point.snowfallMm === null) continue;
		total = (total ?? 0) + point.snowfallMm;
	}
	return total;
}

/**
 * Aggregates hourly forecast points into day rows (in the resort's local timezone) for the
 * next four distinct days. Missing/null values propagate as null — unknown is not zero.
 */
function buildForecastDaily(
	points: readonly ForecastPointView[],
	countryCode: string
): ForecastDayView[] {
	const tz = timeZoneFor(countryCode);
	const formatter = new Intl.DateTimeFormat('en-CA', {
		timeZone: tz,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	});
	const byDay = new Map<string, ForecastPointView[]>();
	const today = formatter.format(new Date());
	for (const point of points) {
		const date = new Date(point.validAt);
		if (!Number.isFinite(date.getTime())) continue;
		const key = formatter.format(date);
		// Today is included as a partial-day row (points from now on); the next four
		// distinct days follow.
		byDay.set(key, [...(byDay.get(key) ?? []), point]);
	}
	return [...byDay.entries()]
		.filter(([key]) => key >= today)
		.sort(([a], [b]) => a.localeCompare(b))
		.slice(0, 5)
		.map(([date, dayPoints]) => {
			const temps = dayPoints.map((p) => p.airTemperatureC).filter((t): t is number => t !== null);
			const winds = dayPoints.map((p) => p.windSpeedMs).filter((w): w is number => w !== null);
			const precip = dayPoints.map((p) => p.precipitationMm).filter((v): v is number => v !== null);
			const snow = dayPoints.map((p) => p.snowfallMm).filter((v): v is number => v !== null);
			return {
				date,
				tempMinC: temps.length ? Math.min(...temps) : null,
				tempMaxC: temps.length ? Math.max(...temps) : null,
				precipitationMm: precip.length
					? Number(precip.reduce((a, b) => a + b, 0).toFixed(1))
					: null,
				snowfallMm: snow.length ? Number(snow.reduce((a, b) => a + b, 0).toFixed(1)) : null,
				windMaxMs: winds.length ? Math.max(...winds) : null,
				windDirectionPoints: dominantWindDirection(dayPoints),
				pointCount: dayPoints.length
			};
		});
}

/** 16-point compass labels; the vector mean rounds to the nearest of the 8 shown. */
const COMPASS_POINTS = [
	'N',
	'NNE',
	'NE',
	'ENE',
	'E',
	'ESE',
	'SE',
	'SSE',
	'S',
	'SSW',
	'SW',
	'WSW',
	'W',
	'WNW',
	'NW',
	'NNW'
] as const;

/**
 * Prevailing wind direction for a set of points: circular mean of the hourly wind
 * directions weighted by wind speed (a calm hour says nothing about direction).
 * Returns one of the 8 principal compass points, or null when no usable direction.
 */
function dominantWindDirection(points: readonly ForecastPointView[]): string | null {
	let x = 0;
	let y = 0;
	for (const point of points) {
		if (point.windDirectionDegrees === null || point.windSpeedMs === null) continue;
		if (point.windSpeedMs <= 0) continue;
		const radians = (point.windDirectionDegrees * Math.PI) / 180;
		x += point.windSpeedMs * Math.cos(radians);
		y += point.windSpeedMs * Math.sin(radians);
	}
	if (x === 0 && y === 0) return null;
	const degrees = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
	const index = Math.round(degrees / 45) % 8;
	return COMPASS_POINTS[index * 2];
}

/**
 * Latest point-reported snow depth in centimetres, or null when no point reports a usable
 * value. Used as the fallback whenever the dedicated snow source has no depth.
 */
function forecastSnowDepthCm(points: readonly ForecastPointView[]): number | null {
	for (let index = points.length - 1; index >= 0; index -= 1) {
		const point = points[index];
		if (point && isFiniteNumber(point.snowDepthCm)) {
			return point.snowDepthCm;
		}
	}
	return null;
}

function collectSources(resort: PilotProductResort): ResortSourceView[] {
	const sources: ResortSourceView[] = [
		{
			kind: 'location',
			url: resort.location.sourceUrl,
			attribution: resort.location.attribution
		},
		{
			kind: 'inventory',
			url: resort.inventory.sourceUrl,
			attribution: resort.inventory.attribution
		},
		{
			kind: 'status',
			url: resort.status.sourceUrl,
			attribution: resort.status.attribution
		},
		{
			kind: 'weather',
			url: resort.weather.sourceUrl,
			attribution: resort.weather.attribution
		}
	];

	if (resort.weather.snow.sourceUrl) {
		sources.push({
			kind: 'snow',
			url: resort.weather.snow.sourceUrl,
			attribution: resort.weather.attribution
		});
	}

	return sources;
}

export function buildResortView(resort: PilotProductResort, options: { now: Date }): ResortView {
	const checkedAt = isoOrNull(resort.status.checkedAt);
	const fetchedAt = isoOrNull(resort.weather.fetchedAt);
	const forecast = resort.weather.forecast.map(toForecastPoint);
	// The 48 h forecast-snow aggregate uses the same window the Conditions Score uses.
	const forecastWindowHours = resolveConditionsScoreConfig(
		CONDITIONS_SCORE_ACTIVE_VERSION_ID
	).forecastWindowHours;

	return {
		slug: resort.slug,
		name: resort.name,
		countryCode: resort.countryCode,
		region: resort.region,
		size: resort.size,
		location: {
			latitude: resort.location.latitude,
			longitude: resort.location.longitude,
			sourceUrl: resort.location.sourceUrl,
			attribution: resort.location.attribution
		},
		inventory: {
			lifts: isFiniteNumber(resort.inventory.lifts) ? resort.inventory.lifts : null,
			pistes: isFiniteNumber(resort.inventory.pistes) ? resort.inventory.pistes : null,
			sourceUrl: resort.inventory.sourceUrl,
			attribution: resort.inventory.attribution
		},
		status: {
			lifts: { open: resort.status.lifts.open, total: resort.status.lifts.total },
			pistes: { open: resort.status.pistes.open, total: resort.status.pistes.total },
			freshness: resort.status.freshness,
			checkedAt,
			sourceUrl: resort.status.sourceUrl,
			attribution: resort.status.attribution
		},
		weather: {
			provider: resort.weather.provider,
			sourceUrl: resort.weather.sourceUrl,
			attribution: resort.weather.attribution,
			freshness: resort.weather.freshness,
			fetchedAt,
			sourceUpdatedAt: isoOrNull(resort.weather.sourceUpdatedAt),
			current: resort.weather.current ? toForecastPoint(resort.weather.current) : null,
			forecast,
			forecastSnowMm48h: sumSnowfall(forecast, options.now, forecastWindowHours),
			forecastDaily: buildForecastDaily(forecast, resort.countryCode),
			snow: {
				// Dedicated snow source wins; otherwise fall back to the forecast model's own
				// snow depth (HARMONIE/SMHI/met.no all carry it in the hourly points). When the
				// fallback is used, the weather provider doubles as the data source so the snow
				// card never renders "source: not available yet".
				depthCm: isFiniteNumber(resort.weather.snow.depthCm)
					? resort.weather.snow.depthCm
					: forecastSnowDepthCm(forecast),
				recentSnowfall24hCm: isFiniteNumber(resort.weather.snow.recentSnowfall24hCm)
					? resort.weather.snow.recentSnowfall24hCm
					: null,
				observedAt: isoOrNull(resort.weather.snow.observedAt),
				sourceUrl:
					isFiniteNumber(resort.weather.snow.depthCm) || !resort.weather.snow.sourceUrl
						? (isoOrNull(resort.weather.snow.sourceUrl) ?? resort.weather.sourceUrl)
						: resort.weather.snow.sourceUrl
			}
		},
		terrain: {
			pistesOpenRatio: openRatio(resort.status.pistes.open, resort.status.pistes.total),
			liftsOpenRatio: openRatio(resort.status.lifts.open, resort.status.lifts.total)
		},
		score: buildConditionsScoreView(resort, options.now),
		rating: buildResortRatingView({}, options.now),
		sources: collectSources(resort),
		lastUpdated: newestIso(checkedAt, fetchedAt)
	};
}

export function buildProductView(
	snapshot: PilotProductSnapshot,
	options: { now: Date }
): ProductView {
	const resorts = snapshot.resorts.map((resort) => buildResortView(resort, options));

	return {
		resorts,
		lastUpdated: newestIso(...resorts.map((resort) => resort.lastUpdated)),
		lastCollectionRun: snapshot.lastCollectionRun
	};
}
