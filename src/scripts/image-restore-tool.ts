type RestoreState = {
	file?: File;
	fileName?: string;
	image?: HTMLImageElement;
	originalUrl?: string;
	outputUrl?: string;
	isDrawing: boolean;
	hasMask: boolean;
	scale: number;
	isRestoring?: boolean;
};

const restoreState = new WeakMap<HTMLElement, RestoreState>();
let restoreWorker: Worker | undefined;
let restoreRequestId = 0;

type WorkerRestoreResult = {
	id: number;
	imageData?: ImageData;
	error?: string;
};

type MaskBounds = {
	x: number;
	y: number;
	width: number;
	height: number;
	pixels: number;
};

function getRestoreParts(tool: HTMLElement) {
	return {
		fileInput: tool.querySelector<HTMLInputElement>("[data-file]"),
		brush: tool.querySelector<HTMLInputElement>("[data-brush]"),
		brushLabel: tool.querySelector<HTMLElement>("[data-brush-label]"),
		radius: tool.querySelector<HTMLInputElement>("[data-radius]"),
		radiusLabel: tool.querySelector<HTMLElement>("[data-radius-label]"),
		algorithm: tool.querySelector<HTMLSelectElement>("[data-algorithm]"),
		download: tool.querySelector<HTMLAnchorElement>("[data-download]"),
		status: tool.querySelector<HTMLElement>("[data-status]"),
		canvasWrap: tool.querySelector<HTMLElement>("[data-canvas-wrap]"),
		empty: tool.querySelector<HTMLElement>("[data-empty]"),
		originalCanvas: tool.querySelector<HTMLCanvasElement>(
			"[data-original-canvas]",
		),
		maskCanvas: tool.querySelector<HTMLCanvasElement>("[data-mask-canvas]"),
		outputCanvas: tool.querySelector<HTMLCanvasElement>("[data-output-canvas]"),
		outputEmpty: tool.querySelector<HTMLElement>("[data-output-empty]"),
		originalName: tool.querySelector<HTMLElement>("[data-original-name]"),
		originalSize: tool.querySelector<HTMLElement>("[data-original-size]"),
		originalBytes: tool.querySelector<HTMLElement>("[data-original-bytes]"),
		outputSize: tool.querySelector<HTMLElement>("[data-output-size]"),
	};
}

function setRestoreStatus(tool: HTMLElement, message: string, isError = false) {
	const { status } = getRestoreParts(tool);
	if (!status) return;
	status.textContent = message;
	status.classList.toggle("text-[var(--primary)]", !isError);
	status.classList.toggle("text-red-500", isError);
}

function setRestoreText(element: HTMLElement | null, value: string) {
	if (element) element.textContent = value;
}

function formatBytes(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
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

function getRestoreWorker() {
	restoreWorker ??= new Worker("/vendor/image-restore-worker.js");
	return restoreWorker;
}

function runRestoreInWorker(
	imageData: ImageData,
	maskData: ImageData,
	radius: number,
	algorithm: string,
) {
	return new Promise<ImageData>((resolve, reject) => {
		const worker = getRestoreWorker();
		const id = ++restoreRequestId;
		const timer = window.setTimeout(() => {
			worker.removeEventListener("message", handleMessage);
			worker.removeEventListener("error", handleError);
			worker.removeEventListener("messageerror", handleMessageError);
			reject(new Error("图片还原超时，请缩小涂抹区域或换一张较小的图片"));
		}, 60000);

		const handleMessage = (event: MessageEvent<WorkerRestoreResult>) => {
			if (event.data.id !== id) return;
			window.clearTimeout(timer);
			worker.removeEventListener("message", handleMessage);
			worker.removeEventListener("error", handleError);
			worker.removeEventListener("messageerror", handleMessageError);
			if (event.data.error) {
				reject(new Error(event.data.error));
				return;
			}
			if (!event.data.imageData) {
				reject(new Error("图片还原失败"));
				return;
			}
			resolve(event.data.imageData);
		};

		const handleError = () => {
			window.clearTimeout(timer);
			worker.removeEventListener("message", handleMessage);
			worker.removeEventListener("error", handleError);
			worker.removeEventListener("messageerror", handleMessageError);
			reject(new Error("图片还原引擎运行失败"));
		};

		const handleMessageError = () => {
			window.clearTimeout(timer);
			worker.removeEventListener("message", handleMessage);
			worker.removeEventListener("error", handleError);
			worker.removeEventListener("messageerror", handleMessageError);
			reject(new Error("图片数据传递失败，请刷新页面后重试"));
		};

		worker.addEventListener("message", handleMessage);
		worker.addEventListener("error", handleError);
		worker.addEventListener("messageerror", handleMessageError);
		worker.postMessage({ id, imageData, maskData, radius, algorithm }, [
			imageData.data.buffer,
			maskData.data.buffer,
		]);
	});
}

function getMaskBounds(
	maskData: ImageData,
	padding: number,
): MaskBounds | null {
	let minX = maskData.width;
	let minY = maskData.height;
	let maxX = -1;
	let maxY = -1;
	let pixels = 0;

	for (let y = 0; y < maskData.height; y++) {
		for (let x = 0; x < maskData.width; x++) {
			const index = (y * maskData.width + x) * 4;
			if (maskData.data[index + 3] === 0) continue;
			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x);
			maxY = Math.max(maxY, y);
			pixels++;
		}
	}

	if (maxX < minX || maxY < minY) return null;

	const x = Math.max(0, minX - padding);
	const y = Math.max(0, minY - padding);
	const right = Math.min(maskData.width, maxX + padding + 1);
	const bottom = Math.min(maskData.height, maxY + padding + 1);

	return {
		x,
		y,
		width: right - x,
		height: bottom - y,
		pixels,
	};
}

function canvasToBlob(canvas: HTMLCanvasElement) {
	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) resolve(blob);
				else reject(new Error("图片导出失败"));
			},
			"image/png",
			0.95,
		);
	});
}

function updateRestoreLabels(tool: HTMLElement) {
	const { brush, brushLabel, radius, radiusLabel } = getRestoreParts(tool);
	if (brush && brushLabel) brushLabel.textContent = `${brush.value}px`;
	if (radius && radiusLabel) radiusLabel.textContent = radius.value;
}

function getCanvasPoint(canvas: HTMLCanvasElement, event: PointerEvent) {
	const rect = canvas.getBoundingClientRect();
	return {
		x: ((event.clientX - rect.left) / rect.width) * canvas.width,
		y: ((event.clientY - rect.top) / rect.height) * canvas.height,
	};
}

function drawMaskPoint(
	tool: HTMLElement,
	event: PointerEvent,
	shouldStart = false,
) {
	const parts = getRestoreParts(tool);
	const state = restoreState.get(tool);
	if (!state || !parts.maskCanvas || !parts.brush) return;
	const context = parts.maskCanvas.getContext("2d");
	if (!context) return;

	const point = getCanvasPoint(parts.maskCanvas, event);
	const brushSize = Math.max(4, Number(parts.brush.value || 28));
	context.lineCap = "round";
	context.lineJoin = "round";
	context.strokeStyle = "rgba(255, 72, 72, 0.72)";
	context.lineWidth = brushSize;

	if (shouldStart) {
		context.beginPath();
		context.moveTo(point.x, point.y);
		context.lineTo(point.x, point.y);
	} else {
		context.lineTo(point.x, point.y);
	}
	context.stroke();
	state.hasMask = true;
}

function resetDownload(tool: HTMLElement) {
	const state = restoreState.get(tool);
	const { download } = getRestoreParts(tool);
	if (state?.outputUrl) URL.revokeObjectURL(state.outputUrl);
	if (state) state.outputUrl = undefined;
	if (!download) return;
	download.href = "#";
	download.classList.add("pointer-events-none", "opacity-50");
}

async function selectRestoreImage(tool: HTMLElement, file: File) {
	if (!file.type.startsWith("image/")) {
		setRestoreStatus(tool, "请选择有效的图片文件", true);
		return;
	}

	const parts = getRestoreParts(tool);
	const image = await loadImage(file);
	const existing = restoreState.get(tool);
	if (existing?.originalUrl) URL.revokeObjectURL(existing.originalUrl);
	if (existing?.outputUrl) URL.revokeObjectURL(existing.outputUrl);

	const maxCanvasSize = 2200;
	const scale = Math.min(
		1,
		maxCanvasSize / Math.max(image.naturalWidth, image.naturalHeight),
	);
	const width = Math.max(1, Math.round(image.naturalWidth * scale));
	const height = Math.max(1, Math.round(image.naturalHeight * scale));

	if (!parts.originalCanvas || !parts.maskCanvas || !parts.outputCanvas) return;
	for (const canvas of [
		parts.originalCanvas,
		parts.maskCanvas,
		parts.outputCanvas,
	]) {
		canvas.width = width;
		canvas.height = height;
	}

	const originalContext = parts.originalCanvas.getContext("2d");
	const maskContext = parts.maskCanvas.getContext("2d");
	const outputContext = parts.outputCanvas.getContext("2d");
	if (!originalContext || !maskContext || !outputContext) {
		setRestoreStatus(tool, "当前浏览器不支持 Canvas", true);
		return;
	}

	originalContext.clearRect(0, 0, width, height);
	maskContext.clearRect(0, 0, width, height);
	outputContext.clearRect(0, 0, width, height);
	originalContext.drawImage(image, 0, 0, width, height);

	const originalUrl = URL.createObjectURL(file);
	restoreState.set(tool, {
		file,
		fileName: file.name,
		image,
		originalUrl,
		isDrawing: false,
		hasMask: false,
		scale,
	});

	parts.empty?.classList.add("hidden");
	parts.canvasWrap?.classList.remove("hidden");
	parts.originalCanvas.classList.remove("hidden");
	parts.maskCanvas.classList.remove("hidden");
	parts.outputEmpty?.classList.remove("hidden");
	parts.outputCanvas.classList.add("hidden");
	setRestoreText(parts.originalName, file.name);
	setRestoreText(
		parts.originalSize,
		`${image.naturalWidth} x ${image.naturalHeight}`,
	);
	setRestoreText(parts.originalBytes, formatBytes(file.size));
	setRestoreText(parts.outputSize, "--");
	resetDownload(tool);
	setRestoreStatus(tool, "图片已选择，请涂抹需要还原的区域");
}

function clearMask(tool: HTMLElement) {
	const parts = getRestoreParts(tool);
	const state = restoreState.get(tool);
	if (!parts.maskCanvas || !state) return;
	const context = parts.maskCanvas.getContext("2d");
	context?.clearRect(0, 0, parts.maskCanvas.width, parts.maskCanvas.height);
	state.hasMask = false;
	resetDownload(tool);
	parts.outputCanvas?.classList.add("hidden");
	parts.outputEmpty?.classList.remove("hidden");
	setRestoreText(parts.outputSize, "--");
	setRestoreStatus(tool, "已清除涂抹区域");
}

function clearRestoreTool(tool: HTMLElement) {
	const parts = getRestoreParts(tool);
	const state = restoreState.get(tool);
	if (state?.originalUrl) URL.revokeObjectURL(state.originalUrl);
	if (state?.outputUrl) URL.revokeObjectURL(state.outputUrl);
	restoreState.delete(tool);
	if (parts.fileInput) parts.fileInput.value = "";
	for (const canvas of [
		parts.originalCanvas,
		parts.maskCanvas,
		parts.outputCanvas,
	]) {
		const context = canvas?.getContext("2d");
		if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
		canvas?.classList.add("hidden");
	}
	parts.canvasWrap?.classList.add("hidden");
	parts.empty?.classList.remove("hidden");
	parts.outputEmpty?.classList.remove("hidden");
	setRestoreText(parts.originalName, "--");
	setRestoreText(parts.originalSize, "--");
	setRestoreText(parts.originalBytes, "--");
	setRestoreText(parts.outputSize, "--");
	resetDownload(tool);
	setRestoreStatus(tool, "等待选择图片");
}

async function restoreImage(tool: HTMLElement) {
	const parts = getRestoreParts(tool);
	const state = restoreState.get(tool);
	if (
		!state?.file ||
		!parts.originalCanvas ||
		!parts.maskCanvas ||
		!parts.outputCanvas
	) {
		setRestoreStatus(tool, "请先选择图片", true);
		return;
	}
	if (!state.hasMask) {
		setRestoreStatus(tool, "请先涂抹需要还原的区域", true);
		return;
	}
	if (state.isRestoring) {
		setRestoreStatus(tool, "正在还原图片，请稍等");
		return;
	}

	try {
		state.isRestoring = true;
		setRestoreStatus(tool, "正在后台还原图片，页面可以继续操作...");
		const originalContext = parts.originalCanvas.getContext("2d");
		const maskContext = parts.maskCanvas.getContext("2d");
		const outputContext = parts.outputCanvas.getContext("2d");
		if (!originalContext || !maskContext || !outputContext) {
			throw new Error("当前浏览器不支持 Canvas");
		}

		const fullMaskData = maskContext.getImageData(
			0,
			0,
			parts.maskCanvas.width,
			parts.maskCanvas.height,
		);
		const radius = Number(parts.radius?.value || 3);
		const brushSize = Number(parts.brush?.value || 28);
		const padding = Math.max(48, Math.ceil(brushSize * 1.5 + radius * 8));
		const maskBounds = getMaskBounds(fullMaskData, padding);
		if (!maskBounds) {
			throw new Error("请先涂抹需要还原的区域");
		}

		const imageData = originalContext.getImageData(
			maskBounds.x,
			maskBounds.y,
			maskBounds.width,
			maskBounds.height,
		);
		const maskData = maskContext.getImageData(
			maskBounds.x,
			maskBounds.y,
			maskBounds.width,
			maskBounds.height,
		);
		setRestoreStatus(
			tool,
			`正在后台还原局部区域 ${maskBounds.width} x ${maskBounds.height}，页面可以继续操作...`,
		);
		const outputData = await runRestoreInWorker(
			imageData,
			maskData,
			radius,
			parts.algorithm?.value || "telea",
		);
		outputContext.clearRect(
			0,
			0,
			parts.outputCanvas.width,
			parts.outputCanvas.height,
		);
		outputContext.drawImage(parts.originalCanvas, 0, 0);
		outputContext.putImageData(outputData, maskBounds.x, maskBounds.y);

		parts.outputCanvas.classList.remove("hidden");
		parts.outputEmpty?.classList.add("hidden");
		setRestoreText(
			parts.outputSize,
			`${parts.outputCanvas.width} x ${parts.outputCanvas.height}`,
		);

		const blob = await canvasToBlob(parts.outputCanvas);
		if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);
		const outputUrl = URL.createObjectURL(blob);
		state.outputUrl = outputUrl;

		if (parts.download) {
			const baseName = (state.fileName || "image").replace(/\.[^.]+$/, "");
			parts.download.href = outputUrl;
			parts.download.download = `${baseName}-restored.png`;
			parts.download.classList.remove("pointer-events-none", "opacity-50");
		}
		setRestoreStatus(tool, "图片还原完成，可下载结果");
	} catch (error) {
		setRestoreStatus(
			tool,
			error instanceof Error ? error.message : "图片还原失败",
			true,
		);
	} finally {
		state.isRestoring = false;
	}
}

document.addEventListener("change", (event) => {
	const target = event.target;
	if (!(target instanceof HTMLInputElement)) return;
	const tool = target.closest<HTMLElement>("image-restore-tool");
	if (!tool) return;
	if (target.matches("[data-file]") && target.files?.[0]) {
		void selectRestoreImage(tool, target.files[0]);
	}
});

document.addEventListener("input", (event) => {
	const target = event.target;
	if (!(target instanceof HTMLInputElement)) return;
	const tool = target.closest<HTMLElement>("image-restore-tool");
	if (!tool) return;
	if (target.matches("[data-brush], [data-radius]")) updateRestoreLabels(tool);
});

document.addEventListener("pointerdown", (event) => {
	const target = event.target;
	if (
		!(target instanceof HTMLCanvasElement) ||
		!target.matches("[data-mask-canvas]")
	)
		return;
	const tool = target.closest<HTMLElement>("image-restore-tool");
	if (!tool) return;
	const state = restoreState.get(tool);
	if (!state) return;
	event.preventDefault();
	target.setPointerCapture(event.pointerId);
	state.isDrawing = true;
	drawMaskPoint(tool, event, true);
});

document.addEventListener("pointermove", (event) => {
	const target = event.target;
	if (
		!(target instanceof HTMLCanvasElement) ||
		!target.matches("[data-mask-canvas]")
	)
		return;
	const tool = target.closest<HTMLElement>("image-restore-tool");
	const state = tool ? restoreState.get(tool) : undefined;
	if (!tool || !state?.isDrawing) return;
	event.preventDefault();
	drawMaskPoint(tool, event);
});

document.addEventListener("pointerup", (event) => {
	const target = event.target;
	if (
		!(target instanceof HTMLCanvasElement) ||
		!target.matches("[data-mask-canvas]")
	)
		return;
	const tool = target.closest<HTMLElement>("image-restore-tool");
	const state = tool ? restoreState.get(tool) : undefined;
	if (!state) return;
	state.isDrawing = false;
});

document.addEventListener("click", (event) => {
	const target = event.target;
	if (!(target instanceof Element)) return;
	const actionButton = target.closest<HTMLElement>("[data-action]");
	const tool = actionButton?.closest<HTMLElement>("image-restore-tool");
	const action = actionButton?.dataset.action;
	if (!tool || !action) return;
	if (action === "restore") void restoreImage(tool);
	if (action === "clear-mask") clearMask(tool);
	if (action === "clear") clearRestoreTool(tool);
});

for (const tool of document.querySelectorAll<HTMLElement>(
	"image-restore-tool",
)) {
	restoreState.set(tool, { isDrawing: false, hasMask: false, scale: 1 });
	updateRestoreLabels(tool);
}

export {};
