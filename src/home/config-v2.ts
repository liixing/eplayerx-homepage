/// <reference types="@cloudflare/workers-types" />
/**
 * Default homepage V2. Old clients keep using `/home/config` (version 1);
 * new clients should fetch `/home/config/v2`.
 *
 * Edit `createV2BlockTemplates` to change the new home layout. The decades
 * collection is resolved from D1 and dropped when the binding or row is missing.
 */

import { getCommunityBlocksByIds } from "../blocks/storage.js";
import {
	COLLECTION_PRESET,
	type CollectionBlock,
	type TmdbListRoute,
} from "../blocks/types.js";

type Locale = "en" | "zh" | "zh-Hant" | "ja" | "es" | "ar";

type HomeTitleKey =
	| "home.tmdb_popular_tv_shows"
	| "home.tmdb_popular_movies"
	| "home.popular_tv_shows"
	| "home.popular_movies"
	| "home.tmdb_discover_genres"
	| "home.classic_decades"
	| "home.tmdb_discover_networks"
	| "home.tmdb_discover_languages";

type SourceQueryValue = string | number | boolean;

interface HomePagination {
	pageParam: string;
	startPage: number;
}

interface HomeBlockSource {
	id?: string;
	path?: string;
	query?: Record<string, SourceQueryValue>;
	itemEnvelope?: "data" | "results" | "array";
	pagination?: HomePagination;
}

export interface HomeConfigV2MediaBlock {
	id: string;
	title?: string;
	mediaType?: "movie" | "tv";
	preset: string;
	showRank?: boolean;
	showOverview?: boolean;
	source?: HomeBlockSource;
	metadata?: {
		isAnime?: boolean;
	};
	route?: TmdbListRoute;
}

export type HomeConfigV2Block = HomeConfigV2MediaBlock | CollectionBlock;

type TmdbListRouteParams = TmdbListRoute["params"];

type HomeBlockTemplate = Omit<HomeConfigV2MediaBlock, "title"> & {
	titleKey?: HomeTitleKey;
};

type DecadesCollectionSlot = { type: "decades-collection" };

type V2Section = HomeBlockTemplate | DecadesCollectionSlot;

export interface HomeConfigV2Options {
	apiBaseUrl: string;
	imageBaseUrl: string;
	language: string;
	timezone: string;
	db?: D1Database;
}

export interface HomeConfigV2 {
	version: number;
	apiBaseUrl: string;
	imageBaseUrl: string;
	carouselSourceId: string;
	blocks: HomeConfigV2Block[];
}

export const HOME_CONFIG_V2_VERSION = 2;

const TITLE_TRANSLATIONS: Record<HomeTitleKey, Record<Locale, string>> = {
	"home.tmdb_popular_tv_shows": {
		en: "Today's Popular TV Shows",
		zh: "今日热门电视剧",
		"zh-Hant": "今日熱門電視劇",
		ja: "今日の人気テレビ番組",
		es: "Series de TV Populares de Hoy",
		ar: "مسلسلات شائعة",
	},
	"home.tmdb_popular_movies": {
		en: "Today's Popular Movies",
		zh: "今日热门电影",
		"zh-Hant": "今日熱門電影",
		ja: "今日の人気映画",
		es: "Películas Populares de Hoy",
		ar: "أفلام شائعة",
	},
	"home.popular_tv_shows": {
		en: "Popular Domestic Dramas",
		zh: "热门国产电视剧",
		"zh-Hant": "熱門國產電視劇",
		ja: "人気の中国ドラマ",
		es: "Dramas Chinos Populares",
		ar: "دراما صينية شائعة",
	},
	"home.popular_movies": {
		en: "Trending Movies",
		zh: "实时热门电影",
		"zh-Hant": "實時熱門電影",
		ja: "リアルタイム人気映画",
		es: "Películas en Tendencia",
		ar: "أفلام رائجة",
	},
	"home.tmdb_discover_genres": {
		en: "Browse By Category",
		zh: "按分类浏览",
		"zh-Hant": "按分類瀏覽",
		ja: "カテゴリで探す",
		es: "Explorar por Categoría",
		ar: "تصفح حسب الفئة",
	},
	"home.classic_decades": {
		en: "Classic Decades",
		zh: "年代经典",
		"zh-Hant": "年代經典",
		ja: "年代別クラシック",
		es: "Clásicos por Década",
		ar: "كلاسيكيات العقود",
	},
	"home.tmdb_discover_networks": {
		en: "Browse By Network",
		zh: "按平台浏览",
		"zh-Hant": "按平台瀏覽",
		ja: "配信サービスで探す",
		es: "Explorar por Plataforma",
		ar: "حسب الشبكة",
	},
	"home.tmdb_discover_languages": {
		en: "Browse By Language",
		zh: "按语言浏览",
		"zh-Hant": "按語言瀏覽",
		ja: "言語で探す",
		es: "Explorar por Idioma",
		ar: "حسب اللغة",
	},
};

const TMDB_LIST_ROUTE_PARAMS: Partial<Record<string, TmdbListRouteParams>> = {
	"tmdb-popular-tv-shows": {
		category: "trending",
		type: "tv",
	},
	"tmdb-popular-movies": {
		category: "trending",
		type: "movie",
	},
};

/** Language-specific decades collection in the community library. */
const DECADES_COLLECTION_IDS: Record<"zh" | "ar", string> = {
	zh: "col-9e37cdc1f13d",
	ar: "col-d8ca1fd02a45",
};

function resolveLocale(language: string): Locale {
	const normalized = language.toLowerCase();
	if (
		normalized.startsWith("zh-hant") ||
		normalized.includes("tw") ||
		normalized.includes("hk")
	) {
		return "zh-Hant";
	}
	if (normalized.startsWith("zh")) return "zh";
	if (normalized.startsWith("ja")) return "ja";
	if (normalized.startsWith("es")) return "es";
	if (normalized.startsWith("ar")) return "ar";
	return "en";
}

function isChineseLocale(language: string): boolean {
	const locale = resolveLocale(language);
	return locale === "zh" || locale === "zh-Hant";
}

function decadesCollectionLocale(language: string): "zh" | "ar" | null {
	const locale = resolveLocale(language);
	if (locale === "zh" || locale === "zh-Hant") return "zh";
	if (locale === "ar") return "ar";
	return null;
}

function resolveTitle(titleKey: HomeTitleKey, language: string): string {
	return TITLE_TRANSLATIONS[titleKey][resolveLocale(language)];
}

function createTmdbListRoute(
	title: string,
	params: TmdbListRouteParams,
): TmdbListRoute {
	return {
		type: "tmdb-list",
		title,
		params,
	};
}

function isDecadesCollectionSlot(
	section: V2Section,
): section is DecadesCollectionSlot {
	return "type" in section && section.type === "decades-collection";
}

function createV2BlockTemplates(language: string): V2Section[] {
	const doubanBlocks: V2Section[] = isChineseLocale(language)
		? [
				{
					id: "douban-popular-tv-shows",
					mediaType: "tv",
					titleKey: "home.popular_tv_shows",
					preset: "poster-list",
					showRank: true,
					source: {
						path: "/crawler/popular/douban/tv",
						query: {
							language,
						},
						itemEnvelope: "data",
					},
				},
				{
					id: "douban-popular-movies",
					mediaType: "movie",
					titleKey: "home.popular_movies",
					preset: "poster-list",
					showRank: true,
					source: {
						path: "/crawler/popular/douban/movies",
						itemEnvelope: "data",
					},
				},
			]
		: [];

	return [
		{
			id: "tmdb-popular-tv-shows",
			mediaType: "tv",
			titleKey: "home.tmdb_popular_tv_shows",
			preset: "poster-list",
			showRank: true,
			source: {
				path: "/tmdb/trending/tv",
				query: {
					language,
					page: 1,
					limit: 20,
				},
				itemEnvelope: "results",
				pagination: {
					pageParam: "page",
					startPage: 1,
				},
			},
		},
		{
			id: "tmdb-popular-movies",
			mediaType: "movie",
			titleKey: "home.tmdb_popular_movies",
			preset: "poster-list",
			showRank: true,
			source: {
				path: "/tmdb/trending/movie",
				query: {
					language,
					page: 1,
				},
				itemEnvelope: "results",
				pagination: {
					pageParam: "page",
					startPage: 1,
				},
			},
		},
		...doubanBlocks,
		{
			id: "tmdb-discover-genres",
			titleKey: "home.tmdb_discover_genres",
			preset: "genres-list",
			source: {
				path: "/crawler/discover/genres",
				query: {
					language,
				},
				itemEnvelope: "data",
			},
		},
		{ type: "decades-collection" },
		{
			id: "tmdb-discover-networks",
			titleKey: "home.tmdb_discover_networks",
			preset: "networks-list",
			source: {
				path: "/crawler/discover/tv-by-network",
				itemEnvelope: "data",
			},
		},
		{
			id: "tmdb-discover-tv-by-language",
			titleKey: "home.tmdb_discover_languages",
			preset: "languages-list",
			source: {
				path: "/crawler/discover/tv-by-language/v2",
				query: {
					language,
				},
				itemEnvelope: "data",
			},
		},
	];
}

function resolveMediaBlock(
	block: HomeBlockTemplate,
	language: string,
): HomeConfigV2MediaBlock {
	const { titleKey, ...rest } = block;
	if (!titleKey) return rest;
	const title = resolveTitle(titleKey, language);
	const routeParams = TMDB_LIST_ROUTE_PARAMS[rest.id];

	return {
		...rest,
		title,
		...(routeParams ? { route: createTmdbListRoute(title, routeParams) } : {}),
	};
}

function parseDecadesCollection(
	blockId: string,
	blockJson: string,
	language: string,
): CollectionBlock | null {
	try {
		const parsed = JSON.parse(blockJson) as CollectionBlock;
		if (parsed.preset !== COLLECTION_PRESET) return null;
		if (!Array.isArray(parsed.children) || parsed.children.length < 2) {
			return null;
		}
		return {
			...parsed,
			id: parsed.id || blockId,
			title: resolveTitle("home.classic_decades", language),
			style: "image-landscape",
		};
	} catch {
		return null;
	}
}

async function resolveDecadesCollection(
	db: D1Database | undefined,
	language: string,
): Promise<CollectionBlock | null> {
	const locale = decadesCollectionLocale(language);
	if (!db || !locale) return null;
	const id = DECADES_COLLECTION_IDS[locale];

	try {
		const rows = await getCommunityBlocksByIds(db, [id]);
		const row = rows.get(id);
		if (!row) return null;
		return parseDecadesCollection(id, row.block_json, language);
	} catch {
		return null;
	}
}

export async function createHomeConfigV2(
	options: HomeConfigV2Options,
): Promise<HomeConfigV2> {
	const decades = await resolveDecadesCollection(options.db, options.language);
	const blocks: HomeConfigV2Block[] = [];

	for (const section of createV2BlockTemplates(options.language)) {
		if (isDecadesCollectionSlot(section)) {
			if (decades) blocks.push(decades);
			continue;
		}
		blocks.push(resolveMediaBlock(section, options.language));
	}

	return {
		version: HOME_CONFIG_V2_VERSION,
		apiBaseUrl: options.apiBaseUrl,
		imageBaseUrl: options.imageBaseUrl,
		carouselSourceId: "tmdb-popular-tv-shows",
		blocks,
	};
}
