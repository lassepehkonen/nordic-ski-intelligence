<script lang="ts">
	import { onMount } from 'svelte';
	import type * as Leaflet from 'leaflet';
	import type { GeoJsonObject } from 'geojson';
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import type { ResortView } from '#lib/server/resorts/product-view.js';
	import { formatCount, countryName, scoreTone } from '#lib/i18n/format.js';
	import land from '#lib/assets/geo/nordic-land.json';
	import borders from '#lib/assets/geo/nordic-borders.json';

	/** Anchor points for the decorative country labels (lat, lon). */
	const COUNTRY_LABELS: { code: string; lat: number; lon: number }[] = [
		{ code: 'NO', lat: 61.4, lon: 8.6 },
		{ code: 'SE', lat: 63.4, lon: 16.8 },
		{ code: 'FI', lat: 64.2, lon: 27.2 }
	];

	let {
		resorts,
		locale,
		bestSlug = null
	}: { resorts: readonly ResortView[]; locale: string; bestSlug?: string | null } = $props();

	let canvas: HTMLDivElement | undefined = $state();
	let status: 'loading' | 'ready' | 'failed' = $state('loading');
	let mapReady = $state(false);

	// Leaflet instances live outside the reactive graph on purpose: they are imperative, and
	// the component owns them until it unmounts.
	let map: Leaflet.Map | null = null;
	let group: Leaflet.FeatureGroup | null = null;
	let didFit = false;

	/** Colours come from the design tokens so the map follows the light/dark scheme. */
	function tokens(): {
		accent: string;
		good: string;
		muted: string;
		land: string;
		landLine: string;
		border: string;
	} {
		const style = getComputedStyle(document.documentElement);
		const read = (name: string, fallback: string) =>
			style.getPropertyValue(name).trim() || fallback;
		return {
			accent: read('--accent', '#0d5b6b'),
			good: read('--snow', '#2c6a4c'),
			muted: read('--ink-3', '#6b7c85'),
			land: read('--map-land', '#f8faf9'),
			landLine: read('--map-land-line', '#b6c5ca'),
			border: read('--map-border', '#93a7ad')
		};
	}

	function markerLabel(resort: ResortView): string {
		const score =
			resort.score.published && resort.score.score !== null
				? String(Math.round(resort.score.score))
				: m.cardScoreNotPublished();
		return `${resort.name} — ${m.cardScoreLabel()}: ${score}`;
	}

	onMount(() => {
		let disposed = false;

		(async () => {
			try {
				const L = (await import('leaflet')).default;
				await import('leaflet/dist/leaflet.css');
				if (disposed || !canvas) return;

				const colour = tokens();
				const instance = L.map(canvas, {
					zoomControl: true,
					attributionControl: true,
					scrollWheelZoom: false,
					minZoom: 3,
					worldCopyJump: false,
					center: [64, 16],
					zoom: 4
				});

				L.geoJSON(land as unknown as GeoJsonObject, {
					attribution: m.mapAttribution(),
					interactive: false,
					style: () => ({
						color: colour.landLine,
						weight: 0.8,
						fillColor: colour.land,
						fillOpacity: 1
					})
				}).addTo(instance);

				L.geoJSON(borders as unknown as GeoJsonObject, {
					interactive: false,
					style: () => ({ color: colour.border, weight: 1, opacity: 0.7, dashArray: '2 4' })
				}).addTo(instance);

				// Country names are drawn in the active language so the map orients the visitor
				// without a tile service and without any third-party label layer.
				for (const label of COUNTRY_LABELS) {
					const element = document.createElement('span');
					element.className = 'map-country-label';
					element.textContent = countryName(label.code, locale);
					element.setAttribute('aria-hidden', 'true');
					L.marker([label.lat, label.lon], {
						interactive: false,
						icon: L.divIcon({ className: 'map-country', html: element, iconSize: [0, 0] })
					}).addTo(instance);
				}

				// Leaflet's own zoom buttons ship English titles; the product is multilingual.
				const zoomLinks = instance
					.getContainer()
					.querySelectorAll<HTMLAnchorElement>('.leaflet-control-zoom a');
				zoomLinks.forEach((link) => {
					const isZoomIn = link.classList.contains('leaflet-control-zoom-in');
					const label = isZoomIn ? m.mapZoomIn() : m.mapZoomOut();
					link.title = label;
					link.setAttribute('aria-label', label);
				});

				map = instance;
				mapReady = true;
				status = 'ready';
			} catch {
				status = 'failed';
			}
		})();

		return () => {
			disposed = true;
			mapReady = false;
			group = null;
			map?.remove();
			map = null;
		};
	});

	/** Rebuild markers whenever the filtered result set changes. */
	$effect(() => {
		const instance = mapReady ? map : null;
		const data = resorts;
		if (!instance) return;

		void (async () => {
			const L = (await import('leaflet')).default;
			if (group) instance.removeLayer(group);
			const created = L.featureGroup();
			const colour = tokens();
			const labels: { marker: Leaflet.CircleMarker; label: string }[] = [];

			for (const resort of data) {
				const tone = scoreTone(resort.score.score, resort.score.published);
				const fill =
					tone === 'good' ? colour.good : tone === 'neutral' ? colour.muted : colour.accent;
				const isBest = bestSlug !== null && resort.slug === bestSlug;
				const size = isBest ? 13 : 9;

				const marker = L.circleMarker([resort.location.latitude, resort.location.longitude], {
					radius: size,
					color: '#ffffff',
					weight: 2,
					fillColor: fill,
					fillOpacity: 1
				});

				const tooltip = document.createElement('div');
				const heading = document.createElement('strong');
				heading.textContent = resort.name;
				tooltip.append(heading);
				const detail = document.createElement('div');
				detail.textContent = `${m.cardScoreLabel()}: ${
					resort.score.published && resort.score.score !== null
						? Math.round(resort.score.score)
						: m.cardScoreNotPublished()
				} · ${m.lifts()}: ${formatCount(resort.status.lifts.open, locale)}/${formatCount(resort.status.lifts.total, locale)}`;
				tooltip.append(detail);

				const popup = document.createElement('div');
				const popupTitle = document.createElement('strong');
				popupTitle.textContent = resort.name;
				const link = document.createElement('a');
				link.href = localizeHref(`/resort/${resort.slug}`, { locale: locale as 'en' });
				link.textContent = m.cardViewResort();
				popup.append(popupTitle, document.createElement('br'), link);

				marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -8] });
				marker.bindPopup(popup);
				labels.push({ marker, label: markerLabel(resort) });
				created.addLayer(marker);
			}

			group = created;
			created.addTo(instance);

			// Leaflet paths are keyboard-focusable but unlabelled by default; give every
			// marker an accessible name in the active language.
			for (const { marker, label } of labels) {
				const element = marker.getElement();
				if (element) {
					element.setAttribute('role', 'img');
					element.setAttribute('aria-label', label);
				}
			}

			if (!didFit && data.length > 0) {
				instance.fitBounds(created.getBounds().pad(0.18), { maxZoom: 6, animate: false });
				didFit = true;
			}
		})();
	});
</script>

<div class="map-frame">
	<div class="map-canvas" bind:this={canvas} aria-label={m.homeMapTitle()} role="application"></div>

	{#if status === 'loading'}
		<p class="map-empty card small">{m.homeMapHint()}</p>
	{:else if status === 'failed'}
		<p class="map-empty card small">{m.unavailableBody()}</p>
	{:else if resorts.length === 0}
		<div class="map-empty card">
			<p><strong>{m.homeNoResultsTitle()}</strong></p>
			<p class="muted">{m.homeNoResultsBody()}</p>
		</div>
	{/if}
</div>
