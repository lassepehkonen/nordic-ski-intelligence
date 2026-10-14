<script lang="ts">
	import { bandColor } from '#lib/i18n/ui.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { MapPoint } from '#lib/presentation/map.js';
	import { onDestroy } from 'svelte';
	import type * as Leaflet from 'leaflet';

	interface Props {
		points: MapPoint[];
		/** Localized link labels used inside the marker popup. */
		openLabel: string;
		compareLabel: string;
	}

	let { points, openLabel, compareLabel }: Props = $props();

	let container = $state<HTMLDivElement | null>(null);
	/**
	 * `$state.raw` keeps the Leaflet instances out of the reactive proxy (they are class
	 * instances with private state) while still re-running the marker effect when they are set.
	 */
	let map = $state.raw<Leaflet.Map | null>(null);
	let markerLayer = $state.raw<Leaflet.LayerGroup | null>(null);
	let loadFailed = $state(false);

	const LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png';
	const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';
	const LIGHT_LABELS = 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png';
	const DARK_LABELS = 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png';
	const HILLSHADE_TILES =
		'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}';
	const FALLBACK_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
	const ATTRIBUTION =
		'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
	const HILLSHADE_ATTR =
		'Hillshade &copy; <a href="https://www.esri.com/">Esri</a>, Vantor, Airbus DS, USGS, NGA, NASA, CGIAR, NCEAS, NLS';

	let tileErrors = 0;

	function escapeHtml(value: string): string {
		return value
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	/** A calm base layer, matching the colour scheme; a saturated terrain style is avoided. */
	function isDark(): boolean {
		return (
			typeof window !== 'undefined' &&
			window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
		);
	}

	function tileUrl(): string {
		return isDark() ? DARK_TILES : LIGHT_TILES;
	}

	function labelUrl(): string {
		return isDark() ? DARK_LABELS : LIGHT_LABELS;
	}

	// Create the map once the container is in the DOM, then expose it as reactive state so the
	// marker effect below can run against it.
	$effect(() => {
		if (!container || map) return;
		let disposed = false;

		void (async () => {
			try {
				const L = await import('leaflet');
				await import('leaflet/dist/leaflet.css');
				if (disposed || !container || map) return;

				const tileOptions = {
					maxZoom: 18,
					attribution: ATTRIBUTION
				} as const;

				const instance = L.map(container, {
					scrollWheelZoom: 'center',
					wheelPxPerZoomLevel: 120,
					inertia: true,
					zoomSnap: 0.25,
					zoomDelta: 0.5,
					worldCopyJump: true,
					maxBounds: L.latLngBounds([-85, -720], [85, 720]),
					maxBoundsViscosity: 0.8
				});
				const tiles = L.tileLayer(tileUrl(), tileOptions);
				tiles.on('tileerror', () => {
					// One resilient retry against the OSM standard tiles if the calm base layer is
					// unreachable (blocked network, regional restrictions).
					tileErrors += 1;
					if (tileErrors === 3) tiles.setUrl(FALLBACK_TILES);
				});
				// Terrain relief behind the calm base: noticeable when zooming towards a resort,
				// blended so it does not wash out the flat basemap colours.
				const dark = isDark();
				const hillshade = L.tileLayer(HILLSHADE_TILES, {
					maxZoom: 16,
					minZoom: 3,
					attribution: HILLSHADE_ATTR,
					className: 'hillshade-layer',
					opacity: dark ? 0.35 : 0.45
				});
				// Labels live in their own pane so marker shadows and popups stay above them
				// (marker shadows are painted in Leaflet's shadowPane).
				instance.createPane('labels-pane');
				const labelsPane = instance.getPane('labels-pane');
				if (labelsPane) labelsPane.style.zIndex = '450';
				const labels = L.tileLayer(labelUrl(), {
					maxZoom: 18,
					attribution: '',
					className: 'labels-layer',
					opacity: 0.9,
					pane: 'labels-pane'
				});
				tiles.addTo(instance);
				hillshade.addTo(instance);
				labels.addTo(instance);
				instance.invalidateSize();

				markerLayer = L.layerGroup().addTo(instance);
				map = instance;
			} catch {
				loadFailed = true;
			}
		})();

		return () => {
			disposed = true;
		};
	});

	// Markers follow the filtered result set: the map is created once, the layer is redrawn.
	$effect(() => {
		const currentPoints = points;
		const layer = markerLayer;
		if (!layer) return;

		void (async () => {
			const L = await import('leaflet');
			layer.clearLayers();
			if (currentPoints.length === 0) return;

			const bounds = L.latLngBounds([]);
			for (const point of currentPoints) {
				const icon = L.divIcon({
					className: '',
					html: `<span class="map-pin" data-empty="${point.score === null}" style="--band-color: ${bandColor(point.band)}">${point.score ?? '–'}</span>`,
					iconSize: [38, 38],
					iconAnchor: [19, 19]
				});
				const marker = L.marker([point.lat, point.lon], { icon, title: point.name });
				marker.bindPopup(
					`<strong>${escapeHtml(point.name)}</strong><br />${escapeHtml(point.summary)}<br /><a href="${escapeHtml(point.href)}">${escapeHtml(openLabel)}</a> · <a href="${escapeHtml(point.compareHref)}">${escapeHtml(compareLabel)}</a>`
				);
				marker.addTo(layer);
				bounds.extend([point.lat, point.lon]);
			}

			if (bounds.isValid()) {
				map?.fitBounds(bounds.pad(0.25), { animate: false });
			}
		})();
	});

	onDestroy(() => {
		map?.remove();
		map = null;
		markerLayer = null;
	});
</script>

<div class="map-shell" bind:this={container} role="region" aria-label={m.map_title()}></div>
{#if loadFailed}
	<p class="notice small">{m.map_error()}</p>
{/if}

<style>
	/* Leaflet paints its own surfaces; keep them aligned with the token palette. */
	.map-shell :global(.leaflet-control-zoom a) {
		background: var(--surface);
		color: var(--ink);
		border-color: var(--line);
	}

	.map-shell :global(.leaflet-popup-content-wrapper),
	.map-shell :global(.leaflet-popup-tip) {
		background: var(--surface);
		color: var(--ink);
		border: 1px solid var(--line);
	}

	.map-shell :global(.leaflet-bar a:hover) {
		background: var(--surface-2);
	}

	.map-shell :global(.leaflet-control-attribution) {
		background: color-mix(in srgb, var(--surface) 88%, transparent);
	}

	/* Terrain layer blended onto the basemap; labels stay crisp on top. */
	.map-shell :global(.hillshade-layer) {
		mix-blend-mode: multiply;
	}

	.map-shell :global(.labels-layer) {
		mix-blend-mode: normal;
	}
</style>
