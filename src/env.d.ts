/// <reference types="astro/client" />
/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
	readonly PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN?: string;
	readonly PUBLIC_GISCUS_CATEGORY_ID?: string;
	readonly PUBLIC_GISCUS_REPO_ID?: string;
}
