import assert from "node:assert/strict";
import { test } from "node:test";
import { S3Client } from "@aws-sdk/client-s3";

test("ratings cache shares loads, refreshes hourly and retains scores on transient failure", async (t) => {
	process.env.R2_BUCKET_NAME = "ratings-test";
	const { getRatingsCache } = await import("./cache.js");
	let now = 1;
	let loads = 0;
	let failed = true;
	t.mock.method(Date, "now", () => now);
	t.mock.method(S3Client.prototype, "send", async () => {
		loads++;
		if (failed) throw new Error("temporary failure");
		return {
			Body: {
				transformToString: async () =>
					JSON.stringify({ "tv:1": { imdb: loads } }),
			},
		};
	});
	const first = getRatingsCache();
	assert.equal(getRatingsCache(), first);
	assert.equal((await first).size, 0);
	failed = false;
	now += 60_001;
	assert.equal((await getRatingsCache()).get("tv:1")?.imdb, 2);
	await getRatingsCache();
	assert.equal(loads, 2);
	now += 3_600_001;
	assert.equal((await getRatingsCache()).get("tv:1")?.imdb, 3);
	failed = true;
	now += 3_600_001;
	assert.equal((await getRatingsCache()).get("tv:1")?.imdb, 3);
	failed = false;
	now += 60_001;
	assert.equal((await getRatingsCache()).get("tv:1")?.imdb, 5);
});
