import type {
	AnalyticsConfig,
	BusuanziConfig,
	CommentConfig,
	ExpressiveCodeConfig,
	LicenseConfig,
	NavBarConfig,
	ProfileConfig,
	SiteConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";

export const siteConfig: SiteConfig = {
	title: "Kris_Wen Tech Notes",
	subtitle: "把日常开发沉淀成可复用的工程经验",
	keywords: [
		"后端开发",
		"Web 开发",
		"PDA",
		"多端协同",
		"状态一致性",
		"系统设计",
		"工程实践",
	],
	lang: "zh_CN", // Language code, e.g. 'en', 'zh_CN', 'ja', etc.
	themeColor: {
		hue: 200, // Default hue for the theme color, from 0 to 360. e.g. red: 0, teal: 200, cyan: 250, pink: 345
		fixed: false, // Hide the theme color picker for visitors
	},
	banner: {
		enable: false,
		src: "assets/images/demo-banner.png", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
		position: "center", // Equivalent to object-position, only supports 'top', 'center', 'bottom'. 'center' by default
		credit: {
			enable: false, // Display the credit text of the banner image
			text: "", // Credit text to be displayed
			url: "", // (Optional) URL link to the original artwork or artist's page
		},
	},
	toc: {
		enable: true, // Display the table of contents on the right side of the post
		depth: 2, // Maximum heading depth to show in the table, from 1 to 3
	},
	favicon: [
		{
			src: "/favicon/blog-logo-32.png",
			sizes: "32x32",
		},
		{
			src: "/favicon/blog-logo-180.png",
			sizes: "180x180",
		},
		{
			src: "/favicon/blog-logo-192.png",
			sizes: "192x192",
		},
	],
};

export const navBarConfig: NavBarConfig = {
	links: [
		LinkPreset.Home,
		LinkPreset.Archive,
		LinkPreset.About,
		{
			name: "GitHub",
			url: "https://github.com/wxy20021116/tech-blog", // Internal links should not include the base path, as it is automatically added
			external: true, // Show an external link icon and will open in a new tab
		},
	],
};

export const profileConfig: ProfileConfig = {
	avatar: "assets/images/lhc.jpg", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
	name: "Kris_Wen",
	bio: "记录后端、Web、PDA 多端协同开发中的工程实践。",
	links: [
		{
			name: "GitHub",
			icon: "fa6-brands:github",
			url: "https://github.com/wxy20021116",
		},
	],
};

export const licenseConfig: LicenseConfig = {
	enable: true,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	// Note: Some styles (such as background color) are being overridden, see the astro.config.mjs file.
	// Please select a dark theme, as this blog theme currently only supports dark background color
	theme: "github-dark",
};

// ---------------------------------------------------------------------------
// Giscus comments (powered by GitHub Discussions).
//
// One-time setup, all on github.com:
//   1. Make the repo below PUBLIC.
//   2. Repo -> Settings -> General -> Features -> enable "Discussions".
//   3. Install the giscus app: https://github.com/apps/giscus (grant it this repo).
//   4. Open https://giscus.app, enter the repo, pick a category (e.g. "Announcements"),
//      then copy the generated `data-category-id` into `categoryId` below.
//
// Until Discussions are enabled and categoryId is filled in, the comment box simply does not render
// (the site still builds and works normally).
// ---------------------------------------------------------------------------
export const commentConfig: CommentConfig = {
	enable: true,
	giscus: {
		repo: "wxy20021116/tech-blog",
		repoId: import.meta.env.PUBLIC_GISCUS_REPO_ID ?? "R_kgDOSq6q7g",
		category: "Announcements",
		categoryId: import.meta.env.PUBLIC_GISCUS_CATEGORY_ID ?? "",
		mapping: "pathname",
		strict: false,
		reactionsEnabled: true,
		emitMetadata: false,
		inputPosition: "bottom",
		lang: "zh-CN",
	},
};

// 不蒜子 page view / visitor counters. No account or key required.
export const busuanziConfig: BusuanziConfig = {
	enable: true,
	src: "https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js",
};

// Cloudflare Web Analytics (privacy-friendly, cookieless).
//   Option A (zero code): in the Cloudflare Pages project enable Web Analytics — done.
//   Option B (this config): paste the beacon token from
//     Cloudflare dashboard → Web Analytics → site → JS snippet.
export const analyticsConfig: AnalyticsConfig = {
	cloudflare: {
		enable: true,
		token: import.meta.env.PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN ?? "",
	},
};
