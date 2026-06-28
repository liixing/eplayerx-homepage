/// <reference types="@cloudflare/workers-types" />
/**
 * EplayerX Blocks — shared types for the community block builder.
 *
 * Flow: a submitter declares a free-form data source + their TMDB token. The
 * admin scrapes it on approval into an R2 snapshot, which becomes a publicly
 * listed block the client renders with no code changes.
 */

export type BlockCategory = "movie" | "tv" | "anime";

export type MediaType = "movie" | "tv";

/** Only media-list presets are exposed to submitters. */
export type BlockPreset = "thumb-list" | "poster-list" | "hero-list";

export type SubmissionStatus = "pending" | "approved" | "rejected";

/**
 * TMDB `language` parameter options (ISO 639-1 + ISO 3166-1 region). Drives the
 * language of titles/overviews TMDB returns and the artwork-enrichment locale.
 */
export const TMDB_LANGUAGES: { code: string; label: string }[] = [
	{ code: "zh-CN", label: "简体中文" },
	{ code: "zh-TW", label: "繁體中文" },
	{ code: "zh-HK", label: "繁體中文（香港）" },
	{ code: "en-US", label: "English" },
	{ code: "ja-JP", label: "日本語" },
	{ code: "ko-KR", label: "한국어" },
	{ code: "es-ES", label: "Español" },
	{ code: "fr-FR", label: "Français" },
	{ code: "de-DE", label: "Deutsch" },
	{ code: "it-IT", label: "Italiano" },
	{ code: "ru-RU", label: "Русский" },
	{ code: "pt-BR", label: "Português (BR)" },
	{ code: "th-TH", label: "ไทย" },
	{ code: "vi-VN", label: "Tiếng Việt" },
	{ code: "ar-SA", label: "العربية" },
];

export const DEFAULT_LANGUAGE = "zh-CN";

/**
 * Admin-side scrape options applied when approving a submission whose source
 * is a URL/path. The submitter never fills these in — the admin does.
 */
export interface ScrapeOptions {
	query?: Record<string, string | number | boolean>;
	pageParam?: string;
	startPage?: number;
	pages?: number;
	language?: string;
}

/** Snapshot item shape — mirrors the crawler `ContentItem` the client decodes. */
export interface SnapshotItem {
	title: string;
	tmdbId: number;
	vote_average: number | null;
	poster_path?: string | null;
	backdrop_path?: string | null;
	genre_ids: number[];
	media_type: MediaType;
	release_date?: string | null;
	first_air_date?: string | null;
	overview?: string | null;
	thumb?: string | null;
	logo?: string | null;
	noLogoPoster?: string | null;
}

export interface SnapshotBlob {
	type: "community_block";
	count: number;
	lastUpdated: string;
	/** Block display title, written into the blob at publish time so
	 *  installed clients pick up renames on their normal data refresh. */
	title?: string;
	data: SnapshotItem[];
}

/** Client navigation target for TMDB trending / discover lists. */
export type TmdbListRoute = {
	type: "tmdb-list";
	title: string;
	params: {
		category: "trending" | "top-rated" | "discover";
		type: "movie" | "tv";
		genre?: string;
		language?: string;
		network?: string;
		networkName?: string;
		/** TMDB watch provider id(s) — discover `with_watch_providers`. */
		watchProvider?: string;
		watchRegion?: string;
		originCountry?: string;
		/** TMDB company id — discover `with_companies`. */
		company?: string;
		companyName?: string;
		/** Movie release window — discover `primary_release_date.gte/lte`. */
		releaseDateGte?: string;
		releaseDateLte?: string;
	};
};

/** HomeBlock shape the iOS client already understands (see home/config.ts). */
export interface HomeBlock {
	id: string;
	title: string;
	mediaType?: MediaType;
	preset: BlockPreset;
	showRank?: boolean;
	showOverview?: boolean;
	source?: {
		path: string;
		itemEnvelope?: "data" | "results" | "array";
		query?: Record<string, string | number | boolean>;
		pagination?: { pageParam?: string; startPage?: number };
	};
	route?: TmdbListRoute;
	metadata?: { isAnime?: boolean };
}

// MARK: - Collections (a named group of charts rendered as one home section)

/** Preset id for collection blocks; old clients skip unknown presets. */
export const COLLECTION_PRESET = "collection-list";

/** weekday: children carry weekday 1-7 and the client puts today first. */
export type CollectionMode = "weekday" | "custom";
export type CollectionStyle =
	| "rank"
	| "banner"
	| "image"
	| "image-landscape"
	| "image-portrait";

/** What a builder picks per child before the collection is frozen. */
export interface CollectionChildSpec {
	blockId: string;
	label: string;
	/** ISO weekday 1 (Mon) – 7 (Sun); weekday mode only. */
	weekday?: number;
	/** Optional logo/cover URL rendered instead of the text label. */
	image?: string;
}

/** One frozen child chart inside a published collection block. */
export interface CollectionChild {
	id: string;
	label: string;
	weekday?: number;
	/** Optional logo/cover URL rendered instead of the text label. */
	image?: string;
	title: string;
	mediaType?: MediaType;
	preset: BlockPreset;
	showRank?: boolean;
	showOverview?: boolean;
	/** Home-row preview + source-list fallback when no route. */
	source?: {
		path: string;
		itemEnvelope?: string;
		query?: Record<string, string | number | boolean>;
		pagination?: { pageParam?: string; startPage?: number };
	};
	/** Drill-down navigation; when set the client opens TMDB discover/trending. */
	route?: TmdbListRoute;
	metadata?: { isAnime?: boolean };
}

/**
 * Collection block stored in `community_blocks.block_json`. Shares the
 * HomeBlock wire envelope (id/title/preset) but carries children instead of
 * a top-level source.
 */
export interface CollectionBlock {
	id: string;
	title: string;
	preset: typeof COLLECTION_PRESET;
	groupMode: CollectionMode;
	children: CollectionChild[];
	style?: CollectionStyle;
}

export interface SubmissionRow {
	id: string;
	status: SubmissionStatus;
	category: BlockCategory;
	media_type: MediaType;
	is_anime: number;
	title: string;
	preset: BlockPreset | typeof COLLECTION_PRESET;
	show_rank: number;
	show_overview: number;
	language: string;
	source_spec: string;
	tmdb_token: string | null;
	item_count: number;
	author: string | null;
	block_id: string | null;
	reject_reason: string | null;
	created_at: string;
	reviewed_at: string | null;
}

/** Unified card model for the community library (official defaults + submissions). */
export interface DisplayBlock {
	id: string;
	title: string;
	category: BlockCategory;
	preset: BlockPreset | typeof COLLECTION_PRESET;
	showRank: boolean;
	showOverview: boolean;
	/** URL the preview row fetches for artwork (first child for collections). */
	previewSrc: string;
	official: boolean;
	itemCount?: number;
	installs?: number;
	author?: string | null;
	/** TMDB output language; drives the explore-page language filter. */
	language?: string;
	/** Collection blocks only: capsule cards rendered instead of a media row. */
	collectionMode?: CollectionMode;
	collectionStyle?: CollectionStyle;
	collectionChildren?: {
		id: string;
		label: string;
		weekday?: number;
		image?: string;
		previewSrc: string;
	}[];
}

export interface CommunityBlockRow {
	block_id: string;
	category: BlockCategory;
	title: string;
	block_json: string;
	preset: string;
	data_key: string;
	item_count: number;
	installs: number;
	author: string | null;
	language: string;
	created_at: string;
	/** 1 = collection-only chart, excluded from public library listings. */
	hidden: number;
}

/**
 * One block inside an import payload: the client-consumable HomeBlock plus
 * the browse metadata the client persists alongside the install (same shape
 * as the entries returned by `GET /blocks/community`).
 */
export interface ImportableBlock extends HomeBlock {
	category?: BlockCategory;
	author?: string | null;
	itemCount?: number;
	language?: string;
}

export interface ImportableCollectionBlock extends CollectionBlock {
	category?: BlockCategory;
	author?: string | null;
	itemCount?: number;
	language?: string;
}

/** One entry in an import payload / pack: plain chart or collection. */
export type ImportableEntry = ImportableBlock | ImportableCollectionBlock;

export interface BlockCollectionRow {
	collection_id: string;
	title: string;
	blocks_json: string;
	block_count: number;
	installs: number;
	created_at: string;
	/** New iOS shares are approved immediately; pending remains for old rows. */
	status: "pending" | "approved";
	author_name: string | null;
	preview_image_url: string | null;
	description: string | null;
}

/** Cloudflare Workers bindings available on the Hono context. */
export interface BlocksBindings {
	DB?: D1Database;
	/** Admin-uploaded assets (collection child logos). */
	ASSETS?: R2Bucket;
}
