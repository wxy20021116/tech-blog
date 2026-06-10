import MarkdownIt from "markdown-it";

const markdownParser = new MarkdownIt({
	html: true,
	linkify: true,
	typographer: true,
	breaks: false,
});

const ALLOWED_TAGS = new Set([
	"a",
	"blockquote",
	"br",
	"code",
	"del",
	"em",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"hr",
	"img",
	"li",
	"ol",
	"p",
	"pre",
	"strong",
	"table",
	"tbody",
	"td",
	"th",
	"thead",
	"tr",
	"ul",
]);
const GLOBAL_ALLOWED_ATTRIBUTES = new Set(["class"]);
const TAG_ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
	a: new Set(["href", "name", "target", "rel", "title"]),
	img: new Set(["src", "alt", "title", "width", "height"]),
};
const SAFE_URL_PATTERN = /^(https?:|mailto:|tel:|data:image\/)/i;

function getMarkdownToolParts(tool: HTMLElement) {
	return {
		input: tool.querySelector<HTMLTextAreaElement>("[data-input]"),
		output: tool.querySelector<HTMLTextAreaElement>("[data-output]"),
		preview: tool.querySelector<HTMLElement>("[data-preview]"),
		status: tool.querySelector<HTMLElement>("[data-status]"),
	};
}

function setMarkdownStatus(
	tool: HTMLElement,
	message: string,
	isError = false,
) {
	const { status } = getMarkdownToolParts(tool);
	if (!status) return;
	status.textContent = message;
	status.classList.toggle("text-[var(--primary)]", !isError);
	status.classList.toggle("text-red-500", isError);
}

function sanitizePreview(html: string) {
	const template = document.createElement("template");
	template.innerHTML = html;

	for (const element of Array.from(template.content.querySelectorAll("*"))) {
		const tagName = element.tagName.toLowerCase();
		if (!ALLOWED_TAGS.has(tagName)) {
			element.replaceWith(...Array.from(element.childNodes));
			continue;
		}

		for (const attribute of Array.from(element.attributes)) {
			const name = attribute.name.toLowerCase();
			const allowedForTag = TAG_ALLOWED_ATTRIBUTES[tagName];
			const isAllowed =
				GLOBAL_ALLOWED_ATTRIBUTES.has(name) || allowedForTag?.has(name);
			const isUrlAttribute = name === "href" || name === "src";
			if (
				!isAllowed ||
				(isUrlAttribute && !SAFE_URL_PATTERN.test(attribute.value))
			) {
				element.removeAttribute(attribute.name);
			}
		}

		if (tagName === "a") {
			element.setAttribute("target", "_blank");
			element.setAttribute("rel", "noopener noreferrer");
		}
	}

	return template.innerHTML;
}

function renderMarkdown(tool: HTMLElement) {
	const { input, output, preview } = getMarkdownToolParts(tool);
	if (!input || !output || !preview) return;
	if (!input.value.trim()) {
		output.value = "";
		preview.innerHTML = '<p class="text-50">转换后将在这里显示预览。</p>';
		setMarkdownStatus(tool, "请先输入 Markdown 内容", true);
		return;
	}

	const html = markdownParser.render(input.value);
	output.value = html.trim();
	preview.innerHTML = sanitizePreview(html);
	setMarkdownStatus(tool, "Markdown 转 HTML 完成");
}

async function copyMarkdownHtml(tool: HTMLElement) {
	const { output } = getMarkdownToolParts(tool);
	if (!output?.value) {
		setMarkdownStatus(tool, "没有可复制的 HTML", true);
		return;
	}

	try {
		await navigator.clipboard.writeText(output.value);
		setMarkdownStatus(tool, "HTML 已复制");
	} catch {
		setMarkdownStatus(tool, "复制失败，请手动选中 HTML 源码复制", true);
	}
}

function clearMarkdownTool(tool: HTMLElement) {
	const { input, output, preview } = getMarkdownToolParts(tool);
	if (input) input.value = "";
	if (output) output.value = "";
	if (preview)
		preview.innerHTML = '<p class="text-50">转换后将在这里显示预览。</p>';
	setMarkdownStatus(tool, "已清空");
}

function loadMarkdownSample(tool: HTMLElement) {
	const { input } = getMarkdownToolParts(tool);
	if (!input) return;
	input.value = `# Markdown 转 HTML 示例

这是一段 **Markdown** 文本，支持中文、链接和代码。

## 功能列表

- 标题和段落
- **加粗**、*斜体*、\`行内代码\`
- 表格和代码块

| 工具 | 状态 |
| --- | --- |
| JSON 格式化 | 可用 |
| Markdown 转 HTML | 开发中 |

\`\`\`js
console.log("Hello Markdown");
\`\`\`

[访问博客](https://blog.hiauto.me/)`;
	renderMarkdown(tool);
}

document.addEventListener("click", (event) => {
	const target = event.target;
	if (!(target instanceof Element)) return;

	const actionButton = target.closest<HTMLElement>(
		"markdown-html-tool [data-action]",
	);
	const tool = actionButton?.closest<HTMLElement>("markdown-html-tool");
	const action = actionButton?.dataset.action;
	if (!tool || !action) return;

	if (action === "convert") renderMarkdown(tool);
	if (action === "copy") void copyMarkdownHtml(tool);
	if (action === "clear") clearMarkdownTool(tool);
	if (action === "sample") loadMarkdownSample(tool);
});
