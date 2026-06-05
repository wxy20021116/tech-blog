const DEFAULT_USER = "wxy20021116";
const MAX_DAYS = 90;
const CHINA_TIME_OFFSET = 8 * 60 * 60 * 1000;

export async function onRequestGet({ request }) {
	const url = new URL(request.url);
	const user = normalizeUser(url.searchParams.get("user")) || DEFAULT_USER;
	const days = normalizeDays(url.searchParams.get("days"));

	try {
		const contributions = await readContributions(user, days);
		const total = contributions.reduce((sum, item) => sum + item.count, 0);
		const today = contributions.at(-1) || null;

		return json(
			{
				ok: true,
				user,
				total,
				today,
				days: contributions,
				source: `https://gitee.com/${user}`,
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
				message: "读取 Gitee 提交日历失败。",
				detail: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 },
		);
	}
}

async function readContributions(user, days) {
	let html = "";
	try {
		html = await fetchText(`https://gitee.com/${user}`);
	} catch {
		html = "";
	}

	const profileDays = parseContributionCalendar(html);

	if (profileDays.length > 0) {
		return normalizeTimeline(profileDays, days);
	}

	const fallbackDays = emptyTimeline(days);
	const recentCountMatch =
		html.match(/Recent contributions:\s*(\d+)/i)
		|| html.match(/最近连续贡献[：:]\s*(\d+)/);
	if (recentCountMatch) {
		fallbackDays[fallbackDays.length - 1].count = Number(recentCountMatch[1]);
	}

	const eventDays = await readEventContributions(user, days);
	return mergeTimelines(fallbackDays, eventDays);
}

async function readEventContributions(user, days) {
	const counts = new Map();

	for (let page = 1; page <= 3; page += 1) {
		const events = await fetchJson(
			`https://gitee.com/api/v5/users/${user}/events/public?per_page=100&page=${page}`,
		);
		if (!Array.isArray(events) || events.length === 0) break;

		for (const event of events) {
			const count = getCommitCount(event);
			if (count <= 0) continue;

			const date = getEventDate(event);
			if (!date) continue;
			counts.set(date, (counts.get(date) || 0) + count);
		}
	}

	return emptyTimeline(days).map((day) => ({
		...day,
		count: counts.get(day.date) || 0,
	}));
}

async function fetchText(url) {
	const response = await fetch(url, {
		headers: {
			Accept: "text/html",
			"User-Agent": "hiauto-tech-blog",
		},
	});

	if (!response.ok) {
		throw new Error(`Gitee returned ${response.status}`);
	}

	return response.text();
}

async function fetchJson(url) {
	const response = await fetch(url, {
		headers: {
			Accept: "application/json",
			"User-Agent": "hiauto-tech-blog",
		},
	});

	if (!response.ok) return [];
	return response.json();
}

function parseContributionCalendar(html) {
	const days = [];
	const elementPattern = /<[^>]+(?:data-date|date)=['"]([^'"]+)['"][^>]*>/g;
	let match;

	while ((match = elementPattern.exec(html)) !== null) {
		const [element, date] = match;
		const content = getAttribute(element, "data-content");
		const count = getAttributeNumber(element, "data-count")
			?? getAttributeNumber(element, "data-value")
			?? getAttributeNumber(element, "data-contributions")
			?? getContributionCount(content);

		if (count !== null) {
			days.push({ date: normalizeDate(date), count });
		}
	}

	return dedupeDays(days);
}

function getAttribute(element, name) {
	const match = element.match(new RegExp(`${name}=['"]([^'"]+)['"]`));
	if (!match) return "";
	return decodeHtml(match[1]);
}

function getAttributeNumber(element, name) {
	const match = element.match(new RegExp(`${name}=['"](\\d+)['"]`));
	if (!match) return null;
	return Number(match[1]);
}

function getContributionCount(value) {
	if (!value) return null;
	const match = value.match(/(\d+)\s*(?:个)?贡献/i);
	if (!match) return null;
	return Number(match[1]);
}

function normalizeDate(value) {
	if (/^\d{8}$/.test(value)) {
		return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
	}
	return value;
}

function getCommitCount(event) {
	const type = String(event?.type || event?.action || event?.event_type || "");
	const payload = event?.payload || event?.content || {};

	if (!/push/i.test(type) && !Array.isArray(payload?.commits) && !Array.isArray(event?.commits)) {
		return 0;
	}

	if (Array.isArray(payload.commits)) return payload.commits.length;
	if (Array.isArray(event.commits)) return event.commits.length;
	if (Number.isFinite(Number(payload.commits_count))) return Number(payload.commits_count);
	if (Number.isFinite(Number(payload.size))) return Number(payload.size);
	if (Number.isFinite(Number(event.commits_count))) return Number(event.commits_count);
	return 1;
}

function getEventDate(event) {
	const value = event?.created_at || event?.createdAt || event?.updated_at || event?.created;
	if (!value) return "";

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return toChinaDate(date);
}

function normalizeTimeline(days, length) {
	const counts = new Map(dedupeDays(days).map((day) => [day.date, day.count]));
	return emptyTimeline(length).map((day) => ({
		...day,
		count: counts.get(day.date) || 0,
	}));
}

function mergeTimelines(primary, secondary) {
	const counts = new Map(primary.map((day) => [day.date, day.count]));
	for (const day of secondary) {
		counts.set(day.date, Math.max(counts.get(day.date) || 0, day.count));
	}
	return primary.map((day) => ({ ...day, count: counts.get(day.date) || 0 }));
}

function emptyTimeline(days) {
	const today = new Date(Date.now() + CHINA_TIME_OFFSET);
	return Array.from({ length: days }, (_, index) => {
		const date = new Date(today);
		date.setUTCDate(today.getUTCDate() - (days - 1 - index));
		return { date: date.toISOString().slice(0, 10), count: 0 };
	});
}

function toChinaDate(date) {
	return new Date(date.getTime() + CHINA_TIME_OFFSET).toISOString().slice(0, 10);
}

function dedupeDays(days) {
	const counts = new Map();
	for (const day of days) {
		counts.set(day.date, Number(day.count) || 0);
	}
	return Array.from(counts.entries())
		.map(([date, count]) => ({ date, count }))
		.sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeUser(value) {
	if (!value) return "";
	const user = value.trim();
	if (!/^[a-zA-Z0-9_-]{1,39}$/.test(user)) return "";
	return user;
}

function decodeHtml(value) {
	return value
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/g, "'");
}

function normalizeDays(value) {
	const days = Number(value);
	if (!Number.isInteger(days)) return 14;
	return Math.min(Math.max(days, 1), MAX_DAYS);
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
