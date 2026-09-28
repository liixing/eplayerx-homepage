import assert from "node:assert/strict";
import { test } from "node:test";
import app from "./baidu.js";

test("Baidu OAuth relays only a bounded response to the fixed app callback", async () => {
	const state = "a".repeat(64);
	for (const [key, value] of [["code", "opaque+/=&code"], ["error", "access_denied"]]) {
		const query = new URLSearchParams({ state, [key]: value, redirect: "https://evil.example" });
		const response = await app.request(`/callback?${query}`);
		assert.equal(response.status, 302);
		assert.equal(response.headers.get("Cache-Control"), "no-store");
		assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
		const target = new URL(response.headers.get("Location")!);
		assert.equal(target.protocol, "eplayerx:");
		assert.equal(target.hostname, "baidu-callback");
		assert.deepEqual([...target.searchParams], [["state", state], [key, value]]);
		assert.equal(await response.text(), "");
	}
	for (const query of ["", "code=x", "state=bad&code=x", `state=${state}&code=`,
		`state=${state}&code=x&code=y`, `state=${state}&state=${state}&code=x`,
		`state=${state}&error=access_denied&error=other`, `state=${state}&code=x&error=access_denied`,
		`state=${state}&code=%0A`, `state=${state}&code=${"x".repeat(2049)}`]) {
		const response = await app.request(`/callback?${query}`);
		assert.equal(response.status, 400);
		assert.equal(response.headers.get("Location"), null);
		assert.equal(response.headers.get("Cache-Control"), "no-store");
	}
});
