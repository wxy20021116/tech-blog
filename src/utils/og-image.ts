import type { CollectionEntry } from "astro:content";
import sharp from "sharp";
import { profileConfig, siteConfig } from "@/config";
import { formatDateToYYYYMMDD } from "@utils/date-utils";

const WIDTH = 1200;
const HEIGHT = 630;

function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function wrapText(text: string, maxChars: number, maxLines: number): string[] {
	const normalized = text.replace(/\s+/g, " ").trim();
	const lines: string[] = [];
	let current = "";

	for (const char of normalized) {
		const next = current + char;
		if (next.length > maxChars && current.length > 0) {
			lines.push(current);
			current = char.trimStart();
			if (lines.length === maxLines) break;
		} else {
			current = next;
		}
	}

	if (current && lines.length < maxLines) lines.push(current);
	if (lines.length === maxLines && normalized.length > lines.join("").length) {
		lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[。,.，、\s]+$/g, "")}...`;
	}
	return lines;
}

function textBlock(
	lines: string[],
	x: number,
	y: number,
	lineHeight: number,
	className: string,
): string {
	return lines
		.map(
			(line, index) =>
				`<text x="${x}" y="${y + index * lineHeight}" class="${className}">${escapeXml(line)}</text>`,
		)
		.join("");
}

export async function renderPostOgImage(
	post: CollectionEntry<"posts">,
): Promise<Buffer> {
	const titleLines = wrapText(post.data.title, 19, 3);
	const descriptionLines = wrapText(post.data.description || siteConfig.subtitle, 34, 2);
	const tags = post.data.tags.slice(0, 4);
	const category = post.data.category?.trim() || "技术实践";
	const published = formatDateToYYYYMMDD(post.data.published);

	const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
	<defs>
		<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0%" stop-color="#f8fbff"/>
			<stop offset="48%" stop-color="#edf7f8"/>
			<stop offset="100%" stop-color="#fff6ed"/>
		</linearGradient>
		<linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
			<stop offset="0%" stop-color="#0ea5e9"/>
			<stop offset="55%" stop-color="#14b8a6"/>
			<stop offset="100%" stop-color="#f59e0b"/>
		</linearGradient>
		<filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
			<feDropShadow dx="0" dy="20" stdDeviation="24" flood-color="#0f172a" flood-opacity="0.14"/>
		</filter>
		<style>
			.base { font-family: "Microsoft YaHei", "Noto Sans CJK SC", "PingFang SC", "Segoe UI", Arial, sans-serif; }
			.title { font-size: 64px; font-weight: 800; fill: #111827; letter-spacing: 0; }
			.desc { font-size: 28px; font-weight: 500; fill: #475569; letter-spacing: 0; }
			.meta { font-size: 24px; font-weight: 600; fill: #475569; letter-spacing: 0; }
			.brand { font-size: 30px; font-weight: 800; fill: #0f172a; letter-spacing: 0; }
			.small { font-size: 22px; font-weight: 600; fill: #64748b; letter-spacing: 0; }
			.tag { font-size: 22px; font-weight: 700; fill: #0f766e; letter-spacing: 0; }
		</style>
	</defs>
	<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
	<rect x="56" y="52" width="1088" height="526" rx="32" fill="#ffffff" filter="url(#shadow)"/>
	<rect x="56" y="52" width="1088" height="526" rx="32" fill="none" stroke="#dbeafe" stroke-width="2"/>
	<rect x="96" y="94" width="118" height="8" rx="4" fill="url(#accent)"/>
	<circle cx="1044" cy="126" r="58" fill="#e0f2fe"/>
	<circle cx="1090" cy="172" r="22" fill="#ccfbf1"/>
	<path d="M944 480 C1004 430 1068 440 1120 382" fill="none" stroke="#bae6fd" stroke-width="14" stroke-linecap="round"/>
	<g class="base">
		<text x="96" y="154" class="brand">${escapeXml(siteConfig.title)}</text>
		<text x="96" y="194" class="small">${escapeXml(profileConfig.name)} / ${escapeXml(category)} / ${escapeXml(published)}</text>
		${textBlock(titleLines, 96, 292, 76, "title")}
		${textBlock(descriptionLines, 96, 492, 38, "desc")}
		<g transform="translate(96 540)">
			${tags
				.map((tag, index) => {
					const x = index * 150;
					return `<rect x="${x}" y="0" width="128" height="38" rx="19" fill="#ecfeff"/><text x="${x + 18}" y="26" class="tag">#${escapeXml(tag.slice(0, 8))}</text>`;
				})
				.join("")}
		</g>
		<text x="930" y="538" class="meta">blog.hiauto.me</text>
	</g>
</svg>`;

	return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function renderSiteOgImage(): Promise<Buffer> {
	const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
	<defs>
		<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0%" stop-color="#f8fbff"/>
			<stop offset="52%" stop-color="#effdf8"/>
			<stop offset="100%" stop-color="#fff7ed"/>
		</linearGradient>
		<style>
			.base { font-family: "Microsoft YaHei", "Noto Sans CJK SC", "PingFang SC", "Segoe UI", Arial, sans-serif; }
			.title { font-size: 76px; font-weight: 850; fill: #111827; letter-spacing: 0; }
			.subtitle { font-size: 34px; font-weight: 600; fill: #475569; letter-spacing: 0; }
			.brand { font-size: 26px; font-weight: 800; fill: #0f766e; letter-spacing: 0; }
		</style>
	</defs>
	<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
	<rect x="68" y="68" width="1064" height="494" rx="36" fill="#ffffff" stroke="#dbeafe" stroke-width="2"/>
	<rect x="108" y="118" width="138" height="10" rx="5" fill="#14b8a6"/>
	<circle cx="1008" cy="156" r="76" fill="#dff7ff"/>
	<circle cx="1086" cy="236" r="34" fill="#fef3c7"/>
	<g class="base">
		<text x="108" y="252" class="title">${escapeXml(siteConfig.title)}</text>
		<text x="112" y="326" class="subtitle">${escapeXml(siteConfig.subtitle)}</text>
		<text x="112" y="454" class="brand">${escapeXml(profileConfig.name)} / 后端 / Web / PDA / 工程实践</text>
		<text x="112" y="510" class="subtitle">blog.hiauto.me</text>
	</g>
</svg>`;

	return sharp(Buffer.from(svg)).png().toBuffer();
}
