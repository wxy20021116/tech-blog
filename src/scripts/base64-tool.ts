function getBase64ToolParts(tool: HTMLElement) {
	return {
		input: tool.querySelector<HTMLTextAreaElement>("[data-input]"),
		output: tool.querySelector<HTMLTextAreaElement>("[data-output]"),
		status: tool.querySelector<HTMLElement>("[data-status]"),
		urlSafe: tool.querySelector<HTMLInputElement>("[data-url-safe]"),
	};
}

function setBase64Status(tool: HTMLElement, message: string, isError = false) {
	const { status } = getBase64ToolParts(tool);
	if (!status) return;
	status.textContent = message;
	status.classList.toggle("text-[var(--primary)]", !isError);
	status.classList.toggle("text-red-500", isError);
}

function toUrlSafeBase64(value: string) {
	return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromUrlSafeBase64(value: string) {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
	const paddingLength = (4 - (normalized.length % 4)) % 4;
	return normalized + "=".repeat(paddingLength);
}

function encodeBase64Text(value: string, urlSafe: boolean) {
	const bytes = new TextEncoder().encode(value);
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	const encoded = window.btoa(binary);
	return urlSafe ? toUrlSafeBase64(encoded) : encoded;
}

function decodeBase64Text(value: string, urlSafe: boolean) {
	const source = urlSafe ? fromUrlSafeBase64(value.trim()) : value.trim();
	if (!/^[A-Za-z0-9+/]*={0,2}$/.test(source)) {
		throw new Error("Base64 内容包含非法字符");
	}

	const binary = window.atob(source);
	const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
	return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function encodeBase64(tool: HTMLElement) {
	const { input, output, urlSafe } = getBase64ToolParts(tool);
	if (!input || !output) return;
	if (!input.value) {
		output.value = "";
		setBase64Status(tool, "请先输入要编码的文本", true);
		return;
	}

	output.value = encodeBase64Text(input.value, !!urlSafe?.checked);
	setBase64Status(tool, "Base64 编码完成");
}

function decodeBase64(tool: HTMLElement) {
	const { input, output, urlSafe } = getBase64ToolParts(tool);
	if (!input || !output) return;
	if (!input.value.trim()) {
		output.value = "";
		setBase64Status(tool, "请先输入要解码的 Base64 内容", true);
		return;
	}

	try {
		output.value = decodeBase64Text(input.value, !!urlSafe?.checked);
		setBase64Status(tool, "Base64 解码完成");
	} catch {
		output.value = "";
		setBase64Status(
			tool,
			"Base64 内容不正确，请检查字符、补位符或 URL Safe 模式",
			true,
		);
	}
}

async function copyBase64Output(tool: HTMLElement) {
	const { output } = getBase64ToolParts(tool);
	if (!output?.value) {
		setBase64Status(tool, "没有可复制的结果", true);
		return;
	}

	try {
		await navigator.clipboard.writeText(output.value);
		setBase64Status(tool, "结果已复制");
	} catch {
		setBase64Status(tool, "复制失败，请手动选中结果复制", true);
	}
}

function swapBase64Content(tool: HTMLElement) {
	const { input, output } = getBase64ToolParts(tool);
	if (!input || !output) return;
	if (!input.value && !output.value) {
		setBase64Status(tool, "没有可互换的结果", true);
		return;
	}

	const previousInput = input.value;
	input.value = output.value;
	output.value = previousInput;
	setBase64Status(tool, "输入和输出已互换");
}

function clearBase64(tool: HTMLElement) {
	const { input, output } = getBase64ToolParts(tool);
	if (input) input.value = "";
	if (output) output.value = "";
	setBase64Status(tool, "已清空");
}

function loadBase64Sample(tool: HTMLElement) {
	const { input } = getBase64ToolParts(tool);
	if (!input) return;
	input.value = "Kris_Wen Tech Notes：把日常开发沉淀成可复用的工程经验";
	encodeBase64(tool);
}

document.addEventListener("click", (event) => {
	const target = event.target;
	if (!(target instanceof Element)) return;

	const actionButton = target.closest<HTMLElement>("base64-tool [data-action]");
	const tool = actionButton?.closest<HTMLElement>("base64-tool");
	const action = actionButton?.dataset.action;
	if (!tool || !action) return;

	if (action === "encode") encodeBase64(tool);
	if (action === "decode") decodeBase64(tool);
	if (action === "copy") void copyBase64Output(tool);
	if (action === "swap") swapBase64Content(tool);
	if (action === "clear") clearBase64(tool);
	if (action === "sample") loadBase64Sample(tool);
});
