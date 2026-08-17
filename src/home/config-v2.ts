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
	| "home.tmdb_discover_languages"
	| "home.tmdb_on_the_air_tv_shows"
	| "home.popular_domestic_anime"
	| "home.bangumi_popular_anime"
	| "home.popular_korean_tv_shows"
	| "home.popular_japanese_tv_shows"
	| "home.popular_spanish_tv_shows"
	| "home.popular_taiwanese_tv_shows"
	| "home.popular_variety_shows"
	| "home.tmdb_top_rated_movies"
	| "home.tmdb_top_rated_tv_shows";

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
	"home.tmdb_on_the_air_tv_shows": {
		en: "On The Air TV Shows",
		zh: "正在热播",
		"zh-Hant": "正在熱播",
		ja: "放送中",
		es: "En Emisión",
		ar: "يعرض الآن",
	},
	"home.popular_domestic_anime": {
		en: "Popular Domestic Anime",
		zh: "热门国产动漫",
		"zh-Hant": "熱門國產動漫",
		ja: "人気の国内アニメ",
		es: "Anime Doméstico Popular",
		ar: "أنمي محلي",
	},
	"home.bangumi_popular_anime": {
		en: "Today's Popular Bangumi",
		zh: "今日热门番剧",
		"zh-Hant": "今日熱門番劇",
		ja: "今日の人気番組",
		es: "Bangumi Populares de Hoy",
		ar: "بانغومي شائع",
	},
	"home.popular_korean_tv_shows": {
		en: "Popular Korean Dramas",
		zh: "备受欢迎的韩剧推荐",
		"zh-Hant": "備受歡迎的韓劇推薦",
		ja: "人気の韓国ドラマ",
		es: "Dramas Coreanos Populares",
		ar: "دراما كورية شائعة",
	},
	"home.popular_japanese_tv_shows": {
		en: "Trending Japanese Dramas",
		zh: "近期最流行日剧榜单",
		"zh-Hant": "近期最流行日劇榜單",
		ja: "最近人気の日本ドラマ",
		es: "Dramas Japoneses en Tendencia",
		ar: "دراما يابانية رائجة",
	},
	"home.popular_spanish_tv_shows": {
		en: "Trending Spanish-Language Series",
		zh: "时下流行的西语剧集",
		"zh-Hant": "時下流行的西語劇集",
		ja: "話題のスペイン語シリーズ",
		es: "Series en Español en Tendencia",
		ar: "مسلسلات إسبانية رائجة",
	},
	"home.popular_taiwanese_tv_shows": {
		en: "Popular Taiwanese Dramas",
		zh: "台剧当然也不能落下",
		"zh-Hant": "台劇當然也不能落下",
		ja: "人気の台湾ドラマ",
		es: "Dramas Taiwaneses Populares",
		ar: "دراما تايوانية شائعة",
	},
	"home.popular_variety_shows": {
		en: "Today's Popular Variety Shows",
		zh: "实时热门综艺",
		"zh-Hant": "實時熱門綜藝",
		ja: "今日の人気バラエティ",
		es: "Programas de Variedades Populares de Hoy",
		ar: "برامج منوعة",
	},
	"home.tmdb_top_rated_movies": {
		en: "Top Rated Movies",
		zh: "高分电影",
		"zh-Hant": "高分電影",
		ja: "高評価映画",
		es: "Películas Mejor Valoradas",
		ar: "الأعلى تقييماً",
	},
	"home.tmdb_top_rated_tv_shows": {
		en: "Top Rated TV Shows",
		zh: "高分电视剧",
		"zh-Hant": "高分電視劇",
		ja: "高評価テレビ番組",
		es: "Series Mejor Valoradas",
		ar: "المسلسلات الأعلى تقييماً",
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

/** Decades collection. Child charts are TMDB; only the section title is localized. */
const DECADES_COLLECTION_ID = "col-9e37cdc1f13d";

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

function createV2BlockTemplates(language: string, timezone: string): V2Section[] {
	const chineseOnly = isChineseLocale(language);
	const doubanHeadBlocks: V2Section[] = chineseOnly
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
	const chineseAnimeBlocks: V2Section[] = chineseOnly
		? [
				{
					id: "douban-popular-anime",
					mediaType: "tv",
					titleKey: "home.popular_domestic_anime",
					preset: "poster-list",
					showRank: true,
					source: {
						path: "/crawler/popular/douban/animation",
						query: {
							language,
						},
						itemEnvelope: "data",
					},
					metadata: { isAnime: true },
				},
				{
					id: "bangumi-popular-anime",
					mediaType: "tv",
					titleKey: "home.bangumi_popular_anime",
					preset: "poster-list",
					showRank: true,
					source: {
						path: "/crawler/popular/bangumi/animation",
						query: {
							language,
						},
						itemEnvelope: "data",
					},
					metadata: { isAnime: true },
				},
			]
		: [];
	const doubanTailBlocks: V2Section[] = chineseOnly
		? [
				{
					id: "douban-popular-variety-shows",
					mediaType: "tv",
					titleKey: "home.popular_variety_shows",
					preset: "poster-list",
					showRank: true,
					source: {
						path: "/crawler/popular/douban/hot-variety-shows",
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
		...doubanHeadBlocks,
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
		{
			id: "tmdb-on-the-air-tv-shows",
			mediaType: "tv",
			titleKey: "home.tmdb_on_the_air_tv_shows",
			preset: "hero-list",
			source: {
				path: "/tmdb/tv/on_the_air",
				query: {
					language,
					timezone,
				},
				itemEnvelope: "results",
			},
		},
		...chineseAnimeBlocks,
		...doubanTailBlocks,
		{
			id: "tmdb-popular-korean-tv-shows",
			mediaType: "tv",
			titleKey: "home.popular_korean_tv_shows",
			preset: "poster-list",
			showRank: true,
			source: {
				path: "/tmdb/discover/tv",
				query: {
					with_original_language: "ko",
					sort_by: "popularity.desc",
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
		{
			id: "tmdb-popular-japanese-tv-shows",
			mediaType: "tv",
			titleKey: "home.popular_japanese_tv_shows",
			preset: "poster-list",
			showRank: true,
			source: {
				path: "/tmdb/discover/tv",
				query: {
					with_original_language: "ja",
					with_genres: 18,
					without_genres: "16,10762",
					without_keywords: "317204",
					"first_air_date.gte": "2018-01-01",
					"vote_count.gte": 15,
					sort_by: "popularity.desc",
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
		{
			id: "tmdb-popular-spanish-tv-shows",
			mediaType: "tv",
			titleKey: "home.popular_spanish_tv_shows",
			preset: "poster-list",
			showRank: true,
			source: {
				path: "/tmdb/discover/tv",
				query: {
					with_original_language: "es",
					with_genres: 18,
					without_genres: "16,10762,10764",
					"first_air_date.gte": "2018-01-01",
					"vote_count.gte": 20,
					sort_by: "popularity.desc",
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
		{
			id: "tmdb-popular-taiwanese-tv-shows",
			mediaType: "tv",
			titleKey: "home.popular_taiwanese_tv_shows",
			preset: "poster-list",
			showRank: true,
			source: {
				path: "/tmdb/discover/tv",
				query: {
					with_original_language: "zh",
					with_origin_country: "TW",
					sort_by: "popularity.desc",
					"first_air_date.gte": "2021-01-01",
					"vote_count.gte": 5,
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
		{
			id: "tmdb-top-rated-movies",
			titleKey: "home.tmdb_top_rated_movies",
			mediaType: "movie",
			preset: "poster-list",
			source: {
				path: "/tmdb/movie/top_rated",
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
			id: "tmdb-top-rated-tv-shows",
			titleKey: "home.tmdb_top_rated_tv_shows",
			mediaType: "tv",
			preset: "poster-list",
			source: {
				path: "/tmdb/tv/top_rated",
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
	if (!db) return null;

	try {
		const rows = await getCommunityBlocksByIds(db, [DECADES_COLLECTION_ID]);
		const row = rows.get(DECADES_COLLECTION_ID);
		if (!row) return null;
		return parseDecadesCollection(DECADES_COLLECTION_ID, row.block_json, language);
	} catch {
		return null;
	}
}

export async function createHomeConfigV2(
	options: HomeConfigV2Options,
): Promise<HomeConfigV2> {
	const decades = await resolveDecadesCollection(options.db, options.language);
	const blocks: HomeConfigV2Block[] = [];

	for (const section of createV2BlockTemplates(
		options.language,
		options.timezone,
	)) {
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
