import type { AUTO_MODE, DARK_MODE, LIGHT_MODE } from "@constants/constants";

export type SiteConfig = {
	title: string;
	subtitle: string;
	keywords: string[];

	lang:
		| "en"
		| "zh_CN"
		| "zh_TW"
		| "ja"
		| "ko"
		| "es"
		| "th"
		| "vi"
		| "tr"
		| "id";

	themeColor: {
		hue: number;
		fixed: boolean;
	};
	banner: {
		enable: boolean;
		src: string;
		position?: "top" | "center" | "bottom";
		credit: {
			enable: boolean;
			text: string;
			url?: string;
		};
	};
	toc: {
		enable: boolean;
		depth: 1 | 2 | 3;
	};

	favicon: Favicon[];
};

export type Favicon = {
	src: string;
	theme?: "light" | "dark";
	sizes?: string;
};

export enum LinkPreset {
	Home = 0,
	Archive = 1,
	About = 2,
}

export type NavBarLink = {
	name: string;
	url: string;
	external?: boolean;
};

export type NavBarConfig = {
	links: (NavBarLink | LinkPreset)[];
};

export type ProfileConfig = {
	avatar?: string;
	name: string;
	bio?: string;
	links: {
		name: string;
		url: string;
		icon: string;
	}[];
};

export type LicenseConfig = {
	enable: boolean;
	name: string;
	url: string;
};

export type GiscusConfig = {
	/** GitHub repository in the form "owner/repo". Must be public with Discussions enabled. */
	repo: string;
	/** Repository ID from giscus.app (looks like "R_..."). */
	repoId: string;
	/** Discussion category name, e.g. "Announcements". */
	category: string;
	/** Discussion category ID from giscus.app (looks like "DIC_..."). */
	categoryId: string;
	/** How posts map to discussions. "pathname" is recommended. */
	mapping: "pathname" | "url" | "title" | "og:title";
	/** Use strict title matching (1) or not (0). */
	strict: boolean;
	/** Enable reactions on the main post. */
	reactionsEnabled: boolean;
	/** Emit discussion metadata. */
	emitMetadata: boolean;
	/** Comment box position. */
	inputPosition: "top" | "bottom";
	/** giscus UI language code, e.g. "zh-CN", "en". */
	lang: string;
};

export type CommentConfig = {
	enable: boolean;
	giscus: GiscusConfig;
};

export type HitokotoConfig = {
	/** Show a random 一言 (hitokoto) signature line in the footer. */
	enable: boolean;
	/**
	 * Hitokoto API endpoint returning JSON `{ hitokoto, from, from_who, ... }`.
	 * Defaults to the official endpoint. Append query params to filter by type,
	 * e.g. `https://v1.hitokoto.cn/?c=d&c=i` for literature / net quotes.
	 */
	api: string;
};

export type UptimeConfig = {
	/** Show the live "本站已稳定运行 …" counter in the footer. */
	enable: boolean;
	/**
	 * When the site went live, as anything `new Date()` accepts (ISO 8601 with a
	 * timezone is recommended). The footer counts up from this moment in real time.
	 */
	since: string;
};

export type BusuanziConfig = {
	/** Show 不蒜子 page view / visitor counters. */
	enable: boolean;
	/**
	 * Script source. Defaults to the official 不蒜子 endpoint.
	 * If it is unreachable you can switch to an API-compatible mirror, e.g.
	 *   https://busuanzi.9420.ltd/js
	 *   https://cn.vercount.one/js   (vercount, same span IDs)
	 * without any other code changes.
	 */
	src: string;
};

export type AnalyticsConfig = {
	cloudflare: {
		enable: boolean;
		/**
		 * Cloudflare Web Analytics beacon token. Get it from
		 * Cloudflare dashboard → Web Analytics → your site → JS snippet.
		 * Leave empty if you instead enable Web Analytics directly on the
		 * Cloudflare Pages project (zero-code auto injection).
		 */
		token: string;
	};
};

export type LIGHT_DARK_MODE =
	| typeof LIGHT_MODE
	| typeof DARK_MODE
	| typeof AUTO_MODE;

export type BlogPostData = {
	body: string;
	title: string;
	published: Date;
	description: string;
	tags: string[];
	draft?: boolean;
	image?: string;
	category?: string;
	prevTitle?: string;
	prevSlug?: string;
	nextTitle?: string;
	nextSlug?: string;
};

export type ExpressiveCodeConfig = {
	theme: string;
};
