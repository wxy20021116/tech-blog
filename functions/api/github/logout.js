export async function onRequestPost() {
	return new Response(JSON.stringify({ ok: true }), {
		headers: {
			"Content-Type": "application/json",
			"Set-Cookie": "github_access_token=; Path=/; SameSite=Lax; Secure; HttpOnly; Max-Age=0",
		},
	});
}
