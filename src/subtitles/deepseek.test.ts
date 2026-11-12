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

const openaiEnv = {
	...env,
	OPENAI_API_KEY: "openai-server-only-test-key",
	SUBTITLE_TRANSLATION_PROVIDER: "openai",
};

test("the unchanged client endpoint switches upstreams per request using server configuration", async (t) => {
	const { default: mainApp } = await import("../index.js");
	const calls = t.mock.method(globalThis, "fetch", async () => completion());
	for (const provider of ["openai", "deepseek", "openai"]) {
		const response = await mainApp.request(
			"/subtitles/deepseek/v1/chat/completions",
			request(
				{
					...body,
					provider: "caller-cannot-select-provider",
					max_completion_tokens: 999999,
					reasoning_effort: "high",
					store: true,
					tools: [{ type: "function" }],
				},
				{ Authorization: "Bearer client-key-must-not-be-forwarded" },
			),
			{ ...openaiEnv, SUBTITLE_TRANSLATION_PROVIDER: provider },
		);
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("Cache-Control"), "no-store");
		const [url, init] = calls.mock.calls.at(-1)?.arguments as unknown as [
			string,
			RequestInit,
		];
		const upstream = JSON.parse(String(init.body));
		assert.equal(
			url,
			provider === "openai"
				? "https://api.openai.com/v1/chat/completions"
				: "https://api.deepseek.com/chat/completions",
		);
		assert.equal(
			new Headers(init.headers).get("Authorization"),
			`Bearer ${provider === "openai" ? openaiEnv.OPENAI_API_KEY : env.DEEPSEEK_API_KEY}`,
		);
		assert.equal(init.redirect, "manual");
		assert.equal(
			upstream.model,
			provider === "openai" ? "gpt-6-luna" : "deepseek-flash",
		);
		assert.equal(upstream.stream, false);
		assert.equal(upstream.tools, undefined);
		assert.equal(upstream.provider, undefined);
		if (provider === "openai") {
			assert.equal(upstream.max_completion_tokens, 4096);
			assert.equal(upstream.reasoning_effort, "none");
			assert.equal(upstream.store, false);
			assert.equal(upstream.thinking, undefined);
			assert.equal(upstream.max_tokens, undefined);
		} else {
			assert.equal(upstream.max_tokens, 4096);
			assert.deepEqual(upstream.thinking, { type: "disabled" });
			assert.equal(upstream.reasoning_effort, undefined);
			assert.equal(upstream.max_completion_tokens, undefined);
		}
		const result = (await response.json()) as {
			choices: { message: { content: string } }[];
		};
		assert.equal(result.choices[0].message.content, '["你好","再见"]');
	}
	assert.equal(calls.mock.callCount(), 3);
});

test("OpenAI needs its own secret and shares the existing rate limit", async (t) => {
	const calls = t.mock.method(globalThis, "fetch", async () => completion());
	for (const bindings of [
		{ ...env, SUBTITLE_TRANSLATION_PROVIDER: "openai" },
		{ ...openaiEnv, SUBTITLE_RATE_LIMITER: undefined },
		{ ...openaiEnv, SUBTITLE_TRANSLATION_PROVIDER: "unknown" },
		{ ...openaiEnv, SUBTITLE_TRANSLATION_PROVIDER: "" },
	]) {
		assert.equal(
			(await app.request(endpoint, request(), bindings)).status,
			503,
		);
	}
	const blocked = await app.request(endpoint, request(), {
		...openaiEnv,
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
			await app.request(
				endpoint,
				request({ ...body, model: "gpt-6-luna" }),
				openaiEnv,
			)
		).status,
		400,
	);
	assert.equal(calls.mock.callCount(), 0);
	assert.equal(
		(
			await app.request(endpoint, request(), {
				...openaiEnv,
				DEEPSEEK_API_KEY: undefined,
			})
		).status,
		200,
	);
});

test("OpenAI supports single subtitles and the existing person-name memory contract", async (t) => {
	const calls = t.mock.method(globalThis, "fetch", async () =>
		completion("你好"),
	);
	const single = await app.request(
		endpoint,
		request({
			...body,
			messages: [
				{
					role: "system",
					content:
						"You are a professional subtitle translator. Translate the user's text into zh-Hans. CALLER INSTRUCTION",
				},
				{ role: "user", content: "Hello" },
			],
		}),
		openaiEnv,
	);
	assert.equal(single.status, 200);
	assert.equal(
		((await single.json()) as { choices: { message: { content: string } }[] })
			.choices[0].message.content,
		"你好",
	);
	const batch = { subtitles: ["John is here."], previous: [], names: [] };
	calls.mock.mockImplementation(async (_url, init) => {
		const upstream = JSON.parse(String(init?.body));
		assert.deepEqual(upstream.response_format, { type: "json_object" });
		assert.deepEqual(JSON.parse(upstream.messages[1].content), batch);
		assert.ok(!upstream.messages[0].content.includes("CALLER INSTRUCTION"));
		return completion(
			JSON.stringify({
				translations: ["约翰在这里。"],
				names: [
					{ source: "John", translation: "约翰" },
					{ source: "Unknown", translation: "不存在" },
				],
			}),
		);
	});
	const response = await app.request(
		endpoint,
		request({
			...body,
			messages: [
				{
					...body.messages[0],
					content: `${body.messages[0].content} CALLER INSTRUCTION`,
				},
				{ role: "user", content: JSON.stringify(batch) },
			],
		}),
		openaiEnv,
	);
	assert.equal(response.status, 200);
	const result = (await response.json()) as {
		choices: { message: { content: string } }[];
	};
	assert.deepEqual(JSON.parse(result.choices[0].message.content), {
		translations: ["约翰在这里。"],
		names: [{ source: "John", translation: "约翰" }],
	});
});

test("OpenAI failures do not retry or fall back to DeepSeek", async (t) => {
	const calls = t.mock.method(
		globalThis,
		"fetch",
		async () =>
			new Response(`secret detail ${openaiEnv.OPENAI_API_KEY}`, {
				status: 401,
			}),
	);
	const response = await app.request(endpoint, request(), openaiEnv);
	assert.equal(response.status, 502);
	assert.ok(!(await response.text()).includes(openaiEnv.OPENAI_API_KEY));
	assert.equal(calls.mock.callCount(), 1);
	calls.mock.mockImplementation(async () => completion(undefined, "length"));
	assert.equal((await app.request(endpoint, request(), openaiEnv)).status, 502);
	assert.equal(calls.mock.callCount(), 2);
});

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

test("person-name memory shares one translation request and preserves older clients", async (t) => {
	const names = [{ source: "John", translation: "约翰" }];
	const subtitles = ["John is here.", "Ann left."];
	const responseBody = {
		translations: ["约翰在这里。", "安走了。"],
		names: [
			{ source: "Ann", translation: "安", extra: "discard" },
			{ source: "Nobody", translation: "不存在" },
			{ source: "John", translation: "并未出现的译名" },
			{ source: "", translation: "无效" },
		],
	};
	const calls = t.mock.method(
		globalThis,
		"fetch",
		async (_url: Parameters<typeof fetch>[0], init?: RequestInit) => {
			const upstream = JSON.parse(String(init?.body));
			const payload = JSON.parse(upstream.messages[1].content);
			assert.deepEqual(payload.names, names);
			assert.deepEqual(upstream.response_format, { type: "json_object" });
			assert.ok(upstream.messages[0].content.includes("reuse them exactly"));
			assert.ok(
				upstream.messages[0].content.includes("inferred identities or aliases"),
			);
			return completion(JSON.stringify(responseBody));
		},
	);
	const response = await app.request(
		endpoint,
		request({
			...body,
			messages: [
				body.messages[0],
				{
					role: "user",
					content: JSON.stringify({ subtitles, previous: [], names }),
				},
			],
		}),
		env,
	);
	assert.equal(response.status, 200);
	const result = (await response.json()) as {
		choices: { message: { content: string } }[];
	};
	assert.deepEqual(JSON.parse(result.choices[0].message.content), {
		translations: responseBody.translations,
		names: [{ source: "Ann", translation: "安" }],
	});
	assert.equal(calls.mock.callCount(), 1);
});

test("optional name learning tolerates legacy arrays and malformed name metadata", async (t) => {
	const calls = t.mock.method(globalThis, "fetch");
	for (const output of [
		'["你好","再见"]',
		JSON.stringify({ translations: ["你好", "再见"], names: 42 }),
	]) {
		calls.mock.mockImplementation(async () => completion(output));
		const response = await app.request(
			endpoint,
			request({
				...body,
				messages: [
					body.messages[0],
					{
						role: "user",
						content: JSON.stringify({
							subtitles: ["Hello", "Goodbye"],
							previous: [],
							names: [],
						}),
					},
				],
			}),
			env,
		);
		assert.equal(response.status, 200);
		const result = (await response.json()) as {
			choices: { message: { content: string } }[];
		};
		assert.deepEqual(JSON.parse(result.choices[0].message.content), {
			translations: ["你好", "再见"],
			names: [],
		});
	}
});

test("invalid or oversized name glossaries never reach the paid provider", async (t) => {
	const calls = t.mock.method(globalThis, "fetch", async () => completion());
	for (const names of [
		null,
		{},
		Array(33).fill({ source: "John", translation: "约翰" }),
		[{ source: "", translation: "约翰" }],
		[{ source: "John", translation: "x".repeat(81) }],
		[{ source: "John\n", translation: "约翰" }],
	]) {
		const response = await app.request(
			endpoint,
			request({
				...body,
				messages: [
					body.messages[0],
					{
						role: "user",
						content: JSON.stringify({
							subtitles: ["Hello", "Goodbye"],
							previous: [],
							names,
						}),
					},
				],
			}),
			env,
		);
		assert.equal(response.status, 400);
	}
	assert.equal(calls.mock.callCount(), 0);
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
		[new Response("secret error detail", { status: 503 }), 503],
		[new Response("not JSON"), 502],
		[completion('["你好"]'), 502],
		[completion('["你好",""]'), 502],
		[completion(undefined, "length"), 502],
		[new Response("x".repeat(1_048_577)), 502],
	] as const) {
		calls.mock.mockImplementation(async () => upstream);
		const response = await app.request(endpoint, request(), env);
		assert.equal(response.status, status);
		if (status === 503) assert.equal(response.headers.get("Retry-After"), "10");
		const text = await response.text();
		assert.ok(
			!text.includes("secret error detail") &&
				!text.includes(env.DEEPSEEK_API_KEY),
		);
	}
	assert.equal(calls.mock.callCount(), 9);
	calls.mock.mockImplementation(async () => {
		throw new Error("network failure");
	});
	assert.equal((await app.request(endpoint, request(), env)).status, 502);
});
