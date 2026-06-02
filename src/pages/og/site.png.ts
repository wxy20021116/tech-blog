import type { APIRoute } from "astro";
import { renderSiteOgImage } from "@utils/og-image";

export const GET: APIRoute = async () => {
	const body = await renderSiteOgImage();
	return new Response(body, {
		headers: {
			"Content-Type": "image/png",
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
};
