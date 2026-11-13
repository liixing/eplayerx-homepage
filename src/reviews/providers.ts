export type MediaType = "movie" | "tv";
export type ReviewSource = "douban" | "bahamut";

/** TMDB-compatible wire format; ratings are always out of ten. */
export interface ExtraReview {
	id: string;
	source: ReviewSource;
	author: string;
	author_details: {
		name: string;
		avatar_path: string | null;
		rating: number | null;
	};
	content: string;
	created_at: string | null;
	url: string;
	likes: number;
}

export interface ReviewTitle {
	type: MediaType;
	titles: string[];
	year: number;
	animated: boolean;
}

export interface SourceReviews {
	sourceId: string | null;
	results: ExtraReview[];
}

type Row = Record<string, unknown>;
const row = (value: unknown): Row =>
	value && typeof value === "object" && !Array.isArray(value)
		? (value as Row)
		: {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown): string =>
	typeof value === "string" ? value.trim() : "";
const positive = (value: unknown): number =>
	typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
const id = (value: unknown): string | null =>
	/^(?:[1-9]\d*)$/.test(String(value)) ? String(value) : null;

export function normalizedTitle(value: string): string {
	// Only season one is interchangeable with an unsuffixed series title.
	return value
		.normalize("NFKC")
		.toLowerCase()
		.replace(/(?:第[一1]季|season\s*1)$/i, "")
		.replace(/[^\p{L}\p{N}]/gu, "");
}

function matches(title: string, titles: string[]): boolean {
	const normalized = normalizedTitle(title);
	return (
		!!normalized &&
		titles.some((candidate) => normalizedTitle(candidate) === normalized)
	);
}

function plain(value: unknown): string {
	return text(value)
		.replace(/<[^>]*>/g, " ")
		.replace(
			/&(?:amp|lt|gt|quot|apos|nbsp);|&#(?:x[\da-f]+|\d+);/gi,
			(entity) => {
				const named: Record<string, string> = {
					"&amp;": "&",
					"&lt;": "<",
					"&gt;": ">",
					"&quot;": '"',
					"&apos;": "'",
					"&nbsp;": " ",
				};
				if (named[entity]) return named[entity];
				const code = Number.parseInt(
					entity.slice(entity[2]?.toLowerCase() === "x" ? 3 : 2, -1),
					entity[2]?.toLowerCase() === "x" ? 16 : 10,
				);
				return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
			},
		)
		.replace(/\s+/g, " ")
		.trim();
}

function https(value: unknown): string | null {
	try {
		const url = new URL(text(value));
		return url.protocol === "https:" ? url.href : null;
	} catch {
		return null;
	}
}

function date(value: unknown): string | null {
	const raw = text(value);
	if (!raw) return null;
	const timestamp = Date.parse(
		/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(raw)
			? `${raw.replace(" ", "T")}+08:00`
			: raw,
	);
	return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

async function get(
	url: string,
	referer: string,
	deadline?: AbortSignal,
): Promise<Response> {
	const response = await fetch(url, {
		headers: {
			// Bahamut redirects mobile search to a different page layout.
			"User-Agent": referer.includes("douban.com")
				? "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 Version/15.0 Mobile/15E148 Safari/604.1"
				: "Mozilla/5.0",
			Referer: referer,
		},
		signal: deadline
			? AbortSignal.any([deadline, AbortSignal.timeout(6000)])
			: AbortSignal.timeout(6000),
	});
	if (!response.ok) throw new Error(`Review source HTTP ${response.status}`);
	return response;
}

async function doubanJson(path: string): Promise<Row> {
	return row(
		await (
			await get(
				`https://m.douban.com/rexxar/api/v2/${path}`,
				"https://m.douban.com/",
			)
		).json(),
	);
}

export function parseDoubanReviews(data: unknown): ExtraReview[] {
	const body = row(data);
	if (!Array.isArray(body.interests))
		throw new Error("Unexpected Douban reviews response");
	return body.interests
		.flatMap((value: unknown): ExtraReview[] => {
			const item = row(value),
				user = row(item.user),
				rating = row(item.rating),
				reviewId = id(item.id);
			const content = text(item.comment);
			if (!reviewId || !content || item.is_spoiler === true) return [];
			const author = text(user.name);
			return [
				{
					id: reviewId,
					source: "douban",
					author,
					author_details: {
						name: author,
						avatar_path: https(user.avatar),
						rating:
							positive(rating.value) <= 5 && positive(rating.value)
								? positive(rating.value) * 2
								: null,
					},
					content,
					created_at: date(item.create_time),
					likes: positive(item.vote_count),
					url: https(item.sharing_url) ?? "https://movie.douban.com/",
				},
			];
		})
		.slice(0, 20);
}

export async function fetchDoubanReviews(
	title: ReviewTitle,
	sourceId?: string | null,
): Promise<SourceReviews> {
	let resolved = sourceId;
	if (!resolved) {
		const data = await doubanJson(
			`search?q=${encodeURIComponent(title.titles[0])}&type=${title.type}`,
		);
		if (!Array.isArray(row(data.subjects).items))
			throw new Error("Unexpected Douban search response");
		const candidates = list(row(data.subjects).items)
			.map(row)
			.filter((item) => {
				const target = row(item.target);
				return (
					item.target_type === title.type &&
					Number(target.year) === title.year &&
					matches(text(target.title), title.titles)
				);
			});
		const ids = [
			...new Set(
				candidates
					.map((item) => id(row(item.target).id))
					.filter((value): value is string => !!value),
			),
		];
		if (ids.length !== 1) return { sourceId: null, results: [] };
		resolved = ids[0];
	}
	const data = await doubanJson(
		`${title.type}/${resolved}/interests?count=20&start=0&status=done`,
	);
	return { sourceId: resolved, results: parseDoubanReviews(data) };
}

export function bahamutCandidates(html: string, titles: string[]): string[] {
	if (!html.includes("search_title")) {
		if (html.includes("查無") || html.includes("找不到")) return [];
		throw new Error("Unexpected Bahamut search response");
	}
	const ids = new Set<string>();
	for (const match of html.matchAll(
		/<p\s+class="search_title"[^>]*>([\s\S]*?)<\/p>/g,
	)) {
		if (!/\[\s*動畫\s*\]/.test(match[1])) continue;
		const link = match[1].match(
			/href="[^"\s]*acgDetail\.php\?s=(\d+)"[^>]*>([\s\S]*?)<\/a>/,
		);
		if (link && matches(plain(link[2]), titles)) ids.add(link[1]);
	}
	return [...ids];
}

export function bahamutFanpage(
	html: string,
	title: ReviewTitle,
): string | null {
	const names = [...html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/g)].map(
		(match) => plain(match[1]),
	);
	const year = html.match(/(?:當地首播|首映日期)[：:]\s*(\d{4})/);
	if (
		!year ||
		Number(year[1]) !== title.year ||
		!names.some((name) => matches(name, title.titles))
	)
		return null;
	return html.match(/navAllReviews\((\d+),\s*4\)/)?.[1] ?? null;
}

async function findBahamutFanpageJson(
	title: ReviewTitle,
	deadline: AbortSignal,
): Promise<string | null> {
	const query = title.titles[1] || title.titles[0];
	const search = row(
		await (
			await get(
				`https://api.gamer.com.tw/mobile_app/anime/v1/search.php?kw=${encodeURIComponent(query)}`,
				"https://ani.gamer.com.tw/",
				deadline,
			)
		).json(),
	);
	if (!Array.isArray(search.anime))
		throw new Error("Unexpected Bahamut anime search response");
	const candidates = new Map<string, string>();
	for (const value of search.anime) {
		const item = row(value),
			acgId = id(item.acg_sn),
			videoId = id(item.video_sn);
		const year = text(item.info).match(/年份[：:]\s*(\d{4})/)?.[1];
		if (
			acgId &&
			videoId &&
			Number(year) === title.year &&
			matches(text(item.title), title.titles) &&
			!candidates.has(acgId)
		) {
			candidates.set(acgId, videoId);
		}
	}
	if (candidates.size !== 1) return null;
	const [acgId, videoId] = [...candidates][0];
	const details = row(
		row(
			await (
				await get(
					`https://api.gamer.com.tw/anime/v1/video.php?videoSn=${videoId}`,
					"https://ani.gamer.com.tw/",
					deadline,
				)
			).json(),
		).data,
	);
	const anime = row(details.anime);
	const name = text(anime.title).replace(/\s*\[\d+(?:\.\d+)?\]\s*$/, "");
	if (
		id(anime.acgSn) !== acgId ||
		id(row(details.video).videoSn) !== videoId ||
		Number(text(anime.seasonStart).slice(0, 4)) !== title.year ||
		!matches(name, title.titles)
	)
		return null;
	return id(anime.fanId);
}

async function findBahamutFanpageHtml(
	title: ReviewTitle,
	deadline: AbortSignal,
): Promise<string | null> {
	const query = title.titles[1] || title.titles[0];
	const html = await (
		await get(
			`https://acg.gamer.com.tw/search.php?kw=${encodeURIComponent(query)}`,
			"https://acg.gamer.com.tw/",
			deadline,
		)
	).text();
	const candidates = bahamutCandidates(html, title.titles);
	if (candidates.length !== 1) return null;
	const detail = await (
		await get(
			`https://acg.gamer.com.tw/acgDetail.php?s=${candidates[0]}`,
			"https://acg.gamer.com.tw/",
			deadline,
		)
	).text();
	return bahamutFanpage(detail, title);
}

export function parseBahamutReviews(
	data: unknown,
	fanpage: string,
): ExtraReview[] {
	const body = row(row(data).data);
	if (!Array.isArray(body.list))
		throw new Error("Unexpected Bahamut reviews response");
	return body.list
		.flatMap((group: unknown) => list(group))
		.flatMap((value: unknown): ExtraReview[] => {
			const item = row(value),
				review = row(item.reviews),
				user = row(item.publisher),
				reviewId = id(item.id);
			const content = plain(item.content);
			if (
				!reviewId ||
				!content ||
				String(review.id) !== fanpage ||
				row(review.dc_type).id !== 4 ||
				String(item.privacy) !== "1" ||
				item.spoiler === true
			)
				return [];
			const author = text(user.name),
				stars = positive(review.rating);
			return [
				{
					id: reviewId,
					source: "bahamut",
					author,
					author_details: {
						name: author,
						avatar_path: https(user.propic),
						rating: stars && stars <= 5 ? stars * 2 : null,
					},
					content,
					created_at: date(item.ctime),
					likes: positive(item.likeCount),
					url: `https://wall.gamer.com.tw/post.php?sn=${reviewId}`,
				},
			];
		})
		.slice(0, 20);
}

export async function fetchBahamutReviews(
	title: ReviewTitle,
	sourceId?: string | null,
): Promise<SourceReviews> {
	if (!title.animated) return { sourceId: null, results: [] };
	// Leave room for metadata resolution and R2 persistence within waitUntil's lifetime.
	const deadline = AbortSignal.timeout(22_000);
	let resolved = sourceId;
	if (!resolved) {
		// AniGamer JSON avoids HTML parsing; its catalog does not cover every ACG entry.
		resolved = await findBahamutFanpageJson(title, deadline).catch(() => null);
		if (!resolved) resolved = await findBahamutFanpageHtml(title, deadline);
		if (!resolved) return { sourceId: null, results: [] };
	}
	const data = await (
		await get(
			`https://api.gamer.com.tw/acg/v1/reviews_list.php?sn=${resolved}&t=4&sort=1`,
			"https://wall.gamer.com.tw/",
			deadline,
		)
	).json();
	return { sourceId: resolved, results: parseBahamutReviews(data, resolved) };
}
