type ImageState = {
	file?: File;
	originalUrl?: string;
	outputUrl?: string;
};

const imageState = new WeakMap<HTMLElement, ImageState>();

function getImageToolParts(tool: HTMLElement) {
	return {
		fileInput: tool.querySelector<HTMLInputElement>("[data-file]"),
		format: tool.querySelector<HTMLSelectElement>("[data-format]"),
		quality: tool.querySelector<HTMLInputElement>("[data-quality]"),
		qualityLabel: tool.querySelector<HTMLElement>("[data-quality-label]"),
		maxSize: tool.querySelector<HTMLInputElement>("[data-max-size]"),
		download: tool.querySelector<HTMLAnchorElement>("[data-download]"),
		status: tool.querySelector<HTMLElement>("[data-status]"),
		originalPreview: tool.querySelector<HTMLImageElement>(
			"[data-original-preview]",
		),
		originalEmpty: tool.querySelector<HTMLElement>("[data-original-empty]"),
		originalName: tool.querySelector<HTMLElement>("[data-original-name]"),
		originalSize: tool.querySelector<HTMLElement>("[data-original-size]"),
		originalBytes: tool.querySelector<HTMLElement>("[data-original-bytes]"),
		outputPreview: tool.querySelector<HTMLImageElement>(
			"[data-output-preview]",
		),
		outputEmpty: tool.querySelector<HTMLElement>("[data-output-empty]"),
		outputFormat: tool.querySelector<HTMLElement>("[data-output-format]"),
		outputSize: tool.querySelector<HTMLElement>("[data-output-size]"),
		outputBytes: tool.querySelector<HTMLElement>("[data-output-bytes]"),
		savedBytes: tool.querySelector<HTMLElement>("[data-saved-bytes]"),
	};
}

function setImageStatus(tool: HTMLElement, message: string, isError = false) {
	const { status } = getImageToolParts(tool);
	if (!status) return;
	status.textContent = message;
	status.classList.toggle("text-[var(--primary)]", !isError);
	status.classList.toggle("text-red-500", isError);
}

function setImageText(element: HTMLElement | null, value: string) {
	if (element) element.textContent = value;
}

function formatBytes(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatExtension(type: string) {
	if (type === "image/webp") return "webp";
	if (type === "image/png") return "png";
	return "jpg";
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

function canvasToBlob(
	canvas: HTMLCanvasElement,
	type: string,
	quality: number,
) {
	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) resolve(blob);
				else reject(new Error("图片压缩失败"));
			},
			type,
			quality,
		);
	});
}

function updateQualityLabel(tool: HTMLElement) {
	const { quality, qualityLabel } = getImageToolParts(tool);
	if (qualityLabel && quality) qualityLabel.textContent = `${quality.value}%`;
}

async function selectImage(tool: HTMLElement, file: File) {
	if (!file.type.startsWith("image/")) {
		setImageStatus(tool, "请选择有效的图片文件", true);
		return;
	}

	const parts = getImageToolParts(tool);
	const state = imageState.get(tool) || {};
	if (state.originalUrl) URL.revokeObjectURL(state.originalUrl);
	if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);

	const previewUrl = URL.createObjectURL(file);
	imageState.set(tool, { file, originalUrl: previewUrl });

	if (parts.originalPreview) {
		parts.originalPreview.src = previewUrl;
		parts.originalPreview.classList.remove("hidden");
	}
	parts.originalEmpty?.classList.add("hidden");

	const image = await loadImage(file);
	setImageText(parts.originalName, file.name);
	setImageText(
		parts.originalSize,
		`${image.naturalWidth} x ${image.naturalHeight}`,
	);
	setImageText(parts.originalBytes, formatBytes(file.size));
	setImageText(parts.outputFormat, "--");
	setImageText(parts.outputSize, "--");
	setImageText(parts.outputBytes, "--");
	setImageText(parts.savedBytes, "--");
	if (parts.outputPreview) {
		parts.outputPreview.removeAttribute("src");
		parts.outputPreview.classList.add("hidden");
	}
	parts.outputEmpty?.classList.remove("hidden");
	if (parts.download) {
		parts.download.href = "#";
		parts.download.classList.add("pointer-events-none", "opacity-50");
	}
	setImageStatus(tool, "图片已选择，可以开始压缩");
}

async function compressImage(tool: HTMLElement) {
	const parts = getImageToolParts(tool);
	const state = imageState.get(tool);
	if (!state?.file) {
		setImageStatus(tool, "请先选择图片", true);
		return;
	}

	try {
		setImageStatus(tool, "正在压缩图片...");
		const image = await loadImage(state.file);
		const maxSize = Math.max(64, Number(parts.maxSize?.value || 1920));
		const ratio = Math.min(
			1,
			maxSize / Math.max(image.naturalWidth, image.naturalHeight),
		);
		const width = Math.max(1, Math.round(image.naturalWidth * ratio));
		const height = Math.max(1, Math.round(image.naturalHeight * ratio));
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext("2d");
		if (!context) throw new Error("当前浏览器不支持 Canvas 压缩");
		context.drawImage(image, 0, 0, width, height);

		const type = parts.format?.value || "image/webp";
		const quality = Math.min(
			1,
			Math.max(0.1, Number(parts.quality?.value || 80) / 100),
		);
		const blob = await canvasToBlob(canvas, type, quality);
		if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);
		const outputUrl = URL.createObjectURL(blob);
		imageState.set(tool, { ...state, outputUrl });

		if (parts.outputPreview) {
			parts.outputPreview.src = outputUrl;
			parts.outputPreview.classList.remove("hidden");
		}
		parts.outputEmpty?.classList.add("hidden");
		setImageText(parts.outputFormat, type.replace("image/", "").toUpperCase());
		setImageText(parts.outputSize, `${width} x ${height}`);
		setImageText(parts.outputBytes, formatBytes(blob.size));
		const saved = state.file.size - blob.size;
		const percent = state.file.size > 0 ? (saved / state.file.size) * 100 : 0;
		setImageText(
			parts.savedBytes,
			`${formatBytes(Math.abs(saved))} ${saved >= 0 ? "更小" : "更大"}（${percent.toFixed(1)}%）`,
		);

		if (parts.download) {
			const baseName = state.file.name.replace(/\.[^.]+$/, "");
			parts.download.href = outputUrl;
			parts.download.download = `${baseName}-compressed.${formatExtension(type)}`;
			parts.download.classList.remove("pointer-events-none", "opacity-50");
		}
		setImageStatus(tool, "图片压缩完成");
	} catch (error) {
		setImageStatus(
			tool,
			error instanceof Error ? error.message : "图片压缩失败",
			true,
		);
	}
}

function clearImageTool(tool: HTMLElement) {
	const parts = getImageToolParts(tool);
	const state = imageState.get(tool);
	if (state?.originalUrl) URL.revokeObjectURL(state.originalUrl);
	if (state?.outputUrl) URL.revokeObjectURL(state.outputUrl);
	imageState.delete(tool);
	if (parts.fileInput) parts.fileInput.value = "";
	if (parts.originalPreview) {
		parts.originalPreview.removeAttribute("src");
		parts.originalPreview.classList.add("hidden");
	}
	if (parts.outputPreview) {
		parts.outputPreview.removeAttribute("src");
		parts.outputPreview.classList.add("hidden");
	}
	parts.originalEmpty?.classList.remove("hidden");
	parts.outputEmpty?.classList.remove("hidden");
	for (const element of [
		parts.originalName,
		parts.originalSize,
		parts.originalBytes,
		parts.outputFormat,
		parts.outputSize,
		parts.outputBytes,
		parts.savedBytes,
	]) {
		setImageText(element, "--");
	}
	if (parts.download) {
		parts.download.href = "#";
		parts.download.classList.add("pointer-events-none", "opacity-50");
	}
	setImageStatus(tool, "已清空");
}

document.addEventListener("change", (event) => {
	const target = event.target;
	if (
		!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)
	)
		return;
	const tool = target.closest<HTMLElement>("image-compress-tool");
	if (!tool) return;
	if (
		target.matches("[data-file]") &&
		target instanceof HTMLInputElement &&
		target.files?.[0]
	) {
		void selectImage(tool, target.files[0]);
	}
	if (target.matches("[data-quality]")) updateQualityLabel(tool);
});

document.addEventListener("input", (event) => {
	const target = event.target;
	if (!(target instanceof HTMLInputElement)) return;
	const tool = target.closest<HTMLElement>("image-compress-tool");
	if (!tool) return;
	if (target.matches("[data-quality]")) updateQualityLabel(tool);
});

document.addEventListener("click", (event) => {
	const target = event.target;
	if (!(target instanceof Element)) return;
	const actionButton = target.closest<HTMLElement>(
		"image-compress-tool [data-action]",
	);
	const tool = actionButton?.closest<HTMLElement>("image-compress-tool");
	const action = actionButton?.dataset.action;
	if (!tool || !action) return;
	if (action === "compress") void compressImage(tool);
	if (action === "clear") clearImageTool(tool);
});

for (const tool of document.querySelectorAll<HTMLElement>(
	"image-compress-tool",
)) {
	updateQualityLabel(tool);
}
