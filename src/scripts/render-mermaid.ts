import type mermaid from "mermaid";

declare global {
	interface Window {
		swup?: {
			hooks?: {
				on: (event: string, callback: () => void) => void;
			};
		};
		__krisMermaidReady?: boolean;
	}
}

const MERMAID_RENDERED = "mermaidRendered";
let renderIndex = 0;
let mermaidApi: typeof mermaid | undefined;

async function getMermaid() {
	if (mermaidApi) return mermaidApi;

	const module = await import("mermaid");
	mermaidApi = module.default;
	mermaidApi.initialize({
		startOnLoad: false,
		securityLevel: "strict",
		theme: "base",
		themeVariables: {
			fontFamily:
				"Roboto, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
			primaryColor: "#eaf6ff",
			primaryTextColor: "#1f2937",
			primaryBorderColor: "#7bb8d9",
			lineColor: "#6f8fa6",
			secondaryColor: "#fff7db",
			tertiaryColor: "#f2edff",
			clusterBkg: "#f8fbff",
			clusterBorder: "#c9d7e3",
			noteBkgColor: "#fff7db",
			noteTextColor: "#1f2937",
		},
	});

	return mermaidApi;
}

function getCodeSource(pre: HTMLPreElement): string {
	const expressiveLines = pre.querySelectorAll<HTMLElement>(".ec-line > .code");
	if (expressiveLines.length > 0) {
		return Array.from(expressiveLines)
			.map((line) => line.textContent ?? "")
			.join("\n")
			.trim();
	}

	return (pre.querySelector("code")?.textContent ?? pre.textContent ?? "").trim();
}

function findMermaidBlocks(): HTMLPreElement[] {
	const blocks = new Set<HTMLPreElement>();

	document
		.querySelectorAll<HTMLPreElement>('pre[data-language="mermaid"]')
		.forEach((pre) => blocks.add(pre));

	document
		.querySelectorAll<HTMLElement>("code.language-mermaid")
		.forEach((code) => {
			const pre = code.closest("pre");
			if (pre instanceof HTMLPreElement) {
				blocks.add(pre);
			}
		});

	return Array.from(blocks);
}

async function renderMermaidBlocks() {
	const blocks = findMermaidBlocks();
	if (blocks.length === 0) return;

	const mermaidRenderer = await getMermaid();

	for (const pre of blocks) {
		const replaceTarget = pre.closest(".expressive-code") ?? pre;
		if (replaceTarget instanceof HTMLElement && replaceTarget.dataset[MERMAID_RENDERED]) {
			continue;
		}

		const source = getCodeSource(pre);
		if (!source) continue;

		const wrapper = document.createElement("div");
		wrapper.className = "mermaid-rendered";
		wrapper.dataset[MERMAID_RENDERED] = "true";

		try {
			const id = `kris-mermaid-${Date.now()}-${renderIndex++}`;
			const { svg } = await mermaidRenderer.render(id, source);
			wrapper.innerHTML = svg;
		} catch (error) {
			wrapper.classList.add("mermaid-rendered-error");
			wrapper.textContent = "Mermaid diagram render failed. Please check the diagram syntax.";
			console.error("Failed to render Mermaid diagram:", error);
		}

		replaceTarget.replaceWith(wrapper);
	}
}

function setupMermaidRenderer() {
	renderMermaidBlocks();

	if (window.swup?.hooks) {
		window.swup.hooks.on("page:view", () => {
			window.setTimeout(renderMermaidBlocks, 0);
		});
	} else {
		document.addEventListener(
			"swup:enable",
			() => {
				window.swup?.hooks?.on("page:view", () => {
					window.setTimeout(renderMermaidBlocks, 0);
				});
			},
			{ once: true },
		);
	}
}

if (!window.__krisMermaidReady) {
	window.__krisMermaidReady = true;

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", setupMermaidRenderer, { once: true });
	} else {
		setupMermaidRenderer();
	}
}
