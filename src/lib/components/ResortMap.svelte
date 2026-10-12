<script lang="ts">
	import { bandColor } from '#lib/i18n/ui.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { MapPoint } from '#lib/presentation/map.js';
	import { onMount } from 'svelte';

	interface Props {
		points: MapPoint[];
		/** Localized link labels used inside the marker popup. */
		openLabel: string;
		compareLabel: string;
	}

	let { points, openLabel, compareLabel }: Props = $props();

	let container = $state<HTMLDivElement | null>(null);
	let map: import('leaflet').Map | null = null;
	let layer: import('leaflet').LayerGroup | null = null;
	let loadFailed = $state(false);

	function escapeHtml(value: string): string {
		return value
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function tileUrl(): string {
		const dark =
			typeof window !== 'undefined' &&
			window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
		// CARTO's light/dark base layers keep the map calm, unlike a saturated terrain style.
		return dark
			? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
			: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
	}

	onMount(() => {
		let cancelled = false;

		void (async () => {
			try {
				const [L] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
				if (cancelled || !container) return;

				map = L.map(container, { scrollWheelZoom: false });
				L.tileLayer(tileUrl(), {
					maxZoom: 18,
					attribution:
						'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
				}).addTo(map);
				layer = L.layerGroup().addTo(map);
			} catch {
				loadFailed = true;
			}
		})();

		return () => {
			cancelled = true;
			map?.remove();
			map = null;
			layer = null;
		};
	});

	/** Markers follow the filtered result set; the map is created once and reused. */
	$effect(() => {
		const currentPoints = points;
		if (!map || !layer) return;

		void (async () => {
			const L = await import('leaflet');
			layer?.clearLayers();
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
				marker.addTo(layer as import('leaflet').LayerGroup);
				bounds.extend([point.lat, point.lon]);
			}

			if (bounds.isValid()) {
				map?.fitBounds(bounds.pad(0.25), { animate: false });
			}
		})();
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
</style>
