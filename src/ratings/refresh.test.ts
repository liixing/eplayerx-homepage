import assert from "node:assert/strict";
import { test } from "node:test";
import {
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";

test("trending refresh fills new titles, updates old scores and preserves data on failures", async (t) => {
	process.env.R2_BUCKET_NAME = "ratings-test";
	process.env.TMDB_API_TOKEN = "test";
	process.env.MDBLIST_API_KEY = "test";
	const { refreshTrendingRatings } = await import("./refresh.js");
	let saved: Record<string, unknown> = {};
	let status = 200;
	const initial = {
		"tv:1": { imdb: 7, tomatoes: 80 },
		"tv:2": { imdb: 6 },
		"movie:99": { imdb: 9 },
	};
	t.mock.method(S3Client.prototype, "send", async (command: unknown) => {
		if (command instanceof GetObjectCommand) {
			return {
				Body: { transformToString: async () => JSON.stringify(initial) },
			};
		}
		assert.ok(command instanceof PutObjectCommand);
		saved = JSON.parse(String(command.input.Body));
		return {};
	});
	const requests: string[] = [];
	t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
		const url = new URL(input instanceof Request ? input.url : String(input));
		requests.push(url.pathname);
		if (url.pathname.includes("/trending/")) {
			return Response.json({
				results: url.pathname.includes("/tv/")
					? [{ id: 1 }, { id: 2 }, { id: 3 }, { id: -1 }]
					: [{ id: 4 }],
			});
		}
		if (url.pathname === "/tmdb/show/2") return Response.json({}, { status });
		return Response.json({
			ratings: [
				{ source: "imdb", value: 8 },
				{ source: "tomatoes", value: 0 },
			],
		});
	});
	await refreshTrendingRatings();
	assert.deepEqual(saved["tv:1"], { imdb: 8, tomatoes: 80 });
	assert.deepEqual(saved["tv:2"], { imdb: 6 });
	assert.deepEqual(saved["tv:3"], { imdb: 8 });
	assert.deepEqual(saved["movie:4"], { imdb: 8 });
	assert.deepEqual(saved["movie:99"], initial["movie:99"]);
	assert.equal(requests.filter((p) => p.startsWith("/tmdb/")).length, 4);
	status = 404;
	await refreshTrendingRatings();
	assert.deepEqual(saved["tv:2"], { imdb: 6 });
	status = 500;
	await assert.rejects(
		refreshTrendingRatings(),
		/1 trending ratings requests failed/,
	);
	assert.deepEqual(saved["tv:2"], { imdb: 6 });
	assert.deepEqual(saved["tv:3"], { imdb: 8 });
	status = 429;
	await assert.rejects(refreshTrendingRatings(), /daily limit/);
	assert.deepEqual(saved["tv:1"], { imdb: 8, tomatoes: 80 });
});
