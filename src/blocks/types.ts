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
	data: SnapshotItem[];
}

/** HomeBlock shape the iOS client already understands (see home/config.ts). */
export interface HomeBlock {
	id: string;
	title: string;
	mediaType?: MediaType;
	preset: BlockPreset;
	showRank?: boolean;
	showOverview?: boolean;
	source: {
		path: string;
		itemEnvelope: "data";
	};
	metadata?: { isAnime?: boolean };
}

export interface SubmissionRow {
	id: string;
	status: SubmissionStatus;
	category: BlockCategory;
	media_type: MediaType;
	is_anime: number;
	title: string;
	preset: BlockPreset;
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
	preset: BlockPreset;
	showRank: boolean;
	showOverview: boolean;
	/** URL the preview row fetches for artwork. */
	previewSrc: string;
	official: boolean;
	itemCount?: number;
	installs?: number;
	author?: string | null;
}

export interface CommunityBlockRow {
	block_id: string;
	category: BlockCategory;
	title: string;
	block_json: string;
	data_key: string;
	item_count: number;
	installs: number;
	author: string | null;
	created_at: string;
}

/** Cloudflare Workers bindings available on the Hono context. */
export interface BlocksBindings {
	DB?: D1Database;
}
