import { fairyDustCursor, type CursorEffectResult } from "cursor-effects";

declare global {
	interface Window {
		__krisCursorEffect?: CursorEffectResult;
	}
}

function setupCursorEffect() {
	const finePointer = window.matchMedia("(pointer: fine)").matches;
	const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (!finePointer || reducedMotion) return;

	window.__krisCursorEffect?.destroy();
	window.__krisCursorEffect = fairyDustCursor({
		colors: ["#f8d66d", "#84d8ff", "#c7a3ff"],
	});

	for (const canvas of document.body.querySelectorAll<HTMLCanvasElement>("canvas")) {
		if (canvas.style.pointerEvents === "none" && canvas.style.position === "fixed") {
			canvas.style.zIndex = "2147483647";
			canvas.style.opacity = "0.45";
		}
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", setupCursorEffect, { once: true });
} else {
	setupCursorEffect();
}
