type DiffOperation = "equal" | "insert" | "delete";

type DiffPart = {
	type: DiffOperation;
	text: string;
	leftLine?: number;
	rightLine?: number;
};

type SideBySideDiffRow = {
	left?: DiffPart;
	right?: DiffPart;
};

function getTextDiffParts(tool: HTMLElement) {
	return {
		leftFile: tool.querySelector<HTMLInputElement>("[data-left-file]"),
		rightFile: tool.querySelector<HTMLInputElement>("[data-right-file]"),
		leftText: tool.querySelector<HTMLTextAreaElement>("[data-left-text]"),
		rightText: tool.querySelector<HTMLTextAreaElement>("[data-right-text]"),
		leftName: tool.querySelector<HTMLElement>("[data-left-name]"),
		rightName: tool.querySelector<HTMLElement>("[data-right-name]"),
		leftMeta: tool.querySelector<HTMLElement>("[data-left-meta]"),
		rightMeta: tool.querySelector<HTMLElement>("[data-right-meta]"),
		diffOutput: tool.querySelector<HTMLElement>("[data-diff-output]"),
		summary: tool.querySelector<HTMLElement>("[data-summary]"),
		status: tool.querySelector<HTMLElement>("[data-status]"),
	};
}

function setTextDiffStatus(
	tool: HTMLElement,
	message: string,
	isError = false,
) {
	const { status } = getTextDiffParts(tool);
	if (!status) return;
	status.textContent = message;
	status.classList.toggle("text-[var(--primary)]", !isError);
	status.classList.toggle("text-red-500", isError);
}

function formatTextDiffBytes(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function splitDiffLines(text: string) {
	if (!text) return [];
	const lines = text.split(/\r\n|\r|\n/);
	if (/\r\n$|\r$|\n$/.test(text)) lines.pop();
	return lines;
}

function getTraceValue(trace: Map<number, number>, key: number) {
	return trace.get(key) ?? -1;
}

function buildMyersDiff(leftLines: string[], rightLines: string[]) {
	const leftLength = leftLines.length;
	const rightLength = rightLines.length;
	const maxDistance = leftLength + rightLength;
	const offset = maxDistance + 1;
	const frontier = Array<number>(maxDistance * 2 + 3).fill(-1);
	frontier[offset + 1] = 0;

	const traces: Map<number, number>[] = [];

	for (let distance = 0; distance <= maxDistance; distance += 1) {
		const currentTrace = new Map<number, number>();

		for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
			const shouldMoveDown =
				diagonal === -distance ||
				(diagonal !== distance &&
					frontier[offset + diagonal - 1] < frontier[offset + diagonal + 1]);
			let x = shouldMoveDown
				? frontier[offset + diagonal + 1]
				: frontier[offset + diagonal - 1] + 1;
			let y = x - diagonal;

			while (
				x < leftLength &&
				y < rightLength &&
				leftLines[x] === rightLines[y]
			) {
				x += 1;
				y += 1;
			}

			frontier[offset + diagonal] = x;
			currentTrace.set(diagonal, x);

			if (x >= leftLength && y >= rightLength) {
				traces.push(currentTrace);
				return backtrackMyersDiff(leftLines, rightLines, traces);
			}
		}

		traces.push(currentTrace);
	}

	return [];
}

function backtrackMyersDiff(
	leftLines: string[],
	rightLines: string[],
	traces: Map<number, number>[],
) {
	const parts: DiffPart[] = [];
	let x = leftLines.length;
	let y = rightLines.length;

	for (let distance = traces.length - 1; distance > 0; distance -= 1) {
		const diagonal = x - y;
		const previousTrace = traces[distance - 1];
		const shouldMoveDown =
			diagonal === -distance ||
			(diagonal !== distance &&
				getTraceValue(previousTrace, diagonal - 1) <
					getTraceValue(previousTrace, diagonal + 1));
		const previousDiagonal = shouldMoveDown ? diagonal + 1 : diagonal - 1;
		const previousX = getTraceValue(previousTrace, previousDiagonal);
		const previousY = previousX - previousDiagonal;

		while (x > previousX && y > previousY) {
			parts.push({
				type: "equal",
				text: leftLines[x - 1],
				leftLine: x,
				rightLine: y,
			});
			x -= 1;
			y -= 1;
		}

		if (shouldMoveDown) {
			parts.push({
				type: "insert",
				text: rightLines[previousY],
				rightLine: previousY + 1,
			});
		} else {
			parts.push({
				type: "delete",
				text: leftLines[previousX],
				leftLine: previousX + 1,
			});
		}

		x = previousX;
		y = previousY;
	}

	while (x > 0 && y > 0) {
		parts.push({
			type: "equal",
			text: leftLines[x - 1],
			leftLine: x,
			rightLine: y,
		});
		x -= 1;
		y -= 1;
	}

	return parts.reverse();
}

function toSideBySideRows(parts: DiffPart[]) {
	const rows: SideBySideDiffRow[] = [];

	for (let index = 0; index < parts.length; index += 1) {
		const part = parts[index];
		if (part.type === "equal") {
			rows.push({ left: part, right: part });
			continue;
		}

		const deletes: DiffPart[] = [];
		const inserts: DiffPart[] = [];
		while (index < parts.length && parts[index].type !== "equal") {
			const changedPart = parts[index];
			if (changedPart.type === "delete") deletes.push(changedPart);
			if (changedPart.type === "insert") inserts.push(changedPart);
			index += 1;
		}
		index -= 1;

		const rowCount = Math.max(deletes.length, inserts.length);
		for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
			rows.push({
				left: deletes[rowIndex],
				right: inserts[rowIndex],
			});
		}
	}

	return rows;
}

function createDiffCell(part: DiffPart | undefined, side: "left" | "right") {
	const cell = document.createElement("div");
	const tone =
		part?.type === "delete"
			? "bg-red-500/10 text-red-700 dark:text-red-300"
			: part?.type === "insert"
				? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
				: part
					? "text-75"
					: "bg-black/[0.02] text-30 dark:bg-white/[0.03]";
	cell.className = `grid min-w-0 grid-cols-[3.5rem_2rem_minmax(0,1fr)] font-mono text-sm leading-6 ${tone}`;

	const lineNo = document.createElement("span");
	lineNo.className =
		"select-none border-r border-black/5 px-2 py-1 text-right text-30 dark:border-white/5";
	lineNo.textContent = part
		? String(side === "left" ? part.leftLine || "" : part.rightLine || "")
		: "";

	const marker = document.createElement("span");
	marker.className =
		"select-none border-r border-black/5 px-2 py-1 text-center font-bold dark:border-white/5";
	marker.textContent =
		part?.type === "delete" ? "-" : part?.type === "insert" ? "+" : " ";

	const content = document.createElement("span");
	content.className = "min-w-0 whitespace-pre-wrap break-words px-3 py-1";
	content.textContent = part?.text || " ";

	cell.append(lineNo, marker, content);
	return cell;
}

function createSideBySideDiffRow(rowData: SideBySideDiffRow) {
	const row = document.createElement("div");
	row.className =
		"grid min-w-[48rem] grid-cols-2 border-b border-black/5 dark:border-white/5";
	row.append(
		createDiffCell(rowData.left, "left"),
		createDiffCell(rowData.right, "right"),
	);
	return row;
}

function createSideBySideDiffHeader() {
	const header = document.createElement("div");
	header.className =
		"sticky top-0 z-10 grid min-w-[48rem] grid-cols-2 border-b border-black/10 bg-[var(--card-bg)] text-sm font-bold text-75 dark:border-white/10";
	header.innerHTML = `
		<div class="grid grid-cols-[3.5rem_2rem_minmax(0,1fr)] border-r border-black/10 dark:border-white/10">
			<span class="px-2 py-2 text-right text-50">行</span>
			<span class="px-2 py-2 text-center text-50">-</span>
			<span class="px-3 py-2">原始内容</span>
		</div>
		<div class="grid grid-cols-[3.5rem_2rem_minmax(0,1fr)]">
			<span class="px-2 py-2 text-right text-50">行</span>
			<span class="px-2 py-2 text-center text-50">+</span>
			<span class="px-3 py-2">新内容</span>
		</div>
	`;
	return header;
}

function renderDiff(tool: HTMLElement) {
	const { leftText, rightText, diffOutput, summary } = getTextDiffParts(tool);
	if (!leftText || !rightText || !diffOutput) return;

	const leftValue = leftText.value;
	const rightValue = rightText.value;
	if (!leftValue && !rightValue) {
		diffOutput.innerHTML =
			'<p class="p-4 text-sm text-50">请选择两个文本文件，或在左右文本框中输入内容。</p>';
		if (summary) summary.textContent = "等待对比";
		setTextDiffStatus(tool, "请先选择或输入两份文本", true);
		return;
	}

	const leftLines = splitDiffLines(leftValue);
	const rightLines = splitDiffLines(rightValue);
	const parts = buildMyersDiff(leftLines, rightLines);
	const additions = parts.filter((part) => part.type === "insert").length;
	const deletions = parts.filter((part) => part.type === "delete").length;

	const rows = toSideBySideRows(parts);
	diffOutput.replaceChildren(
		createSideBySideDiffHeader(),
		...rows.map(createSideBySideDiffRow),
	);
	if (parts.length === 0) {
		diffOutput.innerHTML =
			'<p class="p-4 text-sm text-50">两个文件都是空内容，没有差异。</p>';
	}
	if (summary) {
		summary.textContent =
			additions === 0 && deletions === 0
				? "两个文本内容一致"
				: `新增 ${additions} 行，删除 ${deletions} 行`;
	}
	setTextDiffStatus(
		tool,
		additions === 0 && deletions === 0
			? "对比完成：没有差异"
			: "对比完成，已标出新增和删除行",
	);
}

function updateTextMeta(tool: HTMLElement, side: "left" | "right") {
	const parts = getTextDiffParts(tool);
	const text = side === "left" ? parts.leftText : parts.rightText;
	const meta = side === "left" ? parts.leftMeta : parts.rightMeta;
	if (!text || !meta) return;

	const lineCount = splitDiffLines(text.value).length;
	meta.textContent = `${lineCount} 行，${formatTextDiffBytes(new Blob([text.value]).size)}`;
}

async function readTextFile(tool: HTMLElement, input: HTMLInputElement) {
	const file = input.files?.[0];
	if (!file) return;

	const parts = getTextDiffParts(tool);
	const isLeft = input.matches("[data-left-file]");
	const targetText = isLeft ? parts.leftText : parts.rightText;
	const targetName = isLeft ? parts.leftName : parts.rightName;
	if (!targetText) return;

	try {
		targetText.value = await file.text();
		if (targetName) targetName.textContent = file.name;
		updateTextMeta(tool, isLeft ? "left" : "right");
		setTextDiffStatus(tool, "文件已读取，可以开始对比");
	} catch {
		setTextDiffStatus(tool, "文件读取失败，请确认文件编码或重新选择", true);
	}
}

function clearTextDiffTool(tool: HTMLElement) {
	const parts = getTextDiffParts(tool);
	if (parts.leftFile) parts.leftFile.value = "";
	if (parts.rightFile) parts.rightFile.value = "";
	if (parts.leftText) parts.leftText.value = "";
	if (parts.rightText) parts.rightText.value = "";
	if (parts.leftName) parts.leftName.textContent = "未选择文件";
	if (parts.rightName) parts.rightName.textContent = "未选择文件";
	if (parts.leftMeta) parts.leftMeta.textContent = "0 行，0 B";
	if (parts.rightMeta) parts.rightMeta.textContent = "0 行，0 B";
	if (parts.summary) parts.summary.textContent = "等待对比";
	if (parts.diffOutput) {
		parts.diffOutput.innerHTML =
			'<p class="p-4 text-sm text-50">对比结果会显示在这里，左侧为原始内容，右侧为新内容。</p>';
	}
	setTextDiffStatus(tool, "已清空");
}

function loadTextDiffSample(tool: HTMLElement) {
	const parts = getTextDiffParts(tool);
	if (!parts.leftText || !parts.rightText) return;

	parts.leftText.value = `function formatUser(user) {
  const name = user.name;
  return name.trim();
}

export default formatUser;`;
	parts.rightText.value = `function formatUser(user) {
  const name = user.displayName || user.name;
  const role = user.role || "member";
  return \`\${name.trim()} (\${role})\`;
}

export default formatUser;`;
	if (parts.leftName) parts.leftName.textContent = "before.txt";
	if (parts.rightName) parts.rightName.textContent = "after.txt";
	updateTextMeta(tool, "left");
	updateTextMeta(tool, "right");
	renderDiff(tool);
}

document.addEventListener("change", (event) => {
	const target = event.target;
	if (!(target instanceof HTMLInputElement)) return;

	const tool = target.closest<HTMLElement>("text-diff-tool");
	if (!tool) return;
	if (target.matches("[data-left-file], [data-right-file]")) {
		void readTextFile(tool, target);
	}
});

document.addEventListener("input", (event) => {
	const target = event.target;
	if (!(target instanceof HTMLTextAreaElement)) return;

	const tool = target.closest<HTMLElement>("text-diff-tool");
	if (!tool) return;
	if (target.matches("[data-left-text]")) updateTextMeta(tool, "left");
	if (target.matches("[data-right-text]")) updateTextMeta(tool, "right");
});

document.addEventListener("click", (event) => {
	const target = event.target;
	if (!(target instanceof Element)) return;

	const actionButton = target.closest<HTMLElement>(
		"text-diff-tool [data-action]",
	);
	const tool = actionButton?.closest<HTMLElement>("text-diff-tool");
	const action = actionButton?.dataset.action;
	if (!tool || !action) return;

	if (action === "compare") renderDiff(tool);
	if (action === "clear") clearTextDiffTool(tool);
	if (action === "sample") loadTextDiffSample(tool);
});
