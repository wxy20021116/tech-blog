import { type CollectionEntry, getCollection } from "astro:content";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { getCategoryUrl } from "@utils/url-utils.ts";

// // Retrieve posts and sort them by publication date
async function getRawSortedPosts() {
	const allBlogPosts = await getCollection("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});

	const sorted = allBlogPosts.sort((a, b) => {
		const dateA = new Date(a.data.published);
		const dateB = new Date(b.data.published);
		return dateA > dateB ? -1 : 1;
	});
	return sorted;
}

export async function getSortedPosts() {
	const sorted = await getRawSortedPosts();

	for (let i = 1; i < sorted.length; i++) {
		sorted[i].data.nextSlug = sorted[i - 1].slug;
		sorted[i].data.nextTitle = sorted[i - 1].data.title;
	}
	for (let i = 0; i < sorted.length - 1; i++) {
		sorted[i].data.prevSlug = sorted[i + 1].slug;
		sorted[i].data.prevTitle = sorted[i + 1].data.title;
	}

	return sorted;
}

// Recommend posts related to the given one, ranked by shared tags (weighted)
// and by sharing the same category. Falls back to the most recent posts when
// there are not enough tag/category matches, so the section is never empty.
export async function getRelatedPosts(
	currentSlug: string,
	count = 6,
): Promise<CollectionEntry<"posts">[]> {
	const all = await getRawSortedPosts(); // already date-desc, drafts excluded in prod
	const current = all.find((p) => p.slug === currentSlug);
	if (!current) return [];

	const normalize = (s: string) => s.trim().toLowerCase();
	const currentTags = new Set((current.data.tags ?? []).map(normalize));
	const currentCategory = current.data.category
		? normalize(current.data.category)
		: "";

	const candidates = all.filter((p) => p.slug !== currentSlug);

	const scored = candidates
		.map((post) => {
			const sharedTags = (post.data.tags ?? []).filter((t) =>
				currentTags.has(normalize(t)),
			).length;
			const sameCategory =
				currentCategory &&
				post.data.category &&
				normalize(post.data.category) === currentCategory
					? 1
					: 0;
			return { post, score: sharedTags * 2 + sameCategory };
		})
		.filter((x) => x.score > 0)
		.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			return (
				new Date(b.post.data.published).getTime() -
				new Date(a.post.data.published).getTime()
			);
		})
		.map((x) => x.post);

	if (scored.length >= count) return scored.slice(0, count);

	// Top up with the most recent posts that are not already included.
	const chosen = new Set(scored.map((p) => p.slug));
	const fillers = candidates.filter((p) => !chosen.has(p.slug));
	return [...scored, ...fillers].slice(0, count);
}
export type PostForList = {
	slug: string;
	data: CollectionEntry<"posts">["data"];
};
export async function getSortedPostsList(): Promise<PostForList[]> {
	const sortedFullPosts = await getRawSortedPosts();

	// delete post.body
	const sortedPostsList = sortedFullPosts.map((post) => ({
		slug: post.slug,
		data: post.data,
	}));

	return sortedPostsList;
}
export type Tag = {
	name: string;
	count: number;
};

export async function getTagList(): Promise<Tag[]> {
	const allBlogPosts = await getCollection<"posts">("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});

	const countMap: { [key: string]: number } = {};
	allBlogPosts.forEach((post: { data: { tags: string[] } }) => {
		post.data.tags.forEach((tag: string) => {
			if (!countMap[tag]) countMap[tag] = 0;
			countMap[tag]++;
		});
	});

	// sort tags
	const keys: string[] = Object.keys(countMap).sort((a, b) => {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	return keys.map((key) => ({ name: key, count: countMap[key] }));
}

export type Category = {
	name: string;
	count: number;
	url: string;
};

export async function getCategoryList(): Promise<Category[]> {
	const allBlogPosts = await getCollection<"posts">("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});
	const count: { [key: string]: number } = {};
	allBlogPosts.forEach((post: { data: { category: string | null } }) => {
		if (!post.data.category) {
			const ucKey = i18n(I18nKey.uncategorized);
			count[ucKey] = count[ucKey] ? count[ucKey] + 1 : 1;
			return;
		}

		const categoryName =
			typeof post.data.category === "string"
				? post.data.category.trim()
				: String(post.data.category).trim();

		count[categoryName] = count[categoryName] ? count[categoryName] + 1 : 1;
	});

	const lst = Object.keys(count).sort((a, b) => {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	const ret: Category[] = [];
	for (const c of lst) {
		ret.push({
			name: c,
			count: count[c],
			url: getCategoryUrl(c),
		});
	}
	return ret;
}
