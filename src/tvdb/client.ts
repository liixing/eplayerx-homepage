const TVDB_API = "https://api4.thetvdb.com/v4";
const TVDB_ARTWORK = "https://artworks.thetvdb.com";
const TOKEN_REFRESH_MS = 25 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20_000;

type TokenCache = {
	value: string;
	expiresAt: number;
};

let tokenCache: TokenCache | null = null;

export function tvdbLanguage(raw: string | undefined): string {
	const language = (raw ?? "en").trim().toLowerCase();
	if (
		language.startsWith("zh-hant") ||
		language.startsWith("zh-tw") ||
		language === "zh-hk"
	) {
		return "zht";
	}
	if (language.startsWith("zh")) return "zho";
	if (language.startsWith("ja")) return "jpn";
	if (language.startsWith("es")) return "spa";
	if (language.startsWith("fr")) return "fra";
	if (language.startsWith("de")) return "deu";
	if (language.startsWith("ar")) return "ara";
	return "eng";
}

export function artworkURL(image?: string | null): string | null {
	if (!image) return null;
	const trimmed = image.trim();
	if (!trimmed) return null;
	if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
		return trimmed;
	}
	const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
	return `${TVDB_ARTWORK}${path}`;
}

async function login(): Promise<string> {
	const now = Date.now();
	if (tokenCache && tokenCache.expiresAt > now + 60_000) {
		return tokenCache.value;
	}
	const apiKey = process.env.TVDB_API_KEY?.trim();
	if (!apiKey) {
		throw new Error("TVDB_API_KEY is not set");
	}
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const response = await fetch(`${TVDB_API}/login`, {
			method: "POST",
			headers: {
				accept: "application/json",
				"content-type": "application/json",
			},
			body: JSON.stringify({ apikey: apiKey }),
			signal: controller.signal,
		});
		const json = (await response.json().catch(() => null)) as {
			status?: string;
			data?: { token?: string };
		} | null;
		const token = json?.data?.token;
		if (!response.ok || !token) {
			throw new Error("TVDB login failed");
		}
		tokenCache = { value: token, expiresAt: now + TOKEN_REFRESH_MS };
		return token;
	} finally {
		clearTimeout(timeout);
	}
}

export async function tvdbGet<T>(path: string): Promise<T> {
	const token = await login();
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const response = await fetch(`${TVDB_API}${path}`, {
			headers: {
				accept: "application/json",
				authorization: `Bearer ${token}`,
			},
			signal: controller.signal,
		});
		const json = (await response.json().catch(() => null)) as T | null;
		if (!response.ok || !json) {
			throw new Error(`TVDB request failed: ${path}`);
		}
		return json;
	} finally {
		clearTimeout(timeout);
	}
}
