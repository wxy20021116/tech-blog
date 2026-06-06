import { backgroundConfig } from "../config";

// 动态背景: one fixed, full-screen canvas drawn behind the site content.
//
// It is appended to <body> (outside the Swup containers `main` / `#toc`), so a
// single instance persists across in-site navigations — no per-page re-init.
// The palette tracks the site `--hue` and the light/dark class on <html>.
//
// NOTE: the canvas is positioned via a stylesheet class, NOT inline styles.
// `cursor-effects.ts` scans for canvases whose *inline* style is
// `position: fixed; pointer-events: none` and force-promotes them to the top
// z-index — keeping our positioning in a class side-steps that and lets the
// background stay behind everything.

type Mode = "particles" | "stars" | "sakura";

interface BackgroundController {
	destroy(): void;
}

declare global {
	interface Window {
		__krisBackground?: BackgroundController;
	}
}

interface Dot {
	x: number;
	y: number;
	vx: number;
	vy: number;
	r: number;
	/** twinkle phase (stars) / spin phase (sakura) */
	phase: number;
	/** rotation in radians (sakura) */
	angle: number;
}

interface Palette {
	dot: string;
	/** [h, s, l] for connecting lines, alpha applied per pair */
	lineHSL: [number, number, number];
	petals: string[];
}

const STYLE_ID = "kris-bg-style";
const TWO_PI = Math.PI * 2;
const LINK_DISTANCE = 130;

function readHue(): number {
	const raw = getComputedStyle(document.documentElement)
		.getPropertyValue("--hue")
		.trim();
	const n = Number.parseFloat(raw);
	return Number.isFinite(n) ? n : 200;
}

function isDark(): boolean {
	return document.documentElement.classList.contains("dark");
}

function buildPalette(mode: Mode, hue: number, dark: boolean): Palette {
	if (mode === "sakura") {
		// Petals keep their pink identity in both themes; only opacity shifts.
		const a = dark ? 0.55 : 0.7;
		return {
			dot: `hsla(335, 75%, 80%, ${a})`,
			lineHSL: [335, 75, 80],
			petals: dark
				? [
						`hsla(335, 60%, 78%, ${a})`,
						`hsla(350, 65%, 82%, ${a})`,
						`hsla(320, 55%, 80%, ${a})`,
					]
				: [
						`hsla(335, 80%, 80%, ${a})`,
						`hsla(350, 85%, 85%, ${a})`,
						`hsla(320, 70%, 82%, ${a})`,
					],
		};
	}
	// particles + stars: tint with the site hue, adapt lightness to the theme.
	if (dark) {
		return { dot: `hsla(${hue}, 70%, 78%, 0.65)`, lineHSL: [hue, 70, 72], petals: [] };
	}
	return { dot: `hsla(${hue}, 65%, 42%, 0.6)`, lineHSL: [hue, 60, 45], petals: [] };
}

function setupBackground(): void {
	const { enable, opacity, density } = backgroundConfig;
	const mode = backgroundConfig.mode as Mode;
	if (!enable) return;

	// Re-init safety (e.g. dev HMR): tear down any previous instance first.
	window.__krisBackground?.destroy();

	const reducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;

	if (!document.getElementById(STYLE_ID)) {
		const style = document.createElement("style");
		style.id = STYLE_ID;
		style.textContent =
			".kris-bg-canvas{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;}";
		document.head.appendChild(style);
	}

	const canvas = document.createElement("canvas");
	canvas.className = "kris-bg-canvas";
	canvas.setAttribute("aria-hidden", "true");
	canvas.style.opacity = String(opacity);
	document.body.insertBefore(canvas, document.body.firstChild);

	const ctx2d = canvas.getContext("2d");
	if (!ctx2d) {
		canvas.remove();
		return;
	}
	const ctx = ctx2d; // non-null binding captured by the render closures

	let width = 0;
	let height = 0;
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	let dots: Dot[] = [];
	let palette = buildPalette(mode, readHue(), isDark());
	let rafId = 0;
	let running = false;

	function count(): number {
		const area = width * height;
		const base =
			mode === "sakura"
				? area / 22000
				: mode === "stars"
					? area / 9000
					: area / 14000;
		const cap = mode === "sakura" ? 70 : mode === "stars" ? 220 : 120;
		return Math.min(cap, Math.round(base * density));
	}

	function makeDot(seedY?: number): Dot {
		if (mode === "sakura") {
			return {
				x: Math.random() * width,
				y: seedY ?? Math.random() * height,
				vx: -0.4 - Math.random() * 0.6, // drift left as it falls
				vy: 0.6 + Math.random() * 1.1,
				r: 4 + Math.random() * 5,
				phase: Math.random() * TWO_PI,
				angle: Math.random() * TWO_PI,
			};
		}
		if (mode === "stars") {
			return {
				x: Math.random() * width,
				y: Math.random() * height,
				vx: (Math.random() - 0.5) * 0.12,
				vy: (Math.random() - 0.5) * 0.12,
				r: 0.6 + Math.random() * 1.4,
				phase: Math.random() * TWO_PI,
				angle: 0,
			};
		}
		// particles
		return {
			x: Math.random() * width,
			y: Math.random() * height,
			vx: (Math.random() - 0.5) * 0.5,
			vy: (Math.random() - 0.5) * 0.5,
			r: 1.4 + Math.random() * 1.6,
			phase: 0,
			angle: 0,
		};
	}

	function seed(): void {
		dots = Array.from({ length: count() }, () => makeDot());
	}

	function resize(): void {
		width = window.innerWidth;
		height = window.innerHeight;
		canvas.width = Math.floor(width * dpr);
		canvas.height = Math.floor(height * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		seed();
	}

	function drawParticles(): void {
		for (const p of dots) {
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.r, 0, TWO_PI);
			ctx.fillStyle = palette.dot;
			ctx.fill();
		}
		const [h, s, l] = palette.lineHSL;
		for (let i = 0; i < dots.length; i++) {
			for (let j = i + 1; j < dots.length; j++) {
				const dx = dots[i].x - dots[j].x;
				const dy = dots[i].y - dots[j].y;
				const dist = Math.hypot(dx, dy);
				if (dist >= LINK_DISTANCE) continue;
				const alpha = (1 - dist / LINK_DISTANCE) * 0.5;
				ctx.beginPath();
				ctx.strokeStyle = `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
				ctx.lineWidth = 1;
				ctx.moveTo(dots[i].x, dots[i].y);
				ctx.lineTo(dots[j].x, dots[j].y);
				ctx.stroke();
			}
		}
	}

	function drawStars(): void {
		for (const p of dots) {
			const twinkle = 0.5 + 0.5 * Math.sin(p.phase);
			ctx.globalAlpha = twinkle;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.r, 0, TWO_PI);
			ctx.fillStyle = palette.dot;
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	function drawSakura(): void {
		for (let i = 0; i < dots.length; i++) {
			const p = dots[i];
			ctx.save();
			ctx.translate(p.x, p.y);
			ctx.rotate(p.angle);
			ctx.fillStyle = palette.petals[i % palette.petals.length];
			// a simple petal: an ellipse with a small notch feel via scale
			ctx.beginPath();
			ctx.ellipse(0, 0, p.r, p.r * 0.6, 0, 0, TWO_PI);
			ctx.fill();
			ctx.restore();
		}
	}

	function step(): void {
		if (mode === "sakura") {
			for (const p of dots) {
				p.phase += 0.02;
				p.x += p.vx + Math.sin(p.phase) * 0.4;
				p.y += p.vy;
				p.angle += 0.01;
				if (p.y - p.r > height || p.x + p.r < 0) {
					p.x = Math.random() * width + width * 0.2;
					p.y = -p.r - Math.random() * 40;
				}
			}
			return;
		}
		if (mode === "stars") {
			for (const p of dots) {
				p.phase += 0.02 + p.r * 0.004;
				p.x += p.vx;
				p.y += p.vy;
				if (p.x < 0) p.x = width;
				else if (p.x > width) p.x = 0;
				if (p.y < 0) p.y = height;
				else if (p.y > height) p.y = 0;
			}
			return;
		}
		// particles
		for (const p of dots) {
			p.x += p.vx;
			p.y += p.vy;
			if (p.x < 0 || p.x > width) p.vx *= -1;
			if (p.y < 0 || p.y > height) p.vy *= -1;
		}
	}

	function render(): void {
		ctx.clearRect(0, 0, width, height);
		if (mode === "stars") drawStars();
		else if (mode === "sakura") drawSakura();
		else drawParticles();
	}

	function frame(): void {
		step();
		render();
		rafId = window.requestAnimationFrame(frame);
	}

	function start(): void {
		if (running || reducedMotion) return;
		running = true;
		rafId = window.requestAnimationFrame(frame);
	}

	function stop(): void {
		running = false;
		if (rafId) window.cancelAnimationFrame(rafId);
		rafId = 0;
	}

	function refreshPalette(): void {
		palette = buildPalette(mode, readHue(), isDark());
		if (reducedMotion) render(); // keep the static frame in sync with the theme
	}

	function onVisibility(): void {
		if (document.hidden) stop();
		else start();
	}

	let resizeTimer = 0;
	function onResize(): void {
		window.clearTimeout(resizeTimer);
		resizeTimer = window.setTimeout(() => {
			resize();
			if (reducedMotion) render();
		}, 200);
	}

	const themeObserver = new MutationObserver(refreshPalette);
	themeObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class", "style"],
	});

	window.addEventListener("resize", onResize);
	document.addEventListener("visibilitychange", onVisibility);

	resize();
	if (reducedMotion) {
		render(); // one static frame, honoring the user's motion preference
	} else {
		start();
	}

	window.__krisBackground = {
		destroy() {
			stop();
			window.clearTimeout(resizeTimer);
			themeObserver.disconnect();
			window.removeEventListener("resize", onResize);
			document.removeEventListener("visibilitychange", onVisibility);
			canvas.remove();
			window.__krisBackground = undefined;
		},
	};
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", setupBackground, { once: true });
} else {
	setupBackground();
}
