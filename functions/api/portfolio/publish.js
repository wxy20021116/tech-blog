const DEFAULT_OWNER = "wxy20021116";
const DEFAULT_REPO = "tech-blog";
const DEFAULT_BRANCH = "main";
const DATA_PATH = "src/data/portfolio.json";
const IMAGE_DIR = "public/images/portfolio";

export async function onRequestPost({ request, env }) {
	try {
		return await publishPortfolioItem(request, env);
	} catch (error) {
		return json(
			{
				ok: false,
				message: error.message || "发布失败，请稍后再试。",
			},
			{ status: 500 },
		);
	}
}

async function publishPortfolioItem(request, env) {
	const token = getToken(request, env);

	if (!token) {
		return json(
			{ ok: false, message: "需要先完成 GitHub 授权，或填写 GitHub token。" },
			{ status: 401 },
		);
	}

	const allowedLogin = (
		env.GITHUB_ALLOWED_LOGIN ||
		env.GITHUB_OWNER ||
		DEFAULT_OWNER
	).toLowerCase();
	const userResponse = await githubFetch("https://api.github.com/user", token);

	if (!userResponse.ok) {
		return json(
			{ ok: false, message: "GitHub 授权无效，请重新登录。" },
			{ status: 401 },
		);
	}

	const user = await userResponse.json();
	const currentLogin = String(user.login || "").toLowerCase();

	if (currentLogin !== allowedLogin) {
		return json(
			{
				ok: false,
				message: `当前 GitHub 账号 ${user.login} 没有发布权限，只允许 ${allowedLogin} 发布。`,
			},
			{ status: 403 },
		);
	}

	const payload = await request.json();
	const description = cleanText(payload.description, 500);
	const title = cleanText(payload.title || createTitle(description), 80);
	const tag = cleanText(payload.tag || "作品", 30);
	const images = Array.isArray(payload.images)
		? payload.images.slice(0, 30)
		: [];

	if (!title || !description) {
		return json({ ok: false, message: "先写一点想法。" }, { status: 400 });
	}

	if (images.length === 0) {
		return json({ ok: false, message: "至少上传一张图片。" }, { status: 400 });
	}

	const owner = env.GITHUB_OWNER || DEFAULT_OWNER;
	const repo = env.GITHUB_REPO || DEFAULT_REPO;
	const branch = env.GITHUB_BRANCH || DEFAULT_BRANCH;
	const apiBase = `https://api.github.com/repos/${owner}/${repo}`;
	const id = createId();
	const now = new Date().toISOString();

	const refResponse = await githubFetch(
		`${apiBase}/git/ref/heads/${branch}`,
		token,
	);
	if (!refResponse.ok) {
		return json(
			{
				ok: false,
				message: "读取 GitHub 分支失败，请确认账号有仓库写入权限。",
			},
			{ status: 403 },
		);
	}

	const ref = await refResponse.json();
	const baseCommitSha = ref.object.sha;
	const commitResponse = await githubFetch(
		`${apiBase}/git/commits/${baseCommitSha}`,
		token,
	);
	const baseCommit = await commitResponse.json();

	const currentItems = await readPortfolioItems(apiBase, branch, token);
	const imagePaths = [];
	const treeItems = [];

	for (const [index, image] of images.entries()) {
		const base64 = String(image.content || "").replace(
			/^data:[^;]+;base64,/,
			"",
		);
		const extension = extensionFromImage(image);
		const path = `${IMAGE_DIR}/${id}-${index + 1}.${extension}`;
		const blobSha = await createBlob(apiBase, token, base64);

		imagePaths.push(`/${path.replace(/^public\//, "")}`);
		treeItems.push({
			path,
			mode: "100644",
			type: "blob",
			sha: blobSha,
		});
	}

	const nextItems = [
		{
			id,
			title,
			description,
			tag,
			time: formatTime(now),
			createdAt: now,
			images: imagePaths,
		},
		...currentItems,
	];
	const dataBlobSha = await createBlob(
		apiBase,
		token,
		btoaUnicode(JSON.stringify(nextItems, null, 2)),
	);

	treeItems.push({
		path: DATA_PATH,
		mode: "100644",
		type: "blob",
		sha: dataBlobSha,
	});

	const treeResponse = await githubFetch(`${apiBase}/git/trees`, token, {
		method: "POST",
		body: JSON.stringify({
			base_tree: baseCommit.tree.sha,
			tree: treeItems,
		}),
	});
	const tree = await treeResponse.json();

	if (!treeResponse.ok) {
		return json(
			{ ok: false, message: "创建 Git tree 失败。", detail: tree },
			{ status: 500 },
		);
	}

	const nextCommitResponse = await githubFetch(
		`${apiBase}/git/commits`,
		token,
		{
			method: "POST",
			body: JSON.stringify({
				message: `chore: publish portfolio item ${title}`,
				tree: tree.sha,
				parents: [baseCommitSha],
			}),
		},
	);
	const nextCommit = await nextCommitResponse.json();

	if (!nextCommitResponse.ok) {
		return json(
			{ ok: false, message: "创建 Git commit 失败。", detail: nextCommit },
			{ status: 500 },
		);
	}

	const updateResponse = await githubFetch(
		`${apiBase}/git/refs/heads/${branch}`,
		token,
		{
			method: "PATCH",
			body: JSON.stringify({
				sha: nextCommit.sha,
			}),
		},
	);

	if (!updateResponse.ok) {
		return json(
			{ ok: false, message: "更新 main 分支失败，可能刚好有人推送了新提交。" },
			{ status: 409 },
		);
	}

	return json({
		ok: true,
		commit: nextCommit.sha,
		url: `https://github.com/${owner}/${repo}/commit/${nextCommit.sha}`,
	});
}

async function readPortfolioItems(apiBase, branch, token) {
	const response = await githubFetch(
		`${apiBase}/contents/${DATA_PATH}?ref=${branch}`,
		token,
	);

	if (response.status === 404) {
		return [];
	}

	if (!response.ok) {
		throw new Error("Unable to read portfolio data");
	}

	const payload = await response.json();
	const content = atob(payload.content.replace(/\s/g, ""));
	const decoded = decodeURIComponent(
		Array.from(
			content,
			(char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`,
		).join(""),
	);

	try {
		const items = JSON.parse(decoded);
		return Array.isArray(items) ? items : [];
	} catch {
		return [];
	}
}

async function createBlob(apiBase, token, content) {
	const response = await githubFetch(`${apiBase}/git/blobs`, token, {
		method: "POST",
		body: JSON.stringify({
			content,
			encoding: "base64",
		}),
	});
	const payload = await response.json();

	if (!response.ok) {
		throw new Error(payload.message || "Unable to create blob");
	}

	return payload.sha;
}

function getToken(request, env) {
	const authorization = request.headers.get("Authorization") || "";
	if (authorization.startsWith("Bearer ")) {
		return authorization.slice("Bearer ".length);
	}
	const cookies = parseCookies(request.headers.get("Cookie") || "");
	if (cookies.github_access_token) return cookies.github_access_token;
	if (isValidPublishKey(request, env)) {
		return env.GITHUB_PUBLISH_TOKEN || env.GITHUB_TOKEN || "";
	}
	return "";
}

function isValidPublishKey(request, env) {
	const expected = env.PORTFOLIO_PUBLISH_KEY || "";
	const received = request.headers.get("X-Portfolio-Publish-Key") || "";
	return Boolean(expected && received && received === expected);
}

function parseCookies(cookieHeader) {
	return Object.fromEntries(
		cookieHeader
			.split(";")
			.map((part) => part.trim())
			.filter(Boolean)
			.map((part) => {
				const index = part.indexOf("=");
				if (index === -1) return [decodeURIComponent(part), ""];
				return [
					decodeURIComponent(part.slice(0, index)),
					decodeURIComponent(part.slice(index + 1)),
				];
			}),
	);
}

function githubFetch(url, token, options = {}) {
	return fetch(url, {
		...options,
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
			"User-Agent": "hiauto-tech-blog",
			"X-GitHub-Api-Version": "2022-11-28",
			...(options.headers || {}),
		},
	});
}

function cleanText(value, maxLength) {
	return String(value || "")
		.trim()
		.slice(0, maxLength);
}

function createTitle(description) {
	const firstLine = String(description || "")
		.split(/\r?\n/)
		.find((line) => line.trim());
	return firstLine ? firstLine.trim().slice(0, 24) : "作品动态";
}

function extensionFromImage(image) {
	const name = String(image.name || "").toLowerCase();
	const type = String(image.type || "").toLowerCase();
	const extension = name.split(".").pop();

	if (["jpg", "jpeg", "png", "webp", "gif"].includes(extension)) {
		return extension === "jpeg" ? "jpg" : extension;
	}

	if (type.includes("png")) return "png";
	if (type.includes("webp")) return "webp";
	if (type.includes("gif")) return "gif";
	return "jpg";
}

function createId() {
	const now = new Date();
	const date = now.toISOString().slice(0, 10).replace(/-/g, "");
	return `${date}-${crypto.randomUUID().slice(0, 8)}`;
}

function formatTime(value) {
	return new Intl.DateTimeFormat("zh-CN", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date(value));
}

function btoaUnicode(value) {
	const bytes = new TextEncoder().encode(value);
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

function json(payload, init = {}) {
	return new Response(JSON.stringify(payload), {
		...init,
		headers: {
			"Content-Type": "application/json",
			...(init.headers || {}),
		},
	});
}
