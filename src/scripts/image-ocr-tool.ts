import Tesseract from "tesseract.js";

type OcrLine = {
	text: string;
	confidence: number;
	bbox: {
		x0: number;
		y0: number;
		x1: number;
		y1: number;
	};
};

type OcrState = {
	file?: File;
	imageUrl?: string;
	width?: number;
	height?: number;
	text: string;
	lines: OcrLine[];
	words: string[];
	isRecognizing: boolean;
};

const ocrState = new WeakMap<HTMLElement, OcrState>();

function getOcrParts(tool: HTMLElement) {
	return {
		fileInput: tool.querySelector<HTMLInputElement>("[data-file]"),
		language: tool.querySelector<HTMLSelectElement>("[data-language]"),
		showLayer: tool.querySelector<HTMLInputElement>("[data-show-layer]"),
		status: tool.querySelector<HTMLElement>("[data-status]"),
		previewWrap: tool.querySelector<HTMLElement>("[data-preview-wrap]"),
		stage: tool.querySelector<HTMLElement>("[data-image-stage]"),
		preview: tool.querySelector<HTMLImageElement>("[data-preview]"),
		textLayer: tool.querySelector<HTMLElement>("[data-text-layer]"),
		empty: tool.querySelector<HTMLElement>("[data-empty]"),
		fileName: tool.querySelector<HTMLElement>("[data-file-name]"),
		imageSize: tool.querySelector<HTMLElement>("[data-image-size]"),
		confidence: tool.querySelector<HTMLElement>("[data-confidence]"),
		output: tool.querySelector<HTMLTextAreaElement>("[data-output]"),
		lines: tool.querySelector<HTMLElement>("[data-lines]"),
		lineCount: tool.querySelector<HTMLElement>("[data-line-count]"),
	};
}

function setOcrStatus(tool: HTMLElement, message: string, isError = false) {
	const { status } = getOcrParts(tool);
	if (!status) return;
	status.textContent = message;
	status.classList.toggle("text-[var(--primary)]", !isError);
	status.classList.toggle("text-red-500", isError);
}

function setOcrText(element: HTMLElement | null, value: string) {
	if (element) element.textContent = value;
}

function getInitialState(): OcrState {
	return {
		text: "",
		lines: [],
		words: [],
		isRecognizing: false,
	};
}

function loadImage(file: File) {
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		const url = URL.createObjectURL(file);
		image.onload = () => {
			URL.revokeObjectURL(url);
			resolve(image);
		};
		image.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error("图片读取失败"));
		};
		image.src = url;
	});
}

function normalizeText(text: string) {
	return text
		.replace(/\r\n/g, "\n")
		.replace(/[ \t]+\n/g, "\n")
		.trim();
}

function getOcrLines(blocks: Tesseract.Block[] | null): OcrLine[] {
	if (!blocks) return [];
	return blocks
		.flatMap((block) => block.paragraphs)
		.flatMap((paragraph) => paragraph.lines)
		.map((line) => ({
			text: normalizeText(line.text),
			confidence: line.confidence,
			bbox: line.bbox,
		}))
		.filter((line) => line.text.length > 0);
}

function getOcrWords(blocks: Tesseract.Block[] | null): string[] {
	if (!blocks) return [];
	const words = blocks
		.flatMap((block) => block.paragraphs)
		.flatMap((paragraph) => paragraph.lines)
		.flatMap((line) => line.words)
		.map((word) => normalizeText(word.text))
		.filter((word) => word.length > 0);
	return Array.from(new Set(words));
}

function renderTextLayer(tool: HTMLElement) {
	const parts = getOcrParts(tool);
	const state = ocrState.get(tool);
	if (!parts.textLayer || !state?.width || !state.height) return;

	parts.textLayer.replaceChildren();
	parts.textLayer.classList.toggle(
		"show-boxes",
		Boolean(parts.showLayer?.checked),
	);

	for (const line of state.lines) {
		const left = (line.bbox.x0 / state.width) * 100;
		const top = (line.bbox.y0 / state.height) * 100;
		const width = ((line.bbox.x1 - line.bbox.x0) / state.width) * 100;
		const height = ((line.bbox.y1 - line.bbox.y0) / state.height) * 100;
		const span = document.createElement("span");
		span.textContent = line.text;
		span.title = line.text;
		span.className =
			"absolute overflow-hidden whitespace-pre text-transparent outline-offset-1 selection:bg-[var(--primary)] selection:text-white";
		span.style.left = `${left}%`;
		span.style.top = `${top}%`;
		span.style.width = `${width}%`;
		span.style.height = `${height}%`;
		span.style.fontSize = "12px";
		span.style.lineHeight = "1";
		span.style.userSelect = "text";
		span.dataset.ocrLine = "true";
		parts.textLayer.appendChild(span);
	}
}

function renderLines(tool: HTMLElement) {
	const parts = getOcrParts(tool);
	const state = ocrState.get(tool) || getInitialState();
	setOcrText(
		parts.lineCount,
		`${state.lines.length} 行 / ${state.words.length} 词`,
	);
	if (!parts.lines) return;

	parts.lines.replaceChildren();
	if (state.lines.length === 0 && state.words.length === 0) {
		const empty = document.createElement("p");
		empty.className = "rounded-lg bg-[var(--page-bg)] p-3 text-sm text-50";
		empty.textContent = "识别后可逐条复制。";
		parts.lines.appendChild(empty);
		return;
	}

	for (const line of state.lines) {
		const item = document.createElement("button");
		item.type = "button";
		item.dataset.action = "copy-line";
		item.dataset.copyText = line.text;
		item.className =
			"rounded-lg bg-[var(--page-bg)] px-3 py-2 text-left text-sm leading-6 text-75 transition hover:text-[var(--primary)]";
		item.textContent = line.text;
		parts.lines.appendChild(item);
	}

	if (state.words.length > 0) {
		const wordWrap = document.createElement("div");
		wordWrap.className =
			"mt-2 flex flex-wrap gap-2 border-t border-[var(--line-divider)] pt-3";
		for (const word of state.words) {
			const item = document.createElement("button");
			item.type = "button";
			item.dataset.action = "copy-line";
			item.dataset.copyText = word;
			item.className =
				"rounded-md bg-[var(--btn-plain-bg-hover)] px-2 py-1 text-left text-xs leading-5 text-75 transition hover:text-[var(--primary)]";
			item.textContent = word;
			wordWrap.appendChild(item);
		}
		parts.lines.appendChild(wordWrap);
	}
}

function injectLayerStyle() {
	if (document.getElementById("image-ocr-layer-style")) return;
	const style = document.createElement("style");
	style.id = "image-ocr-layer-style";
	style.textContent = `
		image-ocr-tool [data-text-layer] {
			container-type: inline-size;
		}
		image-ocr-tool [data-text-layer].show-boxes [data-ocr-line] {
			background: color-mix(in srgb, var(--primary) 10%, transparent);
			outline: 1px dashed color-mix(in srgb, var(--primary) 55%, transparent);
		}
	`;
	document.head.appendChild(style);
}

async function copyText(tool: HTMLElement, text: string) {
	if (!text.trim()) {
		setOcrStatus(tool, "暂无可复制文字", true);
		return;
	}
	try {
		await navigator.clipboard.writeText(text);
		setOcrStatus(tool, "已复制到剪贴板");
	} catch {
		const parts = getOcrParts(tool);
		if (parts.output) {
			parts.output.focus();
			parts.output.select();
		}
		setOcrStatus(tool, "浏览器限制自动复制，已选中文本，可手动复制", true);
	}
}

async function selectOcrImage(tool: HTMLElement, file: File) {
	if (!file.type.startsWith("image/")) {
		setOcrStatus(tool, "请选择有效的图片文件", true);
		return;
	}

	const parts = getOcrParts(tool);
	const previous = ocrState.get(tool);
	if (previous?.imageUrl) URL.revokeObjectURL(previous.imageUrl);

	const image = await loadImage(file);
	const imageUrl = URL.createObjectURL(file);
	const nextState: OcrState = {
		file,
		imageUrl,
		width: image.naturalWidth,
		height: image.naturalHeight,
		text: "",
		lines: [],
		words: [],
		isRecognizing: false,
	};
	ocrState.set(tool, nextState);

	if (parts.preview) {
		parts.preview.src = imageUrl;
		parts.preview.classList.remove("hidden");
	}
	parts.stage?.classList.remove("hidden");
	parts.empty?.classList.add("hidden");
	if (parts.textLayer) parts.textLayer.replaceChildren();
	if (parts.output) parts.output.value = "";
	setOcrText(parts.fileName, file.name);
	setOcrText(parts.imageSize, `${image.naturalWidth} x ${image.naturalHeight}`);
	setOcrText(parts.confidence, "--");
	renderLines(tool);
	setOcrStatus(tool, "图片已选择，可以开始识别");
}

async function recognizeImage(tool: HTMLElement) {
	const parts = getOcrParts(tool);
	const state = ocrState.get(tool);
	if (!state?.file) {
		setOcrStatus(tool, "请先选择图片", true);
		return;
	}
	if (state.isRecognizing) return;

	state.isRecognizing = true;
	try {
		const language = parts.language?.value || "chi_sim+eng";
		setOcrStatus(tool, "正在加载 OCR 引擎...");
		const worker = await Tesseract.createWorker(language, 1, {
			logger: (message) => {
				if (message.status === "recognizing text") {
					const progress = Math.round((message.progress || 0) * 100);
					setOcrStatus(tool, `正在识别文字... ${progress}%`);
					return;
				}
				if (message.status) setOcrStatus(tool, message.status);
			},
		});

		await worker.setParameters({
			tessedit_pageseg_mode: Tesseract.PSM.AUTO,
			preserve_interword_spaces: "1",
		});

		const result = await worker.recognize(
			state.file,
			{},
			{ blocks: true, text: true },
		);
		await worker.terminate();

		const text = normalizeText(result.data.text);
		const lines = getOcrLines(result.data.blocks);
		const words = getOcrWords(result.data.blocks);
		ocrState.set(tool, {
			...state,
			text,
			lines,
			words,
			isRecognizing: false,
		});

		if (parts.output) parts.output.value = text;
		setOcrText(
			parts.confidence,
			Number.isFinite(result.data.confidence)
				? `${Math.round(result.data.confidence)}%`
				: "--",
		);
		renderTextLayer(tool);
		renderLines(tool);
		setOcrStatus(
			tool,
			text ? `识别完成，共 ${lines.length} 行` : "识别完成，但没有发现文字",
			!text,
		);
	} catch (error) {
		ocrState.set(tool, { ...state, isRecognizing: false });
		setOcrStatus(
			tool,
			error instanceof Error ? error.message : "图片文字识别失败",
			true,
		);
	}
}

function clearOcrTool(tool: HTMLElement) {
	const parts = getOcrParts(tool);
	const state = ocrState.get(tool);
	if (state?.imageUrl) URL.revokeObjectURL(state.imageUrl);
	ocrState.set(tool, getInitialState());
	if (parts.fileInput) parts.fileInput.value = "";
	if (parts.preview) {
		parts.preview.removeAttribute("src");
		parts.preview.classList.add("hidden");
	}
	parts.stage?.classList.add("hidden");
	parts.empty?.classList.remove("hidden");
	if (parts.textLayer) parts.textLayer.replaceChildren();
	if (parts.output) parts.output.value = "";
	setOcrText(parts.fileName, "--");
	setOcrText(parts.imageSize, "--");
	setOcrText(parts.confidence, "--");
	renderLines(tool);
	setOcrStatus(tool, "已清空");
}

document.addEventListener("change", (event) => {
	const target = event.target;
	if (!(target instanceof HTMLInputElement)) return;
	const tool = target.closest<HTMLElement>("image-ocr-tool");
	if (!tool) return;
	if (target.matches("[data-file]") && target.files?.[0]) {
		void selectOcrImage(tool, target.files[0]);
	}
	if (target.matches("[data-show-layer]")) renderTextLayer(tool);
});

document.addEventListener("click", (event) => {
	const target = event.target;
	if (!(target instanceof Element)) return;
	const actionButton = target.closest<HTMLElement>(
		"image-ocr-tool [data-action]",
	);
	const tool = actionButton?.closest<HTMLElement>("image-ocr-tool");
	const action = actionButton?.dataset.action;
	if (!tool || !action) return;

	if (action === "recognize") void recognizeImage(tool);
	if (action === "copy-all") {
		const parts = getOcrParts(tool);
		const text = parts.output?.value || ocrState.get(tool)?.text || "";
		void copyText(tool, text);
	}
	if (action === "copy-line") {
		void copyText(tool, actionButton.dataset.copyText || "");
	}
	if (action === "clear") clearOcrTool(tool);
});

injectLayerStyle();
