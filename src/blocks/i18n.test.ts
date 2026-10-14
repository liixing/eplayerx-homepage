import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import {
	browserToContentLanguage,
	browserToUiLocale,
	CONTENT_STORAGE_KEY,
	clientI18nBootScript,
	clientI18nRuntimeScript,
	contentLangToUiLocale,
	MESSAGES,
	resolveUiLocale,
	t,
	UI_LOCALES,
	UI_STORAGE_KEY,
} from "./i18n.js";

test("Vietnamese translations cover every key and preserve placeholders", () => {
	assert.deepEqual(
		Object.keys(MESSAGES.vi).sort(),
		Object.keys(MESSAGES.en).sort(),
	);
	for (const [key, value] of Object.entries(MESSAGES.en)) {
		const placeholders = (text: string) =>
			(text.match(/\{\w+\}/g) ?? []).sort();
		assert.ok(MESSAGES.vi[key].trim(), key);
		assert.deepEqual(placeholders(MESSAGES.vi[key]), placeholders(value), key);
	}
	assert.equal(
		t("vi", "block.meta_items", { n: 3, installs: 12 }),
		"3 mục · 12 lượt cài đặt",
	);
});

test("Vietnamese is selectable and detected from browser and content languages", () => {
	assert.ok(
		UI_LOCALES.some(
			(locale) => locale.code === "vi" && locale.label === "Tiếng Việt",
		),
	);
	for (const tag of ["vi", "vi-VN", "VI_vn"]) {
		assert.equal(browserToContentLanguage(tag), "vi-VN");
		assert.equal(browserToUiLocale(tag), "vi");
		assert.equal(resolveUiLocale(null, [tag, "en-US"]), "vi");
	}
	assert.equal(contentLangToUiLocale("vi-VN"), "vi");
	assert.equal(resolveUiLocale("vi", ["en-US"]), "vi");
	assert.equal(resolveUiLocale("en", ["vi-VN"]), "en");
});

test("generated browser scripts detect, restore and switch Vietnamese", () => {
	for (const [saved, languages, expected] of [
		[null, ["vi-VN", "en-US"], "vi"],
		[null, ["VI_vn"], "vi"],
		["vi", ["en-US"], "vi"],
		["en", ["vi-VN"], "en"],
	] as const) {
		const storage = new Map<string, string>(
			saved ? [[UI_STORAGE_KEY, saved]] : [],
		);
		const html = { lang: "", dir: "" };
		const context = {
			window: {} as {
				__BLOCKS_I18N__: {
					ui: string;
					contentPreferred: string;
					contentToUi: (code: string) => string;
				};
				t: (key: string) => string;
				setBlocksUiLang: (locale: string) => void;
			},
			document: {
				documentElement: html,
				querySelectorAll: () => [],
				querySelector: () => null,
				getElementById: () => null,
			},
			navigator: { languages },
			localStorage: {
				getItem: (key: string) => storage.get(key) ?? null,
				setItem: (key: string, value: string) => storage.set(key, value),
			},
		};
		runInNewContext(clientI18nBootScript(), context);
		assert.equal(context.window.__BLOCKS_I18N__.ui, expected);
		assert.equal(html.lang, expected);
		assert.equal(html.dir, "ltr");
		assert.equal(context.window.__BLOCKS_I18N__.contentToUi("vi-VN"), "vi");
		assert.equal(
			context.window.__BLOCKS_I18N__.contentPreferred,
			browserToContentLanguage(languages[0]),
		);
		runInNewContext(clientI18nRuntimeScript(), context);
		context.window.setBlocksUiLang("ar");
		context.window.setBlocksUiLang("vi");
		assert.equal(html.lang, "vi");
		assert.equal(html.dir, "ltr");
		assert.equal(storage.get(UI_STORAGE_KEY), "vi");
		assert.equal(storage.has(CONTENT_STORAGE_KEY), false);
		assert.equal(context.window.t("nav.ui_lang"), "Ngôn ngữ giao diện");
	}
});
