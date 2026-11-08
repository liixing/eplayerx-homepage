import { decode, verify } from "hono/jwt";

export type TimingActor = { email: string; role: "owner" | "editor" };
export type TimingAccessBindings = {
	TIMING_ACCESS_ISSUER?: string;
	TIMING_ACCESS_AUDIENCE?: string;
	TIMING_OWNER_EMAIL?: string;
};

type AccessKey = JsonWebKey & { kid: string };
let cachedKeys:
	| { issuer: string; expiresAt: number; keys: AccessKey[] }
	| undefined;

export function timingEmail(value: unknown) {
	if (typeof value !== "string") return undefined;
	const email = value.trim().toLowerCase();
	return email.length <= 254 && /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email)
		? email
		: undefined;
}

export function timingAccessConfig(env: TimingAccessBindings | undefined) {
	const issuer = env?.TIMING_ACCESS_ISSUER?.trim().replace(/\/$/, "");
	const audience = env?.TIMING_ACCESS_AUDIENCE?.trim();
	const owner = timingEmail(env?.TIMING_OWNER_EMAIL);
	if (
		!issuer ||
		!/^https:\/\/[a-z\d-]+\.cloudflareaccess\.com$/.test(issuer) ||
		!audience ||
		!owner
	)
		return null;
	return { issuer, audience, owner };
}

async function accessKeys(issuer: string) {
	if (cachedKeys?.issuer === issuer && cachedKeys.expiresAt > Date.now())
		return cachedKeys.keys;
	const response = await fetch(`${issuer}/cdn-cgi/access/certs`, {
		// Workers support manual redirects. The status check below rejects them.
		redirect: "manual",
		signal: AbortSignal.timeout(3000),
	});
	if (!response.ok) throw new Error("Access keys unavailable");
	const payload = (await response.json()) as { keys?: AccessKey[] };
	if (!Array.isArray(payload.keys) || !payload.keys.length)
		throw new Error("Access keys missing");
	cachedKeys = { issuer, keys: payload.keys, expiresAt: Date.now() + 300_000 };
	return cachedKeys.keys;
}

export async function authenticatedTimingEmail(
	token: string | undefined,
	config: NonNullable<ReturnType<typeof timingAccessConfig>>,
) {
	if (!token || token.length > 8192) return undefined;
	try {
		const {
			header: { alg, kid },
		} = decode(token);
		if (alg !== "RS256" || typeof kid !== "string" || !kid) return undefined;
		const keys = await accessKeys(config.issuer);
		const key = keys.find(
			(key) =>
				key.kty === "RSA" &&
				key.kid === kid &&
				(!key.alg || key.alg === "RS256"),
		);
		if (!key) return undefined;
		const payload = await verify(token, key, {
			alg: "RS256",
			iss: config.issuer,
		});
		if (
			payload.type !== "app" ||
			!Array.isArray(payload.aud) ||
			!payload.aud.includes(config.audience) ||
			typeof payload.exp !== "number" ||
			!Number.isSafeInteger(payload.exp) ||
			payload.exp <= Date.now() / 1000
		)
			return undefined;
		return timingEmail(payload.email);
	} catch {
		return undefined;
	}
}
