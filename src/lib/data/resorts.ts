/**
 * Curated resort dataset for the preview slice: ten resorts in Finland, Sweden and Norway.
 *
 * Identity, coordinates, advertised piste/lift figures and elevations are carried from the
 * reference sources recorded per resort (see `sources.ts`); they are attributed claims, not
 * normalized league-table truth, and a value that could not be sourced is `null` rather than a
 * guess. Dynamic conditions, weather and forecasts are *not* here: they come from the conditions
 * repository, which marks them as illustrative sample data.
 */

import type { Resort } from '../domain/types.js';
import { operatorSiteSource, wikipediaSource } from './sources.js';

const FENNOSCANDIAN_SEASON = {
	opensMonth: null,
	closesMonth: null
} as const;

export const RESORTS: readonly Resort[] = [
	{
		id: 'levi',
		country: 'FI',
		coordinates: { lat: 67.805, lon: 24.802, elevationM: null },
		elevations: { baseM: 206, topM: 531, verticalM: 325 },
		terrain: { pistes: 43, pisteKm: null, lifts: 26 },
		season: FENNOSCANDIAN_SEASON,
		officialSite: 'https://www.levi.fi/',
		facts: [
			{
				key: 'vertical',
				value: 325,
				unit: 'm',
				sourceIds: ['wikipedia-en-levi'],
				verification: 'reference',
				note: null
			},
			{
				key: 'elevation',
				value: 531,
				unit: 'm',
				sourceIds: ['wikipedia-en-levi'],
				verification: 'reference',
				note: 'Summit elevation; base 206 m.'
			},
			{
				key: 'pistes',
				value: 43,
				unit: null,
				sourceIds: ['wikipedia-en-levi', 'wikipedia-fi-fi-resorts'],
				verification: 'reference',
				note: 'Both sources agree on 43 pistes.'
			},
			{
				key: 'lifts',
				value: 26,
				unit: null,
				sourceIds: ['wikipedia-fi-fi-resorts'],
				verification: 'reference',
				note: 'The English ski-area article lists 27 lifts; the Finnish table lists 26.'
			},
			{
				key: 'piste_km',
				value: null,
				unit: 'km',
				sourceIds: [],
				verification: 'unverified',
				note: 'Not reported by the sources used; the Finnish table lists cross-country trail kilometres only.'
			}
		],
		sources: [
			operatorSiteSource('levi', 'https://www.levi.fi/'),
			wikipediaSource('wikipedia-en-levi', 'https://en.wikipedia.org/wiki/Levi,_Finland', 'en'),
			wikipediaSource(
				'wikipedia-fi-fi-resorts',
				'https://fi.wikipedia.org/wiki/Talviurheilukeskus',
				'fi',
				'Finnish table of winter sports centres: pistes, lifts, trail kilometres and bed places.'
			)
		],
		translations: {
			fi: {
				locale: 'fi',
				name: 'Levi',
				region: 'Lappi',
				municipality: 'Kittilä',
				summary: '43 rinnettä ja 26 hissiä Levin tunturissa Kittilän yläpuolella, pudotus 325 m.'
			},
			en: {
				locale: 'en',
				name: 'Levi',
				region: 'Lapland',
				municipality: 'Kittilä',
				summary:
					'43 pistes and 26 lifts on the Levi fell above Kittilä, with a 325 m vertical drop.'
			},
			sv: {
				locale: 'sv',
				name: 'Levi',
				region: 'Lappland',
				municipality: 'Kittilä',
				summary: '43 pister och 26 liftar på Levis fjäll ovanför Kittilä, med 325 m fallhöjd.'
			},
			no: {
				locale: 'no',
				name: 'Levi',
				region: 'Lappland',
				municipality: 'Kittilä',
				summary: '43 løyper og 26 heiser på Levifjellet over Kittilä, med 325 m høydeforskjell.'
			}
		}
	},
	{
		id: 'yllas',
		country: 'FI',
		coordinates: { lat: 67.5644, lon: 24.2244, elevationM: 718 },
		elevations: { baseM: null, topM: null, verticalM: null },
		terrain: { pistes: 63, pisteKm: null, lifts: 29 },
		season: FENNOSCANDIAN_SEASON,
		officialSite: 'https://www.yllas.fi/',
		facts: [
			{
				key: 'elevation',
				value: 718,
				unit: 'm',
				sourceIds: ['wikipedia-en-yllas'],
				verification: 'reference',
				note: 'Yllästunturi summit elevation; base and top lift elevations are not reported.'
			},
			{
				key: 'pistes',
				value: 63,
				unit: null,
				sourceIds: ['wikipedia-fi-fi-resorts'],
				verification: 'reference',
				note: null
			},
			{
				key: 'lifts',
				value: 29,
				unit: null,
				sourceIds: ['wikipedia-fi-fi-resorts'],
				verification: 'reference',
				note: null
			},
			{
				key: 'vertical',
				value: null,
				unit: 'm',
				sourceIds: [],
				verification: 'unverified',
				note: 'Not reported by the sources used.'
			}
		],
		sources: [
			operatorSiteSource('yllas', 'https://www.yllas.fi/'),
			wikipediaSource('wikipedia-en-yllas', 'https://en.wikipedia.org/wiki/Yll%C3%A4s', 'en'),
			wikipediaSource(
				'wikipedia-fi-fi-resorts',
				'https://fi.wikipedia.org/wiki/Talviurheilukeskus',
				'fi'
			)
		],
		translations: {
			fi: {
				locale: 'fi',
				name: 'Ylläs',
				region: 'Lappi',
				municipality: 'Kolari',
				summary:
					'63 rinnettä ja 29 hissiä Äkäslompolon ja Ylläsjärven välissä, tunturit kohoavat 718 metriin.'
			},
			en: {
				locale: 'en',
				name: 'Ylläs',
				region: 'Lapland',
				municipality: 'Kolari',
				summary:
					'63 pistes and 29 lifts between Äkäslompolo and Ylläsjärvi, on fells rising to 718 m.'
			},
			sv: {
				locale: 'sv',
				name: 'Ylläs',
				region: 'Lappland',
				municipality: 'Kolari',
				summary: '63 pister och 29 liftar mellan Äkäslompolo och Ylläsjärvi, fjällen når 718 m.'
			},
			no: {
				locale: 'no',
				name: 'Ylläs',
				region: 'Lappland',
				municipality: 'Kolari',
				summary: '63 løyper og 29 heiser mellom Äkäslompolo og Ylläsjärvi, fjellene når 718 moh.'
			}
		}
	},
	{
		id: 'ruka',
		country: 'FI',
		coordinates: { lat: 66.17, lon: 29.146, elevationM: null },
		elevations: { baseM: null, topM: null, verticalM: null },
		terrain: { pistes: 39, pisteKm: null, lifts: 22 },
		season: FENNOSCANDIAN_SEASON,
		officialSite: 'https://www.ruka.fi/',
		facts: [
			{
				key: 'pistes',
				value: 39,
				unit: null,
				sourceIds: ['wikipedia-fi-fi-resorts'],
				verification: 'reference',
				note: null
			},
			{
				key: 'lifts',
				value: 22,
				unit: null,
				sourceIds: ['wikipedia-fi-fi-resorts'],
				verification: 'reference',
				note: null
			},
			{
				key: 'piste_km',
				value: null,
				unit: 'km',
				sourceIds: [],
				verification: 'unverified',
				note: 'Not reported by the sources used.'
			}
		],
		sources: [
			operatorSiteSource('ruka', 'https://www.ruka.fi/'),
			wikipediaSource(
				'wikipedia-en-ruka',
				'https://en.wikipedia.org/wiki/Rukatunturi',
				'en',
				'Coordinates and fell identity.'
			),
			wikipediaSource(
				'wikipedia-fi-fi-resorts',
				'https://fi.wikipedia.org/wiki/Talviurheilukeskus',
				'fi'
			)
		],
		translations: {
			fi: {
				locale: 'fi',
				name: 'Ruka',
				region: 'Koillismaa',
				municipality: 'Kuusamo',
				summary: '39 rinnettä ja 22 hissiä Rukan tunturissa, ympäristössä 506 km latuja.'
			},
			en: {
				locale: 'en',
				name: 'Ruka',
				region: 'Koillismaa',
				municipality: 'Kuusamo',
				summary:
					'39 pistes and 22 lifts on Ruka fell, with 506 km of cross-country trails in the area.'
			},
			sv: {
				locale: 'sv',
				name: 'Ruka',
				region: 'Koillismaa',
				municipality: 'Kuusamo',
				summary: '39 pister och 22 liftar på Rukatunturi, med 506 km längdskidspår i området.'
			},
			no: {
				locale: 'no',
				name: 'Ruka',
				region: 'Koillismaa',
				municipality: 'Kuusamo',
				summary: '39 løyper og 22 heiser på Rukafjellet, med 506 km langrennsløyper i området.'
			}
		}
	},
	{
		id: 'tahko',
		country: 'FI',
		coordinates: { lat: 63.2899, lon: 28.0405, elevationM: null },
		elevations: { baseM: null, topM: null, verticalM: null },
		terrain: { pistes: 24, pisteKm: null, lifts: 15 },
		season: FENNOSCANDIAN_SEASON,
		officialSite: 'https://www.tahko.com/',
		facts: [
			{
				key: 'pistes',
				value: 24,
				unit: null,
				sourceIds: ['wikipedia-fi-fi-resorts'],
				verification: 'reference',
				note: null
			},
			{
				key: 'lifts',
				value: 15,
				unit: null,
				sourceIds: ['wikipedia-fi-fi-resorts'],
				verification: 'reference',
				note: null
			},
			{
				key: 'vertical',
				value: null,
				unit: 'm',
				sourceIds: [],
				verification: 'unverified',
				note: 'Not reported by the sources used.'
			}
		],
		sources: [
			operatorSiteSource('tahko', 'https://www.tahko.com/'),
			wikipediaSource('wikipedia-en-tahko', 'https://en.wikipedia.org/wiki/Tahkovuori', 'en'),
			wikipediaSource(
				'wikipedia-fi-fi-resorts',
				'https://fi.wikipedia.org/wiki/Talviurheilukeskus',
				'fi'
			)
		],
		translations: {
			fi: {
				locale: 'fi',
				name: 'Tahko',
				region: 'Pohjois-Savo',
				municipality: 'Kuopio',
				summary: '24 rinnettä ja 15 hissiä Tahkovuorella Kuopion lähellä, 52 km latuja.'
			},
			en: {
				locale: 'en',
				name: 'Tahko',
				region: 'North Savo',
				municipality: 'Kuopio',
				summary:
					'24 pistes and 15 lifts on Tahkovuori near Kuopio, with 52 km of cross-country trails.'
			},
			sv: {
				locale: 'sv',
				name: 'Tahko',
				region: 'Norra Savolax',
				municipality: 'Kuopio',
				summary: '24 pister och 15 liftar på Tahkovuori nära Kuopio, med 52 km längdskidspår.'
			},
			no: {
				locale: 'no',
				name: 'Tahko',
				region: 'Nord-Savo',
				municipality: 'Kuopio',
				summary: '24 løyper og 15 heiser på Tahkovuori nær Kuopio, med 52 km langrennsløyper.'
			}
		}
	},
	{
		id: 'are',
		country: 'SE',
		coordinates: { lat: 63.415, lon: 13.062, elevationM: null },
		elevations: { baseM: 390, topM: 1420, verticalM: 1030 },
		terrain: { pistes: 89, pisteKm: 101, lifts: 42 },
		season: FENNOSCANDIAN_SEASON,
		officialSite: 'https://www.skistar.com/sv/are/',
		facts: [
			{
				key: 'vertical',
				value: 1030,
				unit: 'm',
				sourceIds: ['wikipedia-en-are'],
				verification: 'reference',
				note: '870 m of the vertical drop is lift-served according to the same article.'
			},
			{
				key: 'elevation',
				value: 1420,
				unit: 'm',
				sourceIds: ['wikipedia-en-are'],
				verification: 'reference',
				note: 'Summit elevation; base 390 m.'
			},
			{
				key: 'pistes',
				value: 89,
				unit: null,
				sourceIds: ['wikipedia-sv-skistar'],
				verification: 'operator-claim',
				note: 'Operator table value. The English ski-area article lists 112 pistes for a wider area definition.'
			},
			{
				key: 'piste_km',
				value: 101,
				unit: 'km',
				sourceIds: ['wikipedia-sv-skistar'],
				verification: 'operator-claim',
				note: null
			},
			{
				key: 'lifts',
				value: 42,
				unit: null,
				sourceIds: ['wikipedia-sv-skistar'],
				verification: 'operator-claim',
				note: 'Operator table value; the English ski-area article lists 46 lifts.'
			}
		],
		sources: [
			operatorSiteSource('are', 'https://www.skistar.com/sv/are/'),
			wikipediaSource(
				'wikipedia-en-are',
				'https://en.wikipedia.org/wiki/%C3%85re_ski_resort',
				'en'
			),
			wikipediaSource(
				'wikipedia-sv-skistar',
				'https://sv.wikipedia.org/wiki/Skistar',
				'sv',
				'Operator-advertised lift, piste and piste-kilometre table for the Skistar destinations.'
			)
		],
		translations: {
			fi: {
				locale: 'fi',
				name: 'Åre',
				region: 'Jämtland',
				municipality: 'Åre',
				summary: '89 rinnettä, 42 hissiä ja 1030 metrin pudotus Åren kylästä 1420 metrin huipulle.'
			},
			en: {
				locale: 'en',
				name: 'Åre',
				region: 'Jämtland',
				municipality: 'Åre',
				summary:
					'89 pistes, 42 lifts and a 1030 m vertical drop, from Åre village up to the 1420 m summit.'
			},
			sv: {
				locale: 'sv',
				name: 'Åre',
				region: 'Jämtland',
				municipality: 'Åre',
				summary: '89 pister, 42 liftar och 1030 m fallhöjd, från Åre by upp till toppen på 1420 m.'
			},
			no: {
				locale: 'no',
				name: 'Åre',
				region: 'Jämtland',
				municipality: 'Åre',
				summary:
					'89 løyper, 42 heiser og 1030 m høydeforskjell, fra Åre by og opp til toppen på 1420 moh.'
			}
		}
	},
	{
		id: 'salen',
		country: 'SE',
		coordinates: { lat: 61.1558, lon: 13.2681, elevationM: null },
		elevations: { baseM: null, topM: null, verticalM: null },
		terrain: { pistes: 102, pisteKm: 87, lifts: 87 },
		season: FENNOSCANDIAN_SEASON,
		officialSite: 'https://www.skistar.com/sv/salen/',
		facts: [
			{
				key: 'pistes',
				value: 102,
				unit: null,
				sourceIds: ['wikipedia-sv-skistar'],
				verification: 'operator-claim',
				note: 'Aggregated over the Sälen villages (Lindvallen/Högfjället and Tandådalen/Hundfjället).'
			},
			{
				key: 'piste_km',
				value: 87,
				unit: 'km',
				sourceIds: ['wikipedia-sv-skistar'],
				verification: 'operator-claim',
				note: null
			},
			{
				key: 'lifts',
				value: 87,
				unit: null,
				sourceIds: ['wikipedia-sv-skistar'],
				verification: 'operator-claim',
				note: null
			},
			{
				key: 'vertical',
				value: null,
				unit: 'm',
				sourceIds: [],
				verification: 'unverified',
				note: 'Not reported by the sources used.'
			}
		],
		sources: [
			operatorSiteSource('salen', 'https://www.skistar.com/sv/salen/'),
			wikipediaSource('wikipedia-sv-salen', 'https://sv.wikipedia.org/wiki/S%C3%A4len', 'sv'),
			wikipediaSource(
				'wikipedia-sv-skistar',
				'https://sv.wikipedia.org/wiki/Skistar',
				'sv',
				'Operator-advertised lift, piste and piste-kilometre table for the Skistar destinations.'
			)
		],
		translations: {
			fi: {
				locale: 'fi',
				name: 'Sälen',
				region: 'Dalarna',
				municipality: 'Malung-Sälen',
				summary: '102 rinnettä ja 87 hissiä Sälenin kylien alueella, rinteitä 87 km.'
			},
			en: {
				locale: 'en',
				name: 'Sälen',
				region: 'Dalarna',
				municipality: 'Malung-Sälen',
				summary: '102 pistes and 87 lifts across the Sälen villages, with 87 km of pistes.'
			},
			sv: {
				locale: 'sv',
				name: 'Sälen',
				region: 'Dalarna',
				municipality: 'Malung-Sälen',
				summary: '102 pister och 87 liftar fördelade på Sälenbyarna, med 87 km pist.'
			},
			no: {
				locale: 'no',
				name: 'Sälen',
				region: 'Dalarna',
				municipality: 'Malung-Sälen',
				summary: '102 løyper og 87 heiser fordelt på Sälen-bygdene, med 87 km løyper.'
			}
		}
	},
	{
		id: 'vemdalen',
		country: 'SE',
		coordinates: { lat: 62.4489, lon: 13.8606, elevationM: null },
		elevations: { baseM: null, topM: null, verticalM: null },
		terrain: { pistes: 58, pisteKm: 51, lifts: 35 },
		season: FENNOSCANDIAN_SEASON,
		officialSite: 'https://www.skistar.com/sv/vemdalen/',
		facts: [
			{
				key: 'pistes',
				value: 58,
				unit: null,
				sourceIds: ['wikipedia-sv-skistar'],
				verification: 'operator-claim',
				note: 'Aggregated over Vemdalsskalet, Björnrike and Klövsjö/Storhogna.'
			},
			{
				key: 'piste_km',
				value: 51,
				unit: 'km',
				sourceIds: ['wikipedia-sv-skistar'],
				verification: 'operator-claim',
				note: null
			},
			{
				key: 'lifts',
				value: 35,
				unit: null,
				sourceIds: ['wikipedia-sv-skistar'],
				verification: 'operator-claim',
				note: null
			}
		],
		sources: [
			operatorSiteSource('vemdalen', 'https://www.skistar.com/sv/vemdalen/'),
			wikipediaSource('wikipedia-sv-vemdalen', 'https://sv.wikipedia.org/wiki/Vemdalen', 'sv'),
			wikipediaSource(
				'wikipedia-sv-skistar',
				'https://sv.wikipedia.org/wiki/Skistar',
				'sv',
				'Operator-advertised lift, piste and piste-kilometre table for the Skistar destinations.'
			)
		],
		translations: {
			fi: {
				locale: 'fi',
				name: 'Vemdalen',
				region: 'Härjedalen',
				municipality: 'Härjedalen',
				summary:
					'58 rinnettä ja 35 hissiä Vemdalsskaletin, Björnriken ja Klövsjön/Storhognan alueella, rinteitä 51 km.'
			},
			en: {
				locale: 'en',
				name: 'Vemdalen',
				region: 'Härjedalen',
				municipality: 'Härjedalen',
				summary:
					'58 pistes and 35 lifts across Vemdalsskalet, Björnrike and Klövsjö/Storhogna, with 51 km of pistes.'
			},
			sv: {
				locale: 'sv',
				name: 'Vemdalen',
				region: 'Härjedalen',
				municipality: 'Härjedalen',
				summary:
					'58 pister och 35 liftar i Vemdalsskalet, Björnrike och Klövsjö/Storhogna, med 51 km pist.'
			},
			no: {
				locale: 'no',
				name: 'Vemdalen',
				region: 'Härjedalen',
				municipality: 'Härjedalen',
				summary:
					'58 løyper og 35 heiser i Vemdalsskalet, Björnrike og Klövsjö/Storhogna, med 51 km løyper.'
			}
		}
	},
	{
		id: 'trysil',
		country: 'NO',
		coordinates: { lat: 61.31, lon: 12.315, elevationM: null },
		elevations: { baseM: null, topM: null, verticalM: null },
		terrain: { pistes: 68, pisteKm: 76, lifts: 31 },
		season: FENNOSCANDIAN_SEASON,
		officialSite: 'https://www.skistar.com/no/trysil/',
		facts: [
			{
				key: 'pistes',
				value: 68,
				unit: null,
				sourceIds: ['wikipedia-sv-skistar'],
				verification: 'operator-claim',
				note: null
			},
			{
				key: 'piste_km',
				value: 76,
				unit: 'km',
				sourceIds: ['wikipedia-sv-skistar'],
				verification: 'operator-claim',
				note: null
			},
			{
				key: 'lifts',
				value: 31,
				unit: null,
				sourceIds: ['wikipedia-sv-skistar'],
				verification: 'operator-claim',
				note: null
			}
		],
		sources: [
			operatorSiteSource('trysil', 'https://www.skistar.com/no/trysil/'),
			wikipediaSource('wikipedia-en-trysil', 'https://en.wikipedia.org/wiki/Trysil', 'en'),
			wikipediaSource(
				'wikipedia-sv-skistar',
				'https://sv.wikipedia.org/wiki/Skistar',
				'sv',
				'Operator-advertised lift, piste and piste-kilometre table for the Skistar destinations.'
			)
		],
		translations: {
			fi: {
				locale: 'fi',
				name: 'Trysil',
				region: 'Innlandet',
				municipality: 'Trysil',
				summary: '68 rinnettä ja 31 hissiä Trysilfjelletillä, rinteitä 76 km ja maastoa kaikille.'
			},
			en: {
				locale: 'en',
				name: 'Trysil',
				region: 'Innlandet',
				municipality: 'Trysil',
				summary:
					'68 pistes and 31 lifts on Trysilfjellet, with 76 km of pistes and terrain for every level.'
			},
			sv: {
				locale: 'sv',
				name: 'Trysil',
				region: 'Innlandet',
				municipality: 'Trysil',
				summary:
					'68 pister och 31 liftar på Trysilfjellet, med 76 km pist och terräng för alla nivåer.'
			},
			no: {
				locale: 'no',
				name: 'Trysil',
				region: 'Innlandet',
				municipality: 'Trysil',
				summary:
					'68 løyper og 31 heiser på Trysilfjellet, med 76 km løyper og terreng for alle nivåer.'
			}
		}
	},
	{
		id: 'hemsedal',
		country: 'NO',
		coordinates: { lat: 60.9058, lon: 8.5147, elevationM: null },
		elevations: { baseM: null, topM: null, verticalM: null },
		terrain: { pistes: 50, pisteKm: 46, lifts: 20 },
		season: FENNOSCANDIAN_SEASON,
		officialSite: 'https://www.skistar.com/no/hemsedal/',
		facts: [
			{
				key: 'pistes',
				value: 50,
				unit: null,
				sourceIds: ['wikipedia-sv-skistar'],
				verification: 'operator-claim',
				note: null
			},
			{
				key: 'piste_km',
				value: 46,
				unit: 'km',
				sourceIds: ['wikipedia-sv-skistar'],
				verification: 'operator-claim',
				note: null
			},
			{
				key: 'lifts',
				value: 20,
				unit: null,
				sourceIds: ['wikipedia-sv-skistar'],
				verification: 'operator-claim',
				note: null
			}
		],
		sources: [
			operatorSiteSource('hemsedal', 'https://www.skistar.com/no/hemsedal/'),
			wikipediaSource('wikipedia-en-hemsedal', 'https://en.wikipedia.org/wiki/Hemsedal', 'en'),
			wikipediaSource(
				'wikipedia-sv-skistar',
				'https://sv.wikipedia.org/wiki/Skistar',
				'sv',
				'Operator-advertised lift, piste and piste-kilometre table for the Skistar destinations.'
			)
		],
		translations: {
			fi: {
				locale: 'fi',
				name: 'Hemsedal',
				region: 'Buskerud',
				municipality: 'Hemsedal',
				summary: '50 rinnettä ja 20 hissiä, rinneverkosto 46 km Hemsedalin kylän yläpuolella.'
			},
			en: {
				locale: 'en',
				name: 'Hemsedal',
				region: 'Buskerud',
				municipality: 'Hemsedal',
				summary: '50 pistes and 20 lifts in a 46 km piste network above Hemsedal village.'
			},
			sv: {
				locale: 'sv',
				name: 'Hemsedal',
				region: 'Buskerud',
				municipality: 'Hemsedal',
				summary: '50 pister och 20 liftar i ett 46 km pistnät ovanför Hemsedal.'
			},
			no: {
				locale: 'no',
				name: 'Hemsedal',
				region: 'Buskerud',
				municipality: 'Hemsedal',
				summary: '50 løyper og 20 heiser i et 46 km løypenett over Hemsedal.'
			}
		}
	},
	{
		id: 'hafjell',
		country: 'NO',
		coordinates: { lat: 61.231, lon: 10.5253, elevationM: null },
		elevations: { baseM: 200, topM: 1030, verticalM: 830 },
		terrain: { pistes: null, pisteKm: null, lifts: null },
		season: FENNOSCANDIAN_SEASON,
		officialSite: 'https://www.hafjell.no/',
		facts: [
			{
				key: 'vertical',
				value: 830,
				unit: 'm',
				sourceIds: ['wikipedia-en-hafjell'],
				verification: 'reference',
				note: null
			},
			{
				key: 'elevation',
				value: 1030,
				unit: 'm',
				sourceIds: ['wikipedia-en-hafjell'],
				verification: 'reference',
				note: 'Summit elevation; base 200 m.'
			},
			{
				key: 'pistes',
				value: null,
				unit: null,
				sourceIds: [],
				verification: 'unverified',
				note: 'Not reported by the sources used.'
			},
			{
				key: 'lifts',
				value: null,
				unit: null,
				sourceIds: [],
				verification: 'unverified',
				note: 'Not reported by the sources used.'
			}
		],
		sources: [
			operatorSiteSource('hafjell', 'https://www.hafjell.no/'),
			wikipediaSource('wikipedia-en-hafjell', 'https://en.wikipedia.org/wiki/Hafjell', 'en'),
			wikipediaSource('wikipedia-no-hafjell', 'https://no.wikipedia.org/wiki/Hafjell', 'no')
		],
		translations: {
			fi: {
				locale: 'fi',
				name: 'Hafjell',
				region: 'Gudbrandsdalen',
				municipality: 'Øyer',
				summary: '830 metrin pudotus 1030 metrin huipulta 200 metriin, lähellä Lillehammeria.'
			},
			en: {
				locale: 'en',
				name: 'Hafjell',
				region: 'Gudbrandsdalen',
				municipality: 'Øyer',
				summary: 'An 830 m vertical drop from the 1030 m summit down to 200 m, near Lillehammer.'
			},
			sv: {
				locale: 'sv',
				name: 'Hafjell',
				region: 'Gudbrandsdalen',
				municipality: 'Øyer',
				summary: '830 m fallhöjd från toppen på 1030 m ned till 200 m, nära Lillehammer.'
			},
			no: {
				locale: 'no',
				name: 'Hafjell',
				region: 'Gudbrandsdalen',
				municipality: 'Øyer',
				summary: '830 meter høydeforskjell fra toppen på 1030 moh ned til 200 moh, nær Lillehammer.'
			}
		}
	}
];

export function findResort(id: string): Resort | undefined {
	return RESORTS.find((resort) => resort.id === id);
}
