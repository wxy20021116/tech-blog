const DEFAULT_ALLOWED_LOGIN = "wxy20021116";

export async function onRequestGet({ request, env }) {
	const token = getToken(request);

	if (!token) {
		return json({ authenticated: false, allowed: false, reason: "missing_token" });
	}

	const response = await githubFetch("https://api.github.com/user", token);

	if (!response.ok) {
		return json({ authenticated: false, allowed: false, reason: "invalid_token" });
	}

	const user = await response.json();
	const allowedLogin = (env.GITHUB_ALLOWED_LOGIN || env.GITHUB_OWNER || DEFAULT_ALLOWED_LOGIN).toLowerCase();
	const allowed = String(user.login || "").toLowerCase() === allowedLogin;

	return json({
		authenticated: true,
		allowed,
		login: user.login,
		avatarUrl: user.avatar_url,
	});
}

function getToken(request) {
	const authorization = request.headers.get("Authorization") || "";
	if (authorization.startsWith("Bearer ")) {
		return authorization.slice("Bearer ".length);
	}
	const cookies = parseCookies(request.headers.get("Cookie") || "");
	if (cookies.github_access_token) return cookies.github_access_token;
	return "";
}

function parseCookies(cookieHeader) {
	return Object.fromEntries(
		cookieHeader
			.split(";")
			.map((part) => part.trim())
			.filter(Boolean)
			.map((part) => {
				const index = part.indexOf("=");
				if (index === -1) return [decodeURIComponent(part), ""];
				return [
					decodeURIComponent(part.slice(0, index)),
					decodeURIComponent(part.slice(index + 1)),
				];
			}),
	);
}

function githubFetch(url, token, options = {}) {
	return fetch(url, {
		...options,
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${token}`,
			"User-Agent": "hiauto-tech-blog",
			"X-GitHub-Api-Version": "2022-11-28",
			...(options.headers || {}),
		},
	});
}

function json(payload, init = {}) {
	return new Response(JSON.stringify(payload), {
		...init,
		headers: {
			"Cache-Control": "no-store",
			"Content-Type": "application/json",
			...(init.headers || {}),
		},
	});
}
