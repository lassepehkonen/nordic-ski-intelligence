/**
 * Public barrel for the scoring domain layer (server-only, pure).
 */
export {
	CONDITIONS_SCORE_VERSIONS,
	RESORT_RATING_VERSIONS,
	CONDITIONS_SCORE_ACTIVE_VERSION_ID,
	RESORT_RATING_ACTIVE_VERSION_ID,
	ScoringConfigError,
	resolveConditionsScoreConfig,
	resolveResortRatingConfig,
	validateConfig,
	validateConditionsScoreConfig,
	validateResortRatingConfig
} from './config.js';
export type {
	ConditionsComponentConfig,
	ConditionsScoreConfig,
	LinearBandPoint,
	CategoricalNormalization,
	PiecewiseLinearNormalization,
	ClipRange,
	PlausibleRange,
	NormalizationSpec,
	ResortRatingCategoryConfig,
	ResortRatingConfig,
	ScoreComputationScale,
	ScoringGates
} from './config.js';
export { computeConditionsScore } from './conditions-score.js';
export { computeResortRating, listResortRatingCategories } from './resort-rating.js';
export { mapPilotResortToConditionsScoreInputs, forecastSnowfallCm } from './pilot-inputs.js';
export {
	CONDITIONS_COMPONENT_IDS,
	RESORT_RATING_CATEGORY_IDS,
	SNOW_QUALITY_VALUES
} from './types.js';
export type {
	CategoricalComponentInput,
	ConditionsComponentId,
	ConditionsScoreComponentResult,
	ConditionsScoreCoverage,
	ConditionsScoreExplanation,
	ConditionsScoreInputs,
	ConditionsScoreResult,
	NumericComponentInput,
	RatioComponentInput,
	ResortRatingCategoryResult,
	ResortRatingCategoryId,
	ResortRatingCoverage,
	ResortRatingExplanation,
	ResortRatingInputCategoryValues,
	ResortRatingResult,
	ScoreDirection,
	ScoringComponentStatus,
	ScoringComputeOptions,
	ScoringExplanationMessage,
	ScoringFreshnessState,
	SnowQuality
} from './types.js';
