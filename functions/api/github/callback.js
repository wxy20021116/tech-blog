export async function onRequestGet({ request, env }) {
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	const cookies = parseCookies(request.headers.get("Cookie") || "");
	const expectedState = cookies.github_oauth_state;

	if (!code || !state || !expectedState || state !== expectedState) {
		return Response.redirect(new URL("/portfolio/publish/?auth=failed", request.url), 302);
	}

	if (!env.GITHUB_OAUTH_CLIENT_ID || !env.GITHUB_OAUTH_CLIENT_SECRET) {
		return Response.redirect(new URL("/portfolio/publish/?auth=missing", request.url), 302);
	}

	const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			client_id: env.GITHUB_OAUTH_CLIENT_ID,
			client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
			code,
			redirect_uri: new URL("/api/github/callback", request.url).toString(),
		}),
	});
	const tokenPayload = await tokenResponse.json();

	if (!tokenResponse.ok || !tokenPayload.access_token) {
		return Response.redirect(new URL("/portfolio/publish/?auth=failed", request.url), 302);
	}

	const headers = new Headers();
	headers.set("Location", new URL("/portfolio/publish/?auth=ok", request.url).toString());
	headers.append("Set-Cookie", cookie("github_oauth_state", "", { maxAge: 0 }));
	headers.append("Set-Cookie", cookie("github_access_token", tokenPayload.access_token, { maxAge: 60 * 60 * 24 * 30 }));

	return new Response(null, { status: 302, headers });
}

function parseCookies(cookieHeader) {
	return Object.fromEntries(
		cookieHeader
			.split(";")
			.map((part) => part.trim())
			.filter(Boolean)
			.map((part) => {
				const index = part.indexOf("=");
				return [
					decodeURIComponent(part.slice(0, index)),
					decodeURIComponent(part.slice(index + 1)),
				];
			}),
	);
}

function cookie(name, value, options = {}) {
	const parts = [
		`${name}=${encodeURIComponent(value)}`,
		"Path=/",
		"SameSite=Lax",
		"Secure",
		"HttpOnly",
	];

	if (typeof options.maxAge === "number") {
		parts.push(`Max-Age=${options.maxAge}`);
	}

	return parts.join("; ");
}
