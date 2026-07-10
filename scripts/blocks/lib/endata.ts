/**
 * 艺恩娱数 (app.endata.com.cn) daily play-index rankings.
 * API returns DES-ECB ciphertext; decrypt with the key embedded in the payload.
 */

import { createDecipheriv } from "node:crypto";
import type { PublishItem } from "../../../src/blocks/publish.js";

const API_URL = "https://app.endata.com.cn/API/DataBox/Eovt/GetDayList";
const PAGE_URL = "https://app.endata.com.cn/DataBox/Video/Home/Index";

/** Endata channel ids on the Video Home rank page. */
export const ENDATA_TV_TYPE = {
	movie: 1,
	tv: 2,
	anime: 11,
} as const;

export type EndataTvType = (typeof ENDATA_TV_TYPE)[keyof typeof ENDATA_TV_TYPE];

interface EndataRow {
	TVID?: number;
	TvName?: string;
	ReleaseDate?: string;
	MobileStr?: string;
	iRank?: number;
}

interface EndataResponse {
	Status?: number;
	Data?: { Table1?: EndataRow[] };
}

function stripAt(text: string, index: number, count: number): string {
	if (index === 0) return text.slice(count);
	return text.slice(0, index) + text.slice(index + count);
}

/** Decrypt endata API ciphertext (DES-ECB, key derived from the payload). */
export function decryptEndata(cipher: string): EndataResponse {
	const raw = cipher.trim();
	if (raw.length < 16) throw new Error("endata cipher too short");

	let cut = Number.parseInt(raw.at(-1) ?? "0", 16) + 9;
	const keyOffset = Number.parseInt(raw[cut] ?? "0", 16);
	let payload = stripAt(raw, cut, 1);
	const key = payload.slice(keyOffset, keyOffset + 8);
	payload = stripAt(payload, keyOffset, 8);

	const decipher = createDecipheriv("des-ecb", Buffer.from(key, "utf8"), null);
	const plain = Buffer.concat([
		decipher.update(Buffer.from(payload, "hex")),
		decipher.final(),
	]).toString("utf8");
	const json = plain.slice(0, plain.lastIndexOf("}") + 1);
	return JSON.parse(json) as EndataResponse;
}

function utc8Ymd(offsetDays = 0, now = new Date()): string {
	const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
	utc8.setUTCDate(utc8.getUTCDate() + offsetDays);
	return utc8.toISOString().slice(0, 10);
}

function yearFromRelease(releaseDate?: string): number | undefined {
	const m = releaseDate?.match(/^(\d{4})/);
	return m ? Number(m[1]) : undefined;
}

/** Strip season / language suffixes that hurt TMDB title search. */
function searchHints(title: string): { title: string; altTitles?: string[] } {
	const alts = new Set<string>();
	const noParen = title.replace(/[（(][^）)]*[）)]/g, "").trim();
	if (noParen && noParen !== title) alts.add(noParen);
	const noSeason = noParen
		.replace(
			/(?:\s*第[一二三四五六七八九十\d]+季|\s*第\d+季|\s*Season\s*\d+)$/i,
			"",
		)
		.trim();
	if (noSeason && noSeason !== noParen) alts.add(noSeason);
	return alts.size
		? { title, altTitles: [...alts] }
		: { title };
}

interface EndataRowWithIndex extends EndataRow {
	PlayCountIndex?: number | null;
}

async function fetchEndataDayRaw(
	tvType: EndataTvType,
	date: string,
	limit: number,
): Promise<EndataRowWithIndex[]> {
	const body = new URLSearchParams({
		DateType: "Day",
		sDate: date,
		eDate: date,
		sTvType: String(tvType),
		sPlayChannel: "",
		iPageIndex: "1",
		iPageSize: String(limit),
		sOrderIndex: "PlayCountIndex",
		sOrderType: "DESC",
		sIsExport: "",
		iTvID: "",
		sCountry: "",
		sThemeId: "",
		sGenreId: "",
		sCartoonLevel: "",
		sScopeId: "",
		sPlayPeriod: "",
		sPlayState: "",
		sPlayPeriodChild: "",
		sBroadsDate: "",
		sBroadeDate: "",
		sSearchStr: "",
		sColumnType: "",
		sMediaId: "",
		r: String(Math.random()),
	});

	const res = await fetch(API_URL, {
		method: "POST",
		headers: {
			"User-Agent":
				"Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15",
			Referer: PAGE_URL,
			"X-Requested-With": "XMLHttpRequest",
			"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
		},
		body,
	});
	if (!res.ok) throw new Error(`endata HTTP ${res.status}`);

	const data = decryptEndata(await res.text());
	if (data.Status !== 1) {
		throw new Error(`endata status ${data.Status}`);
	}
	return (data.Data?.Table1 ?? []) as EndataRowWithIndex[];
}

/** Fetch ranked titles for one endata channel (movie / tv / anime). */
export async function fetchEndataDayItems(
	tvType: EndataTvType,
	opts?: { date?: string; limit?: number },
): Promise<PublishItem[]> {
	const limit = opts?.limit ?? 50;
	// Endata often lags 1–2 days; days without PlayCountIndex return junk order.
	const dates = opts?.date
		? [opts.date]
		: [0, -1, -2, -3].map((d) => utc8Ymd(d));

	for (const date of dates) {
		const rows = await fetchEndataDayRaw(tvType, date, limit);
		const ranked = rows.filter(
			(row) => row.TvName?.trim() && row.PlayCountIndex != null,
		);
		if (ranked.length < Math.min(10, limit)) continue;

		const items: PublishItem[] = [];
		for (const row of ranked) {
			const title = row.TvName?.trim();
			if (!title) continue;
			items.push({
				...searchHints(title),
				year: yearFromRelease(row.ReleaseDate),
			});
			if (items.length >= limit) break;
		}
		console.log(`📅 endata tvType=${tvType} date=${date} (${items.length})`);
		return items;
	}
	throw new Error(
		`endata empty/unranked list for tvType=${tvType} dates=${dates.join(",")}`,
	);
}
