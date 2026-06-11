type CvMat = {
	delete: () => void;
};

type CvApi = {
	Mat: {
		zeros: (rows: number, cols: number, type: number) => CvMat;
	};
	CV_8UC1: number;
	COLOR_RGBA2RGB: number;
	COLOR_RGBA2GRAY: number;
	INPAINT_TELEA: number;
	INPAINT_NS: number;
	imread: (source: HTMLCanvasElement) => CvMat;
	imshow: (target: HTMLCanvasElement, mat: CvMat) => void;
	cvtColor: (source: CvMat, target: CvMat, code: number) => void;
	inpaint: (
		source: CvMat,
		mask: CvMat,
		target: CvMat,
		radius: number,
		flags: number,
	) => void;
	onRuntimeInitialized?: () => void;
};

type RestoreState = {
	file?: File;
	fileName?: string;
	image?: HTMLImageElement;
	originalUrl?: string;
	outputUrl?: string;
	isDrawing: boolean;
	hasMask: boolean;
	scale: number;
};

declare global {
	interface Window {
		cv?: CvApi;
	}
}

const restoreState = new WeakMap<HTMLElement, RestoreState>();
let opencvPromise: Promise<CvApi> | undefined;

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

function loadOpenCv() {
	if (window.cv?.Mat) return Promise.resolve(window.cv);
	if (opencvPromise) return opencvPromise;

	opencvPromise = new Promise<CvApi>((resolve, reject) => {
		const waitForRuntime = () => {
			const startedAt = Date.now();
			const timer = window.setInterval(() => {
				if (window.cv?.Mat && window.cv.inpaint) {
					window.clearInterval(timer);
					resolve(window.cv);
					return;
				}
				if (Date.now() - startedAt > 15000) {
					window.clearInterval(timer);
					reject(new Error("OpenCV 初始化超时，请刷新页面后重试"));
				}
			}, 80);
		};
		const existingScript = document.querySelector<HTMLScriptElement>(
			'script[data-opencv-loader="true"]',
		);

		if (existingScript) {
			waitForRuntime();
			existingScript.addEventListener("error", () =>
				reject(new Error("OpenCV 加载失败，请检查网络后重试")),
			);
			return;
		}

		const script = document.createElement("script");
		script.src =
			"https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js";
		script.async = true;
		script.dataset.opencvLoader = "true";
		script.onload = waitForRuntime;
		script.onerror = () =>
			reject(new Error("OpenCV 加载失败，请检查网络后重试"));
		document.head.appendChild(script);
	});

	return opencvPromise;
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

	try {
		setRestoreStatus(tool, "正在加载本地图像修复引擎...");
		const cv = await loadOpenCv();
		setRestoreStatus(tool, "正在还原图片...");

		const srcRgba = cv.imread(parts.originalCanvas);
		const src = cv.imread(parts.originalCanvas);
		const maskRgba = cv.imread(parts.maskCanvas);
		const mask = cv.Mat.zeros(
			parts.maskCanvas.height,
			parts.maskCanvas.width,
			cv.CV_8UC1,
		);
		const dst = cv.imread(parts.originalCanvas);

		try {
			cv.cvtColor(srcRgba, src, cv.COLOR_RGBA2RGB);
			cv.cvtColor(maskRgba, mask, cv.COLOR_RGBA2GRAY);
			const radius = Math.max(
				1,
				Math.min(20, Number(parts.radius?.value || 3)),
			);
			const method =
				parts.algorithm?.value === "ns" ? cv.INPAINT_NS : cv.INPAINT_TELEA;
			cv.inpaint(src, mask, dst, radius, method);
			cv.imshow(parts.outputCanvas, dst);
		} finally {
			srcRgba.delete();
			src.delete();
			maskRgba.delete();
			mask.delete();
			dst.delete();
		}

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
	const actionButton = target.closest<HTMLElement>(
		"image-restore-tool [data-action]",
	);
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
