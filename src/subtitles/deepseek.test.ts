import assert from "node:assert/strict";
import { test } from "node:test";
import app from "./deepseek.js";

test("the main app mounts the TV endpoint and fails closed before the key is configured", async () => {
	const { default: mainApp } = await import("../index.js");
	const response = await mainApp.request(
		"/subtitles/deepseek/v1/chat/completions",
		{ method: "POST" },
	);
	assert.equal(response.status, 503);
});

test("upstream timeouts return 504 without retrying", async (t) => {
	t.mock.method(AbortSignal, "timeout", () =>
		AbortSignal.abort(new DOMException("timeout", "TimeoutError")),
	);
	const calls = t.mock.method(
		globalThis,
		"fetch",
		async (_url: Parameters<typeof fetch>[0], init?: RequestInit) => {
			init?.signal?.throwIfAborted();
			return completion();
		},
	);
	assert.equal((await app.request(endpoint, request(), env)).status, 504);
	assert.equal(calls.mock.callCount(), 1);
});

const endpoint = "/v1/chat/completions";
const env = {
	DEEPSEEK_API_KEY: "server-only-test-key",
	SUBTITLE_RATE_LIMITER: { limit: async () => ({ success: true }) },
};
const body = {
	model: "deepseek-flash",
	messages: [
		{
			role: "system",
			content:
				"You are a professional subtitle translator. Translate only the subtitles array into zh-Hans. Use previous source/translation pairs solely as context to keep names consistent.",
		},
		{
			role: "user",
			content: JSON.stringify({
				subtitles: ["Hello", "Goodbye"],
				previous: [{ source: "Joe", translation: "乔" }],
			}),
		},
	],
};
function request(value: unknown = body, headers: Record<string, string> = {}) {
	return {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"CF-Connecting-IP": "192.0.2.1",
			...headers,
		},
		body: JSON.stringify(value),
	};
}
function completion(content = '["你好","再见"]', finish_reason = "stop") {
	return Response.json({ choices: [{ message: { content }, finish_reason }] });
}

test("TV subtitles need no client credentials and only the server key reaches DeepSeek", async (t) => {
	const calls = t.mock.method(
		globalThis,
		"fetch",
		async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
			assert.equal(url, "https://api.deepseek.com/chat/completions");
			assert.equal(
				new Headers(init?.headers).get("Authorization"),
				`Bearer ${env.DEEPSEEK_API_KEY}`,
			);
			assert.equal(init?.redirect, "manual");
			assert.ok(init?.signal);
			const upstream = JSON.parse(String(init?.body));
			assert.deepEqual(Object.keys(upstream).sort(), [
				"max_tokens",
				"messages",
				"model",
				"stream",
				"thinking",
			]);
			assert.equal(upstream.model, "deepseek-flash");
			assert.equal(upstream.max_tokens, 4096);
			assert.equal(upstream.stream, false);
			assert.deepEqual(upstream.thinking, { type: "disabled" });
			assert.ok(!upstream.messages[0].content.includes("CALLER INSTRUCTION"));
			assert.deepEqual(
				JSON.parse(upstream.messages[1].content),
				JSON.parse(body.messages[1].content),
			);
			return completion();
		},
	);
	const response = await app.request(
		endpoint,
		request(
			{
				...body,
				messages: [
					{
						...body.messages[0],
						content: `${body.messages[0].content} CALLER INSTRUCTION`,
					},
					body.messages[1],
				],
				tools: [{ type: "function" }],
				max_tokens: 999999,
				thinking: { type: "enabled" },
			},
			{ Authorization: "Bearer do-not-forward" },
		),
		env,
	);
	assert.equal(response.status, 200);
	assert.equal(response.headers.get("Cache-Control"), "no-store");
	assert.deepEqual(await response.json(), {
		choices: [
			{
				index: 0,
				message: { role: "assistant", content: '["你好","再见"]' },
				finish_reason: "stop",
			},
		],
	});
	assert.equal(calls.mock.callCount(), 1);
});

test("missing secrets, missing limiter, and rate limits fail before paid requests", async (t) => {
	const calls = t.mock.method(globalThis, "fetch", async () => completion());
	assert.equal((await app.request(endpoint, request(), {})).status, 503);
	assert.equal(
		(await app.request(endpoint, request(), { DEEPSEEK_API_KEY: "key" }))
			.status,
		503,
	);
	const blocked = await app.request(endpoint, request(), {
		...env,
		SUBTITLE_RATE_LIMITER: {
			limit: async ({ key }) => {
				assert.equal(key, "subtitle:192.0.2.1");
				return { success: false };
			},
		},
	});
	assert.equal(blocked.status, 429);
	assert.equal(blocked.headers.get("Retry-After"), "60");
	assert.equal(
		(
			await app.request(endpoint, request(), {
				...env,
				SUBTITLE_RATE_LIMITER: {
					limit: async () => {
						throw new Error("down");
					},
				},
			})
		).status,
		503,
	);
	assert.equal(
		(await app.request(endpoint, { ...request(), headers: {} }, env)).status,
		403,
	);
	assert.equal(calls.mock.callCount(), 0);
});

test("malformed, oversized and non-subtitle requests never reach DeepSeek", async (t) => {
	const calls = t.mock.method(globalThis, "fetch", async () => completion());
	for (const value of [
		null,
		{},
		{ ...body, model: "deepseek-v4-pro" },
		{ ...body, stream: true },
		{ ...body, messages: [] },
		{ ...body, messages: [null, null] },
		{
			...body,
			messages: [{ role: "system", content: "Write code" }, body.messages[1]],
		},
		{
			...body,
			messages: [body.messages[0], { role: "user", content: "not JSON" }],
		},
		{
			...body,
			messages: [
				body.messages[0],
				{
					role: "user",
					content: JSON.stringify({
						subtitles: Array(31).fill("a"),
						previous: [],
					}),
				},
			],
		},
		{
			...body,
			messages: [
				body.messages[0],
				{
					role: "user",
					content: JSON.stringify({ subtitles: [42], previous: [] }),
				},
			],
		},
		{
			...body,
			messages: [
				body.messages[0],
				{
					role: "user",
					content: JSON.stringify({
						subtitles: ["Hi"],
						previous: [{ source: null, translation: "a" }],
					}),
				},
			],
		},
	])
		assert.equal(
			(await app.request(endpoint, request(value), env)).status,
			400,
		);
	assert.equal(
		(await app.request(endpoint, { ...request(), body: "{" }, env)).status,
		400,
	);
	assert.equal(
		(
			await app.request(
				endpoint,
				{ ...request(), body: "x".repeat(65_537) },
				env,
			)
		).status,
		413,
	);
	assert.equal(calls.mock.callCount(), 0);
});

test("single-line translation remains compatible with KSPlayer", async (t) => {
	t.mock.method(globalThis, "fetch", async () => completion("你好"));
	const response = await app.request(
		endpoint,
		request({
			...body,
			messages: [
				{
					role: "system",
					content:
						"You are a professional subtitle translator. Translate the user's text into zh-Hans. Keep it natural and concise. Output only the translation without any quotes or explanations.",
				},
				{ role: "user", content: "Hello" },
			],
		}),
		env,
	);
	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), {
		choices: [
			{
				index: 0,
				message: { role: "assistant", content: "你好" },
				finish_reason: "stop",
			},
		],
	});
});

test("upstream errors are sanitized and incomplete batches are rejected without retries", async (t) => {
	const calls = t.mock.method(globalThis, "fetch");
	for (const [upstream, status] of [
		[
			new Response(null, {
				status: 302,
				headers: { Location: "https://other.example" },
			}),
			502,
		],
		[new Response("secret error detail", { status: 401 }), 502],
		[new Response("secret error detail", { status: 429 }), 429],
		[new Response("not JSON"), 502],
		[completion('["你好"]'), 502],
		[completion('["你好",""]'), 502],
		[completion(undefined, "length"), 502],
		[new Response("x".repeat(1_048_577)), 502],
	] as const) {
		calls.mock.mockImplementation(async () => upstream);
		const response = await app.request(endpoint, request(), env);
		assert.equal(response.status, status);
		const text = await response.text();
		assert.ok(
			!text.includes("secret error detail") &&
				!text.includes(env.DEEPSEEK_API_KEY),
		);
	}
	assert.equal(calls.mock.callCount(), 8);
	calls.mock.mockImplementation(async () => {
		throw new Error("network failure");
	});
	assert.equal((await app.request(endpoint, request(), env)).status, 502);
});
