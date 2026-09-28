import { Hono } from "hono";

const app = new Hono();

// Baidu requires an HTTPS redirect; iOS captures this fixed app URL in ASWebAuthenticationSession.
app.get("/callback", (c) => {
	c.header("Cache-Control", "no-store");
	c.header("Referrer-Policy", "no-referrer");
	c.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
	const query = new URL(c.req.url).searchParams;
	const state = query.get("state");
	const code = query.get("code");
	const error = query.get("error");
	if (
		query.getAll("state").length !== 1 || !state || !/^[a-f0-9]{64}$/.test(state) ||
		(code !== null && error !== null) ||
		(code !== null ? query.getAll("code").length !== 1 || !code || code.length > 2048 || /[\x00-\x1f\x7f]/.test(code)
			: query.getAll("error").length !== 1 || !error || !/^[a-z_]{1,80}$/.test(error))
	) return c.text("Invalid authorization response. Please start login again in EplayerX.", 400);

	const target = new URL("eplayerx://baidu-callback");
	target.searchParams.set("state", state);
	if (code !== null) target.searchParams.set("code", code);
	else target.searchParams.set("error", error!);
	return c.redirect(target.href, 302);
});

export default app;
