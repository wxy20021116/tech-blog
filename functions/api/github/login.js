const DEFAULT_SCOPE = "public_repo";

export async function onRequestGet({ request, env }) {
	const clientId = env.GITHUB_OAUTH_CLIENT_ID;

	if (!clientId) {
		return Response.redirect(new URL("/portfolio/publish/?auth=missing", request.url), 302);
	}

	const redirectUri = new URL("/api/github/callback", request.url).toString();
	const state = crypto.randomUUID();
	const authorizeUrl = new URL("https://github.com/login/oauth/authorize");

	authorizeUrl.searchParams.set("client_id", clientId);
	authorizeUrl.searchParams.set("redirect_uri", redirectUri);
	authorizeUrl.searchParams.set("scope", env.GITHUB_OAUTH_SCOPE || DEFAULT_SCOPE);
	authorizeUrl.searchParams.set("state", state);

	const headers = new Headers();
	headers.set("Location", authorizeUrl.toString());
	headers.set("Set-Cookie", cookie("github_oauth_state", state, { maxAge: 600 }));

	return new Response(null, { status: 302, headers });
}

function cookie(name, value, options = {}) {
	const parts = [
		`${name}=${encodeURIComponent(value)}`,
		"Path=/",
		"SameSite=Lax",
		"Secure",
		"HttpOnly",
	];

	if (options.maxAge) {
		parts.push(`Max-Age=${options.maxAge}`);
	}

	return parts.join("; ");
}
