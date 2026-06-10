function getJsonToolParts(tool: HTMLElement) {
	return {
		input: tool.querySelector<HTMLTextAreaElement>("[data-input]"),
		output: tool.querySelector<HTMLTextAreaElement>("[data-output]"),
		status: tool.querySelector<HTMLElement>("[data-status]"),
	};
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
	const value = input.value.trim();
	if (!value) {
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
		setJsonToolStatus(
			tool,
			error instanceof Error ? error.message : "JSON 解析失败",
			true,
		);
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
