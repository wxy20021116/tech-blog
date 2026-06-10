const BEIJING_TIME_ZONE = "Asia/Shanghai";

function getTimestampToolParts(tool: HTMLElement) {
	return {
		status: tool.querySelector<HTMLElement>("[data-status]"),
		timestampInput: tool.querySelector<HTMLInputElement>(
			"[data-timestamp-input]",
		),
		datetimeInput: tool.querySelector<HTMLInputElement>(
			"[data-datetime-input]",
		),
		nowSeconds: tool.querySelector<HTMLElement>("[data-now-seconds]"),
		nowMilliseconds: tool.querySelector<HTMLElement>("[data-now-milliseconds]"),
		nowLocal: tool.querySelector<HTMLElement>("[data-now-local]"),
		resultBeijing: tool.querySelector<HTMLElement>("[data-result-beijing]"),
		resultLocal: tool.querySelector<HTMLElement>("[data-result-local]"),
		resultUtc: tool.querySelector<HTMLElement>("[data-result-utc]"),
		resultSeconds: tool.querySelector<HTMLElement>("[data-result-seconds]"),
		resultMilliseconds: tool.querySelector<HTMLElement>(
			"[data-result-milliseconds]",
		),
		resultDateIso: tool.querySelector<HTMLElement>("[data-result-date-iso]"),
	};
}

function formatDateTime(date: Date, timeZone?: string) {
	return new Intl.DateTimeFormat("zh-CN", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
		timeZone,
	}).format(date);
}

function setTimestampStatus(
	tool: HTMLElement,
	message: string,
	isError = false,
) {
	const { status } = getTimestampToolParts(tool);
	if (!status) return;
	status.textContent = message;
	status.classList.toggle("text-[var(--primary)]", !isError);
	status.classList.toggle("text-red-500", isError);
}

function setText(element: HTMLElement | null, value: string) {
	if (element) element.textContent = value;
}

function normalizeTimestampInput(value: string) {
	const input = value.trim();
	if (!input) return null;
	if (!/^-?\d+(?:\.\d+)?$/.test(input)) return null;

	const numericValue = Number(input);
	if (!Number.isFinite(numericValue)) return null;

	const digits = input.replace(/^-/, "").replace(/\.\d+$/, "").length;
	const milliseconds = digits >= 13 ? numericValue : numericValue * 1000;
	if (!Number.isFinite(milliseconds)) return null;

	return milliseconds;
}

function toDatetimeLocalValue(date: Date) {
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function updateNow(tool: HTMLElement) {
	const parts = getTimestampToolParts(tool);
	const now = new Date();
	setText(parts.nowSeconds, String(Math.floor(now.getTime() / 1000)));
	setText(parts.nowMilliseconds, String(now.getTime()));
	setText(parts.nowLocal, formatDateTime(now));
}

function timestampToDate(tool: HTMLElement) {
	const parts = getTimestampToolParts(tool);
	const milliseconds = normalizeTimestampInput(
		parts.timestampInput?.value || "",
	);
	if (milliseconds == null) {
		setText(parts.resultBeijing, "--");
		setText(parts.resultLocal, "--");
		setText(parts.resultUtc, "--");
		setTimestampStatus(tool, "请输入有效的秒时间戳或毫秒时间戳", true);
		return;
	}

	const date = new Date(milliseconds);
	if (Number.isNaN(date.getTime())) {
		setTimestampStatus(tool, "时间戳超出可转换范围", true);
		return;
	}

	setText(
		parts.resultBeijing,
		`${formatDateTime(date, BEIJING_TIME_ZONE)} 北京时间`,
	);
	setText(parts.resultLocal, `${formatDateTime(date)} 本地时间`);
	setText(parts.resultUtc, date.toISOString());
	setTimestampStatus(tool, "时间戳转换完成");
}

function dateToTimestamp(tool: HTMLElement) {
	const parts = getTimestampToolParts(tool);
	const value = parts.datetimeInput?.value;
	if (!value) {
		setText(parts.resultSeconds, "--");
		setText(parts.resultMilliseconds, "--");
		setText(parts.resultDateIso, "--");
		setTimestampStatus(tool, "请选择日期时间", true);
		return;
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		setTimestampStatus(tool, "日期时间格式不正确", true);
		return;
	}

	setText(parts.resultSeconds, String(Math.floor(date.getTime() / 1000)));
	setText(parts.resultMilliseconds, String(date.getTime()));
	setText(parts.resultDateIso, date.toISOString());
	setTimestampStatus(tool, "日期时间转换完成");
}

function useNowTimestamp(tool: HTMLElement) {
	const { timestampInput } = getTimestampToolParts(tool);
	if (timestampInput) timestampInput.value = String(Date.now());
	timestampToDate(tool);
}

function useNowDate(tool: HTMLElement) {
	const { datetimeInput } = getTimestampToolParts(tool);
	if (datetimeInput) datetimeInput.value = toDatetimeLocalValue(new Date());
	dateToTimestamp(tool);
}

function clearTimestamp(tool: HTMLElement) {
	const parts = getTimestampToolParts(tool);
	if (parts.timestampInput) parts.timestampInput.value = "";
	setText(parts.resultBeijing, "--");
	setText(parts.resultLocal, "--");
	setText(parts.resultUtc, "--");
	setTimestampStatus(tool, "已清空时间戳输入");
}

function clearDate(tool: HTMLElement) {
	const parts = getTimestampToolParts(tool);
	if (parts.datetimeInput) parts.datetimeInput.value = "";
	setText(parts.resultSeconds, "--");
	setText(parts.resultMilliseconds, "--");
	setText(parts.resultDateIso, "--");
	setTimestampStatus(tool, "已清空日期时间输入");
}

async function copyTimestampValue(tool: HTMLElement, target: string) {
	const value = tool
		.querySelector<HTMLElement>(`[data-${target}]`)
		?.textContent?.trim();
	if (!value || value === "--") {
		setTimestampStatus(tool, "没有可复制的结果", true);
		return;
	}

	try {
		await navigator.clipboard.writeText(value);
		setTimestampStatus(tool, "结果已复制");
	} catch {
		setTimestampStatus(tool, "复制失败，请手动选中结果复制", true);
	}
}

function initTimestampTools() {
	for (const tool of document.querySelectorAll<HTMLElement>("timestamp-tool")) {
		if (tool.dataset.ready !== "true") {
			tool.dataset.ready = "true";
			tool
				.querySelector("[data-timestamp-input]")
				?.addEventListener("keydown", (event) => {
					if (event instanceof KeyboardEvent && event.key === "Enter") {
						timestampToDate(tool);
					}
				});
			tool
				.querySelector("[data-datetime-input]")
				?.addEventListener("change", () => {
					dateToTimestamp(tool);
				});
		}

		updateNow(tool);
	}
}

function updateAllTimestampTools() {
	for (const tool of document.querySelectorAll<HTMLElement>("timestamp-tool")) {
		updateNow(tool);
	}
}

document.addEventListener("click", (event) => {
	const target = event.target;
	if (!(target instanceof Element)) return;

	const actionButton = target.closest<HTMLElement>(
		"timestamp-tool [data-action]",
	);
	const copyButton = target.closest<HTMLElement>(
		"timestamp-tool [data-copy-target]",
	);
	const tool = (actionButton || copyButton)?.closest<HTMLElement>(
		"timestamp-tool",
	);
	if (!tool) return;

	const action = actionButton?.dataset.action;
	if (action === "now") updateNow(tool);
	if (action === "timestamp-to-date") timestampToDate(tool);
	if (action === "date-to-timestamp") dateToTimestamp(tool);
	if (action === "use-now-timestamp") useNowTimestamp(tool);
	if (action === "use-now-date") useNowDate(tool);
	if (action === "clear-timestamp") clearTimestamp(tool);
	if (action === "clear-date") clearDate(tool);
	if (copyButton?.dataset.copyTarget) {
		void copyTimestampValue(tool, copyButton.dataset.copyTarget);
	}
});

initTimestampTools();

window.setInterval(updateAllTimestampTools, 1000);

if (window?.swup?.hooks) {
	window.swup.hooks.on("page:view", initTimestampTools);
} else {
	document.addEventListener("swup:enable", () => {
		window.swup?.hooks.on("page:view", initTimestampTools);
	});
}
