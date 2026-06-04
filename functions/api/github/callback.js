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

	const redirectUrl = new URL("/portfolio/publish/?auth=ok", request.url).toString();
	const headers = new Headers();
	headers.set("Set-Cookie", cookie(request, "github_access_token", tokenPayload.access_token, { maxAge: 60 * 60 * 24 * 30 }));
	headers.set("Content-Type", "text/html; charset=utf-8");
	headers.set("Cache-Control", "no-store");

	return new Response(redirectHtml(redirectUrl, tokenPayload.access_token), { status: 200, headers });
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

function cookie(request, name, value, options = {}) {
	const parts = [
		`${name}=${encodeURIComponent(value)}`,
		"Path=/",
		"SameSite=Lax",
		"HttpOnly",
	];

	if (new URL(request.url).protocol === "https:") {
		parts.push("Secure");
	}

	if (typeof options.maxAge === "number") {
		parts.push(`Max-Age=${options.maxAge}`);
	}

	return parts.join("; ");
}

function redirectHtml(url, token) {
	const safeUrl = escapeHtml(url);

	return `<!doctype html>
<html lang="zh-CN">
<head>
	<meta charset="utf-8">
	<meta name="robots" content="noindex,nofollow">
	<title>GitHub 授权成功</title>
</head>
<body>
	<script>
		sessionStorage.setItem("github_access_token", ${JSON.stringify(token)});
		location.replace(${JSON.stringify(url)});
	</script>
	<p>GitHub 授权成功，正在返回发布页...</p>
	<p><a href="${safeUrl}">如果没有自动返回，请点击这里</a></p>
</body>
</html>`;
}

function escapeHtml(value) {
	return String(value).replace(/[&<>"']/g, (char) => {
		const entities = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&#39;",
		};
		return entities[char];
	});
}
