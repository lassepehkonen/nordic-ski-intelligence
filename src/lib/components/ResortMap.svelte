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

	const LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
	const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
	const FALLBACK_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
	const ATTRIBUTION =
		'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

	let tileErrors = 0;

	function escapeHtml(value: string): string {
		return value
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	/** A calm base layer, matching the colour scheme; a saturated terrain style is avoided. */
	function tileUrl(): string {
		const dark =
			typeof window !== 'undefined' &&
			window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
		return dark ? DARK_TILES : LIGHT_TILES;
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

				const instance = L.map(container, { scrollWheelZoom: false });
				const tiles = L.tileLayer(tileUrl(), { maxZoom: 18, attribution: ATTRIBUTION });
				tiles.on('tileerror', () => {
					// One resilient retry against the OSM standard tiles if the calm base layer is
					// unreachable (blocked network, regional restrictions).
					tileErrors += 1;
					if (tileErrors === 3) tiles.setUrl(FALLBACK_TILES);
				});
				tiles.addTo(instance);
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
</style>
