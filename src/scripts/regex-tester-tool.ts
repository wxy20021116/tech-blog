type RegexMatch = {
	groups?: Record<string, string>;
	index: number;
	match: string;
	values: string[];
};

function getRegexToolParts(tool: HTMLElement) {
	return {
		pattern: tool.querySelector<HTMLInputElement>("[data-pattern]"),
		text: tool.querySelector<HTMLTextAreaElement>("[data-text]"),
		results: tool.querySelector<HTMLElement>("[data-results]"),
		highlight: tool.querySelector<HTMLElement>("[data-highlight]"),
		status: tool.querySelector<HTMLElement>("[data-status]"),
		count: tool.querySelector<HTMLElement>("[data-count]"),
	};
}

function escapeHtml(value: string) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function setRegexStatus(tool: HTMLElement, message: string, isError = false) {
	const { status } = getRegexToolParts(tool);
	if (!status) return;
	status.textContent = message;
	status.classList.toggle("text-[var(--primary)]", !isError);
	status.classList.toggle("text-red-500", isError);
}

function getSelectedFlags(tool: HTMLElement) {
	const flags = Array.from(
		tool.querySelectorAll<HTMLInputElement>("[data-flag]"),
	)
		.filter((input) => input.checked)
		.map((input) => input.dataset.flag || "")
		.join("");
	return Array.from(new Set(flags)).join("");
}

function buildRegex(tool: HTMLElement) {
	const { pattern } = getRegexToolParts(tool);
	const source = pattern?.value || "";
	if (!source) {
		throw new Error("请输入正则表达式");
	}
	return new RegExp(source, getSelectedFlags(tool));
}

function getMatches(regex: RegExp, text: string) {
	const matches: RegexMatch[] = [];
	const globalRegex = regex.global
		? regex
		: new RegExp(regex.source, `${regex.flags}g`);

	for (const match of text.matchAll(globalRegex)) {
		matches.push({
			index: match.index || 0,
			match: match[0],
			values: Array.from(match),
			groups: match.groups,
		});

		if (match[0] === "") {
			globalRegex.lastIndex += 1;
		}
	}

	return matches;
}

function renderResults(tool: HTMLElement, matches: RegexMatch[]) {
	const { results, count } = getRegexToolParts(tool);
	if (count) count.textContent = `${matches.length} 个匹配`;
	if (!results) return;
	if (matches.length === 0) {
		results.innerHTML = '<p class="text-50">没有匹配结果。</p>';
		return;
	}

	results.innerHTML = matches
		.map((match, index) => {
			const captures = match.values
				.slice(1)
				.map((value, captureIndex) => {
					const text = value == null ? "(未匹配)" : escapeHtml(value);
					return `<li><span class="text-50">$${captureIndex + 1}</span> ${text}</li>`;
				})
				.join("");
			const groups = match.groups
				? Object.entries(match.groups)
						.map(([name, value]) => {
							const text = value == null ? "(未匹配)" : escapeHtml(value);
							return `<li><span class="text-50">${escapeHtml(name)}</span> ${text}</li>`;
						})
						.join("")
				: "";
			const end = match.index + match.match.length;
			return `<article class="mb-4 rounded-lg bg-[var(--card-bg)] p-3 last:mb-0">
				<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
					<h3 class="font-bold text-90">匹配 #${index + 1}</h3>
					<span class="font-mono text-xs text-50">index ${match.index} - ${end}</span>
				</div>
				<pre class="whitespace-pre-wrap break-words rounded-md bg-[var(--page-bg)] p-3 font-mono text-sm text-90">${escapeHtml(match.match)}</pre>
				${captures ? `<p class="mt-3 font-medium text-75">捕获组</p><ul class="mt-1 space-y-1">${captures}</ul>` : ""}
				${groups ? `<p class="mt-3 font-medium text-75">命名捕获组</p><ul class="mt-1 space-y-1">${groups}</ul>` : ""}
			</article>`;
		})
		.join("");
}

function renderHighlight(
	tool: HTMLElement,
	text: string,
	matches: RegexMatch[],
) {
	const { highlight } = getRegexToolParts(tool);
	if (!highlight) return;
	if (!text) {
		highlight.textContent = "测试后将在这里显示高亮预览。";
		return;
	}
	if (matches.length === 0) {
		highlight.textContent = text;
		return;
	}

	let cursor = 0;
	let html = "";
	for (const match of matches) {
		const end = match.index + match.match.length;
		if (match.match.length === 0) continue;
		html += escapeHtml(text.slice(cursor, match.index));
		html += `<mark class="rounded bg-yellow-200 px-0.5 text-black">${escapeHtml(match.match)}</mark>`;
		cursor = end;
	}
	html += escapeHtml(text.slice(cursor));
	highlight.innerHTML = html;
}

function runRegexTest(tool: HTMLElement) {
	const { text } = getRegexToolParts(tool);
	const value = text?.value || "";
	try {
		const regex = buildRegex(tool);
		const matches = getMatches(regex, value);
		renderResults(tool, matches);
		renderHighlight(tool, value, matches);
		setRegexStatus(tool, `测试完成，共 ${matches.length} 个匹配`);
	} catch (error) {
		renderResults(tool, []);
		renderHighlight(tool, value, []);
		setRegexStatus(
			tool,
			error instanceof Error ? error.message : "正则表达式不正确",
			true,
		);
	}
}

async function copyRegexResults(tool: HTMLElement) {
	const { pattern, text } = getRegexToolParts(tool);
	try {
		const regex = buildRegex(tool);
		const matches = getMatches(regex, text?.value || "");
		const lines = matches.map((match, index) => {
			const captures = match.values
				.slice(1)
				.map((value, captureIndex) => `$${captureIndex + 1}: ${value ?? ""}`)
				.join(", ");
			return `#${index + 1} [${match.index}-${match.index + match.match.length}] ${match.match}${captures ? ` (${captures})` : ""}`;
		});
		await navigator.clipboard.writeText(
			[`/${pattern?.value || ""}/${getSelectedFlags(tool)}`, ...lines].join(
				"\n",
			),
		);
		setRegexStatus(tool, "匹配结果已复制");
	} catch {
		setRegexStatus(tool, "没有可复制的匹配结果", true);
	}
}

function clearRegexTool(tool: HTMLElement) {
	const parts = getRegexToolParts(tool);
	if (parts.pattern) parts.pattern.value = "";
	if (parts.text) parts.text.value = "";
	if (parts.results)
		parts.results.innerHTML =
			'<p class="text-50">测试后将在这里显示匹配结果。</p>';
	if (parts.highlight)
		parts.highlight.textContent = "测试后将在这里显示高亮预览。";
	if (parts.count) parts.count.textContent = "0 个匹配";
	setRegexStatus(tool, "已清空");
}

function loadRegexSample(tool: HTMLElement) {
	const { pattern, text } = getRegexToolParts(tool);
	if (pattern)
		pattern.value = "(?<name>[\\u4e00-\\u9fa5A-Za-z]+)\\s+(?<phone>1\\d{10})";
	if (text) {
		text.value = `张三 13800138000
李四 13900139000
无效号码 12345
Kris 13700137000`;
	}
	for (const input of tool.querySelectorAll<HTMLInputElement>("[data-flag]")) {
		input.checked = input.dataset.flag === "g" || input.dataset.flag === "u";
	}
	runRegexTest(tool);
}

document.addEventListener("click", (event) => {
	const target = event.target;
	if (!(target instanceof Element)) return;

	const actionButton = target.closest<HTMLElement>(
		"regex-tester-tool [data-action]",
	);
	const tool = actionButton?.closest<HTMLElement>("regex-tester-tool");
	const action = actionButton?.dataset.action;
	if (!tool || !action) return;

	if (action === "test") runRegexTest(tool);
	if (action === "sample") loadRegexSample(tool);
	if (action === "copy") void copyRegexResults(tool);
	if (action === "clear") clearRegexTool(tool);
});

document.addEventListener("input", (event) => {
	const target = event.target;
	if (!(target instanceof Element)) return;
	const tool = target.closest<HTMLElement>("regex-tester-tool");
	if (!tool) return;
	if (target.matches("[data-pattern], [data-text], [data-flag]")) {
		runRegexTest(tool);
	}
});
