import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";
import { renderPostOgImage } from "@utils/og-image";

export const getStaticPaths = (async () => {
	const posts = await getCollection("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});

	return posts.map((post) => ({
		params: { slug: post.slug },
		props: { post },
	}));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
	const body = await renderPostOgImage(props.post);
	return new Response(body, {
		headers: {
			"Content-Type": "image/png",
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
};
