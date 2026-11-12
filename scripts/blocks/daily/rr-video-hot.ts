import { createDecipheriv, createHmac, randomUUID } from "node:crypto";
import { type PublishItem, publishBlock } from "../../../src/blocks/publish.js";
import { fetchWithRetry } from "../lib/http.js";

// Public web client's signing and response decoding parameters for the rank API.
const SIGN_KEY = "ES513W0B1CsdUrR13Qk5EgDAKPeeKZY";
const RESPONSE_KEY = "3b744389882a4067";
const RANK_PATH = "/m-station/top/drama/list?pageNum=1&pageSize=50&topId=9";

const MEDIA_TYPES: Partial<Record<string, PublishItem["mediaType"]>> = {
	MOVIE: "movie",
	TV: "tv",
	VARIETY: "tv",
	DOCUMENTARY: "tv",
};

const KNOWN_IDS: Record<string, number> = {
	可能的爱情: 1483525,
	影子姐妹2026: 315323,
	"Running Man（2026）": 33238,
	"终极名单 第一季": 120911,
	"终极名单 第二季": 120911,
	"流人 第六季": 95480,
	"深夜食堂 第六季": 339439,
	"校园之外 第一季": 273240,
};

interface RankResponse {
	code: string;
	msg?: string;
	data?: {
		total: number;
		content: { title: string; dramaType: string; year?: string }[];
	};
}

async function fetchItems(): Promise<PublishItem[]> {
	const deviceId = randomUUID();
	const t = String(Date.now());
	const signature = createHmac("sha256", SIGN_KEY)
		.update(`GET\naliId:${deviceId}\nct:web_pc\ncv:1.0.0\nt:${t}\n${RANK_PATH}`)
		.digest("base64");
	const response = await fetchWithRetry(
		`https://api.yichengwlkj.com${RANK_PATH}`,
		{
			headers: {
				clientVersion: "1.0.0",
				cv: "1.0.0",
				clientType: "web_pc",
				ct: "web_pc",
				deviceId,
				aliId: deviceId,
				umid: deviceId,
				uet: "9",
				t,
				"x-ca-sign": signature,
			},
		},
	);
	if (!response.ok) throw new Error(`RR rank HTTP ${response.status}`);

	const body = (await response.text()).trim();
	const decipher = createDecipheriv("aes-128-ecb", RESPONSE_KEY, null);
	const json = body.startsWith("{")
		? body
		: decipher.update(body, "base64", "utf8") + decipher.final("utf8");
	const { code, msg, data } = JSON.parse(json) as RankResponse;
	if (code !== "0000" || !data) throw new Error(`RR rank ${code}: ${msg}`);
	if (!Array.isArray(data.content) || data.content.length !== data.total) {
		throw new Error("RR rank returned an incomplete list.");
	}

	return data.content.flatMap((row) => {
		const title = row.title?.trim();
		const mediaType = MEDIA_TYPES[row.dramaType];
		if (!title || !mediaType) return [];
		const year = Number(row.year);
		return [
			{
				title,
				mediaType,
				...(year > 0 ? { year } : {}),
				tmdbId: KNOWN_IDS[title],
			},
		];
	});
}

await publishBlock({
	submissionId: "e194efb0bf5a",
	blockId: "community-rr-video-hot",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems,
});
