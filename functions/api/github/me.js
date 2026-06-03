export async function onRequestGet({ request }) {
	const token = getToken(request);

	if (!token) {
		return json({ authenticated: false });
	}

	const response = await githubFetch("https://api.github.com/user", token);

	if (!response.ok) {
		return json({ authenticated: false });
	}

	const user = await response.json();
	return json({
		authenticated: true,
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
	return cookies.github_access_token || "";
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

function githubFetch(url, token, options = {}) {
	return fetch(url, {
		...options,
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${token}`,
			"X-GitHub-Api-Version": "2022-11-28",
			...(options.headers || {}),
		},
	});
}

function json(payload, init = {}) {
	return new Response(JSON.stringify(payload), {
		...init,
		headers: {
			"Content-Type": "application/json",
			...(init.headers || {}),
		},
	});
}
