/**
 * Snow quality ("lumen laatu") estimate.
 *
 * Models the user's target: dry cold powder that wind and temperature swings have not
 * yet beaten into wind slabs or melt-freeze crusts ("korpuset"). We cannot observe the
 * snowpack itself in the pilot, so this is a weather-driven proxy: fresh low-density
 * snow gains value, while melting air and strong wind drain it hour by hour.
 *
 * Rules (one point of snow is tracked through its "history"):
 * - Each hour adds its snowfall (mm ≈ cm of depth estimate) to the fresh snow reserve.
 * - An hour with mean temp <= -5 °C does nothing to the reserve (nothing densifies).
 * - Warm hours (temp > 0 °C) convert a share of the reserve into crust/slush; each
 *   melt-hour also hardens the remainder (frozen crust after refreeze).
 * - Hours with wind > 8 m/s beat and pack the fresh snow, turning it into wind slab;
 *   above 12 m/s the loss is much faster.
 * - Long cold, dry spells slowly age the snow (settlement), but keep it dry.
 */

export interface SnowQualityInput {
	/** Hourly observations/forecast points, oldest first, covering the recent days. */
	readonly points: readonly SnowQualityPoint[];
}

export interface SnowQualityPoint {
	readonly validAt: string;
	readonly airTemperatureC: number | null;
	readonly windSpeedMs: number | null;
	readonly snowfallMm: number | null;
	readonly precipitationMm: number | null;
	readonly snowDepthCm: number | null;
}

export type SnowQualityLabel =
	| 'fresh-powder'
	| 'dry-preserved'
	| 'moist-settled'
	| 'crusted'
	| 'no-snow';

export interface SnowQualityResult {
	/** 0–100; 100 = untouched cold powder, 0 = no usable snow. */
	readonly score: number;
	readonly label: SnowQualityLabel;
	/** Hours of continuous fresh-snow gain in the newest snowfall episode. */
	readonly freshSnowFallenMm: number;
	/** Depth of the tracked modelled snow reserve (cm approximation). */
	readonly reserveDepthCm: number;
}

/** Wind speed (m/s) at which fresh snow starts compacting into wind slab. */
const WIND_CRUST_THRESHOLD_MS = 8;
/** Wind speed above which compaction is severe. */
const WIND_STRONG_THRESHOLD_MS = 12;
/** Mean air temperature (°C) above which snow starts to melt. */
const MELT_THRESHOLD_C = 0;
/** Temperature below which snow is unambiguously cold and dry. */
const DRY_COLD_THRESHOLD_C = -5;
/** Per-hour decay of the fresh reserve during plain cold settlement. */
const COLD_SETTLE_FRACTION_PER_HOUR = 0.01;
/** Per-hour share melted away when air is above freezing. */
const MELT_FRACTION_PER_HOUR = 0.12;
/** Per-hour share lost to strong wind packing. */
const WIND_PACK_FRACTION_PER_HOUR = 0.08;
/** Per-hour share lost to moderate wind packing. */
const WIND_STRONG_PACK_FRACTION_PER_HOUR = 0.18;

export function computeSnowQuality(input: SnowQualityInput): SnowQualityResult {
	let reserveMm = 0; // modelled fresh-snow reserve (mm water ~ cm depth)
	let freshEpisodeMm = 0;
	let crustPenalty = 0; // 0..100 accumulates melt/wind damage history
	let sawWarmHour = false;
	let sawStrongWind = false;

	for (const point of input.points) {
		const snowfall = point.snowfallMm ?? 0;
		const temp = point.airTemperatureC;
		const wind = point.windSpeedMs;

		// Fresh snow adds to the reserve (falls as snow also slightly above 0 °C).
		if (snowfall > 0 && temp !== null && temp <= 0.5) {
			reserveMm += snowfall;
			freshEpisodeMm += snowfall;
		}
		if (temp !== null && temp > MELT_THRESHOLD_C) {
			sawWarmHour = true;
			reserveMm *= 1 - MELT_FRACTION_PER_HOUR;
			crustPenalty = Math.min(100, crustPenalty + 8);
		}
		if (wind !== null && wind > WIND_CRUST_THRESHOLD_MS) {
			if (wind > WIND_STRONG_THRESHOLD_MS) {
				sawStrongWind = true;
				reserveMm *= 1 - WIND_STRONG_PACK_FRACTION_PER_HOUR;
				crustPenalty = Math.min(100, crustPenalty + 5);
			} else {
				reserveMm *= 1 - WIND_PACK_FRACTION_PER_HOUR;
				crustPenalty = Math.min(100, crustPenalty + 2);
			}
		}
		if (temp !== null && temp < DRY_COLD_THRESHOLD_C && snowfall === 0 && (wind ?? 0) <= WIND_CRUST_THRESHOLD_MS) {
			// Dry, calm and cold: pure preservation, minor settlement only.
			reserveMm *= 1 - COLD_SETTLE_FRACTION_PER_HOUR;
			if (crustPenalty > 0) crustPenalty = Math.max(0, crustPenalty - 0.5);
		}
	}

	if (reserveMm < 0.5) {
		return { score: 0, label: 'no-snow', freshSnowFallenMm: round1(freshEpisodeMm), reserveDepthCm: 0 };
	}

	// Score: reserve volume relative to a 30 mm (=30 cm) reference, minus damage history.
	const volumePart = Math.min(50, (reserveMm / 30) * 50);
	const qualityPart = Math.max(0, 50 - crustPenalty * 0.5);
	const score = Math.round(volumePart + qualityPart);

	let label: SnowQualityLabel;
	if (freshEpisodeMm > 2 && !sawWarmHour && !sawStrongWind && score >= 70) label = 'fresh-powder';
	else if (!sawWarmHour && score >= 55) label = 'dry-preserved';
	else if (sawWarmHour && reserveMm >= 1) label = 'moist-settled';
	else if (sawStrongWind || sawWarmHour) label = 'crusted';
	else label = 'dry-preserved';

	return { score, label, freshSnowFallenMm: round1(freshEpisodeMm), reserveDepthCm: round1(reserveMm) };
}

function round1(value: number): number {
	return Number(value.toFixed(1));
}