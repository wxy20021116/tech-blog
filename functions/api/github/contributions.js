const DEFAULT_USER = "wxy20021116";
const MAX_DAYS = 30;

export async function onRequestGet({ request }) {
	const url = new URL(request.url);
	const user = normalizeUser(url.searchParams.get("user")) || DEFAULT_USER;
	const days = normalizeDays(url.searchParams.get("days"));

	try {
		const response = await fetch(`https://github.com/users/${user}/contributions`, {
			headers: {
				Accept: "text/html",
				"User-Agent": "hiauto-tech-blog",
			},
		});

		if (!response.ok) {
			return json(
				{ ok: false, message: "读取 GitHub 提交日历失败。" },
				{ status: response.status },
			);
		}

		const html = await response.text();
		const contributions = parseContributionCalendar(html).slice(-days);
		const total = contributions.reduce((sum, item) => sum + item.count, 0);
		const today = contributions.at(-1) || null;

		return json(
			{
				ok: true,
				user,
				total,
				today,
				days: contributions,
				source: `https://github.com/${user}`,
				updatedAt: new Date().toISOString(),
			},
			{
				headers: {
					"Cache-Control": "public, max-age=1800",
				},
			},
		);
	} catch (error) {
		return json(
			{
				ok: false,
				message: "读取 GitHub 提交日历失败。",
				detail: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 },
		);
	}
}

function normalizeUser(value) {
	if (!value) return "";
	const user = value.trim();
	if (!/^[a-zA-Z0-9-]{1,39}$/.test(user)) return "";
	return user;
}

function normalizeDays(value) {
	const days = Number(value);
	if (!Number.isInteger(days)) return 14;
	return Math.min(Math.max(days, 1), MAX_DAYS);
}

function parseContributionCalendar(html) {
	const cells = new Map();
	const cellPattern =
		/<td\b(?=[^>]*\bdata-date="([^"]+)")(?=[^>]*\bid="([^"]+)")[^>]*><\/td>/g;
	let cellMatch;

	while ((cellMatch = cellPattern.exec(html)) !== null) {
		const [, date, id] = cellMatch;
		cells.set(id, { date, count: 0 });
	}

	const tooltipPattern =
		/<tool-tip\b(?=[^>]*\bfor="([^"]+)")[^>]*>([\s\S]*?)<\/tool-tip>/g;
	let tooltipMatch;

	while ((tooltipMatch = tooltipPattern.exec(html)) !== null) {
		const [, id, rawText] = tooltipMatch;
		const cell = cells.get(id);
		if (!cell) continue;

		const text = decodeHtml(rawText).replace(/\s+/g, " ").trim();
		const countMatch = text.match(/(\d+)\s+contributions?/i);
		cell.count = countMatch ? Number(countMatch[1]) : 0;
	}

	return Array.from(cells.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function decodeHtml(value) {
	return value
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
}

function json(payload, init = {}) {
	return new Response(JSON.stringify(payload), {
		status: init.status || 200,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			...(init.headers || {}),
		},
	});
}
