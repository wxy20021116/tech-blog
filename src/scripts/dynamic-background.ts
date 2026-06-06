import { tsParticles, type Container, type ISourceOptions } from "@tsparticles/engine";
import { loadSlim } from "@tsparticles/slim";
import { backgroundConfig } from "../config";

const ROOT_ID = "kris-particles-bg";
const STYLE_ID = "kris-particles-bg-style";

declare global {
	interface Window {
		__krisParticlesBackground?: {
			configKey: string;
			container?: Container;
			themeObserver?: MutationObserver;
		};
	}
}

function readHue(): number {
	const raw = getComputedStyle(document.documentElement)
		.getPropertyValue("--hue")
		.trim();
	const hue = Number.parseFloat(raw);
	return Number.isFinite(hue) ? hue : 200;
}

function isDark(): boolean {
	return document.documentElement.classList.contains("dark");
}

function colorSet(): { particle: string; link: string } {
	const hue = readHue();
	if (isDark()) {
		return {
			particle: `hsl(${hue}, 72%, 78%)`,
			link: `hsl(${hue}, 70%, 72%)`,
		};
	}

	return {
		particle: `hsl(${hue}, 68%, 44%)`,
		link: `hsl(${hue}, 62%, 48%)`,
	};
}

function particleCount(): number {
	const density = Math.max(0.2, backgroundConfig.density);
	return Math.round(110 * density);
}

function options(): ISourceOptions {
	const colors = colorSet();

	return {
		autoPlay: true,
		background: {
			color: {
				value: "transparent",
			},
		},
		detectRetina: true,
		fpsLimit: 60,
		fullScreen: {
			enable: false,
		},
		interactivity: {
			detectsOn: "window",
			events: {
				onHover: {
					enable: true,
					mode: ["grab", "bubble"],
				},
				resize: {
					enable: true,
				},
			},
			modes: {
				bubble: {
					distance: 180,
					duration: 2,
					opacity: 0.85,
					size: 5,
				},
				grab: {
					distance: 170,
					links: {
						opacity: 0.4,
					},
				},
			},
		},
		particles: {
			color: {
				value: colors.particle,
			},
			links: {
				color: colors.link,
				distance: 145,
				enable: true,
				opacity: isDark() ? 0.34 : 0.3,
				width: 1,
			},
			move: {
				direction: "none",
				enable: true,
				outModes: {
					default: "bounce",
				},
				random: false,
				speed: 0.45,
				straight: false,
			},
			number: {
				density: {
					enable: true,
				},
				value: particleCount(),
			},
			opacity: {
				value: {
					min: 0.35,
					max: 0.78,
				},
			},
			shape: {
				type: "circle",
			},
			size: {
				value: {
					min: 1.4,
					max: 3.2,
				},
			},
		},
		pauseOnBlur: true,
		pauseOnOutsideViewport: true,
	};
}

function ensureStyle(): void {
	if (document.getElementById(STYLE_ID)) return;

	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = `
		#${ROOT_ID} {
			position: fixed;
			inset: 0;
			width: 100%;
			height: 100%;
			opacity: ${backgroundConfig.opacity};
			pointer-events: none;
			z-index: 1;
		}
		#${ROOT_ID} canvas {
			pointer-events: none !important;
		}
	`;
	document.head.appendChild(style);
}

function ensureRoot(): HTMLElement {
	let root = document.getElementById(ROOT_ID);
	if (!root) {
		root = document.createElement("div");
		root.id = ROOT_ID;
		root.setAttribute("aria-hidden", "true");
		document.body.insertBefore(root, document.body.firstChild);
	}

	root.style.opacity = String(backgroundConfig.opacity);
	return root;
}

async function setupBackground(): Promise<void> {
	if (!backgroundConfig.enable) {
		window.__krisParticlesBackground?.container?.destroy();
		window.__krisParticlesBackground = undefined;
		document.getElementById(ROOT_ID)?.remove();
		return;
	}

	const configKey = JSON.stringify({
		dark: isDark(),
		density: backgroundConfig.density,
		hue: readHue(),
	});
	const current = window.__krisParticlesBackground;
	if (current?.configKey === configKey && current.container) {
		ensureRoot();
		return;
	}

	ensureStyle();
	ensureRoot();
	await loadSlim(tsParticles);
	current?.container?.destroy();
	const container = await tsParticles.load({
		id: ROOT_ID,
		options: options(),
	});

	window.__krisParticlesBackground = {
		configKey,
		container,
		themeObserver: current?.themeObserver,
	};
}

function scheduleSetup(): void {
	window.requestAnimationFrame(() => {
		setupBackground().catch((error) => {
			console.error("Failed to initialize tsParticles background:", error);
		});
	});
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", scheduleSetup, { once: true });
} else {
	scheduleSetup();
}

if (!window.__krisParticlesBackground?.themeObserver) {
	const themeObserver = new MutationObserver(scheduleSetup);
	themeObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class", "style"],
	});
	window.__krisParticlesBackground = {
		configKey: "",
		...window.__krisParticlesBackground,
		themeObserver,
	};
}
