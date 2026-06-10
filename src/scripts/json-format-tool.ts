function getJsonToolParts(tool: HTMLElement) {
	return {
		input: tool.querySelector<HTMLTextAreaElement>("[data-input]"),
		inputLines: tool.querySelector<HTMLElement>("[data-input-lines]"),
		output: tool.querySelector<HTMLTextAreaElement>("[data-output]"),
		status: tool.querySelector<HTMLElement>("[data-status]"),
	};
}

function getLineColumnAt(source: string, index: number) {
	const beforeIndex = source.slice(0, Math.max(0, index));
	const lines = beforeIndex.split(/\r\n|\r|\n/);
	return {
		line: lines.length,
		column: lines[lines.length - 1].length + 1,
	};
}

function previousSignificantIndex(source: string, index: number) {
	for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
		if (!/\s/.test(source[cursor])) return cursor;
	}
	return -1;
}

function nextSignificantIndex(source: string, index: number) {
	for (let cursor = index; cursor < source.length; cursor += 1) {
		if (!/\s/.test(source[cursor])) return cursor;
	}
	return -1;
}

function readJsonStringEnd(source: string, start: number) {
	for (let cursor = start + 1; cursor < source.length; cursor += 1) {
		if (source[cursor] === "\\") {
			cursor += 1;
			continue;
		}
		if (source[cursor] === '"') return cursor;
	}
	return -1;
}

function getLikelyMissingColonMessage(source: string) {
	const stack: string[] = [];

	for (let cursor = 0; cursor < source.length; cursor += 1) {
		const char = source[cursor];
		if (char === '"') {
			const stringEnd = readJsonStringEnd(source, cursor);
			if (stringEnd === -1) break;

			const previousIndex = previousSignificantIndex(source, cursor);
			const nextIndex = nextSignificantIndex(source, stringEnd + 1);
			const previousChar = previousIndex >= 0 ? source[previousIndex] : "";
			const nextChar = nextIndex >= 0 ? source[nextIndex] : "";
			const isObjectKeyPosition =
				stack[stack.length - 1] === "{" &&
				(previousChar === "{" || previousChar === ",");
			const looksLikeValueWithoutColon =
				nextChar === '"' ||
				nextChar === "{" ||
				nextChar === "[" ||
				nextChar === "-" ||
				/\d|t|f|n/.test(nextChar);

			if (
				isObjectKeyPosition &&
				nextChar !== ":" &&
				looksLikeValueWithoutColon
			) {
				const location = getLineColumnAt(source, nextIndex);
				return `JSON 格式不正确：第 ${location.line} 行，第 ${location.column} 列前面可能少了冒号（:），请在字段名后补上冒号。`;
			}

			cursor = stringEnd;
			continue;
		}

		if (char === "{" || char === "[") stack.push(char);
		if (char === "}" || char === "]") stack.pop();
	}

	return null;
}

function getJsonErrorLocation(
	error: unknown,
	source: string,
): { column: number; line: number; message: string } | null {
	if (!(error instanceof SyntaxError) || !(error instanceof Error)) return null;

	const lineColumnMatch = error.message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
	if (lineColumnMatch) {
		return {
			line: Number(lineColumnMatch[1]),
			column: Number(lineColumnMatch[2]),
			message: error.message,
		};
	}

	const positionMatch = error.message.match(/position\s+(\d+)/i);
	if (!positionMatch) return null;

	const position = Number(positionMatch[1]);
	const { line, column } = getLineColumnAt(source, position);
	return {
		line,
		column,
		message: error.message,
	};
}

function getJsonErrorMessage(error: unknown, source: string) {
	const likelyMissingColonMessage = getLikelyMissingColonMessage(source);
	if (likelyMissingColonMessage) return likelyMissingColonMessage;

	const location = getJsonErrorLocation(error, source);
	if (!location) return "JSON 格式不正确，请检查逗号、引号、括号是否完整";

	return `JSON 格式不正确：第 ${location.line} 行，第 ${location.column} 列附近有问题，请检查逗号、引号、冒号或括号。`;
}

function updateJsonToolLineNumbers(tool: HTMLElement) {
	const { input, inputLines } = getJsonToolParts(tool);
	if (!input || !inputLines) return;

	const lineCount = Math.max(1, input.value.split(/\r\n|\r|\n/).length);
	inputLines.textContent = Array.from({ length: lineCount }, (_, index) =>
		String(index + 1),
	).join("\n");
	inputLines.scrollTop = input.scrollTop;
}

function initJsonToolLineNumbers(tool: HTMLElement) {
	if (tool.dataset.lineNumbersReady === "true") return;
	tool.dataset.lineNumbersReady = "true";

	const { input } = getJsonToolParts(tool);
	if (!input) return;

	input.addEventListener("input", () => updateJsonToolLineNumbers(tool));
	input.addEventListener("scroll", () => updateJsonToolLineNumbers(tool));
	updateJsonToolLineNumbers(tool);
}

function setJsonToolStatus(
	tool: HTMLElement,
	message: string,
	isError = false,
) {
	const { status } = getJsonToolParts(tool);
	if (!status) return;
	status.textContent = message;
	status.classList.toggle("text-[var(--primary)]", !isError);
	status.classList.toggle("text-red-500", isError);
}

function formatJsonTool(tool: HTMLElement, space: number) {
	const { input, output } = getJsonToolParts(tool);
	if (!input || !output) return;
	const value = input.value;
	if (!value.trim()) {
		output.value = "";
		setJsonToolStatus(tool, "请先输入 JSON 内容", true);
		return;
	}

	try {
		const parsed = JSON.parse(value);
		output.value = JSON.stringify(parsed, null, space);
		setJsonToolStatus(tool, space === 0 ? "JSON 压缩完成" : "JSON 格式化完成");
	} catch (error) {
		output.value = "";
		setJsonToolStatus(tool, getJsonErrorMessage(error, value), true);
	}
}

async function copyJsonToolResult(tool: HTMLElement) {
	const { output } = getJsonToolParts(tool);
	if (!output?.value) {
		setJsonToolStatus(tool, "没有可复制的结果", true);
		return;
	}

	try {
		await navigator.clipboard.writeText(output.value);
		setJsonToolStatus(tool, "结果已复制");
	} catch {
		setJsonToolStatus(tool, "复制失败，请手动选中结果复制", true);
	}
}

function clearJsonTool(tool: HTMLElement) {
	const { input, output } = getJsonToolParts(tool);
	if (input) input.value = "";
	if (output) output.value = "";
	updateJsonToolLineNumbers(tool);
	setJsonToolStatus(tool, "已清空");
}

function loadJsonToolSample(tool: HTMLElement) {
	const { input } = getJsonToolParts(tool);
	if (!input) return;
	input.value = JSON.stringify(
		{
			site: "Kris_Wen Tech Notes",
			url: "https://blog.hiauto.me/",
			tools: ["JSON 格式化", "时间戳转换", "Base64 编码解码"],
			localOnly: true,
		},
		null,
		0,
	);
	formatJsonTool(tool, 2);
	updateJsonToolLineNumbers(tool);
}

function initJsonTools() {
	for (const tool of document.querySelectorAll<HTMLElement>(
		"json-format-tool",
	)) {
		initJsonToolLineNumbers(tool);
	}
}

document.addEventListener("click", (event) => {
	const target = event.target;
	if (!(target instanceof Element)) return;

	const actionButton = target.closest<HTMLElement>(
		"json-format-tool [data-action]",
	);
	const tool = actionButton?.closest<HTMLElement>("json-format-tool");
	const action = actionButton?.dataset.action;
	if (!tool || !action) return;

	if (action === "format") formatJsonTool(tool, 2);
	if (action === "minify") formatJsonTool(tool, 0);
	if (action === "copy") void copyJsonToolResult(tool);
	if (action === "clear") clearJsonTool(tool);
	if (action === "sample") loadJsonToolSample(tool);
});

initJsonTools();

if (window?.swup?.hooks) {
	window.swup.hooks.on("page:view", initJsonTools);
} else {
	document.addEventListener("swup:enable", () => {
		window.swup?.hooks.on("page:view", initJsonTools);
	});
}
