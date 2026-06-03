export async function onRequestPost({ request }) {
	return new Response(JSON.stringify({ ok: true }), {
		headers: {
			"Content-Type": "application/json",
			"Set-Cookie": cookie(request, "github_access_token", "", { maxAge: 0 }),
		},
	});
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
