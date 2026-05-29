import { characterCursor, type CursorEffectResult } from "cursor-effects";

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
	window.__krisCursorEffect = characterCursor({
		characters: ["✦", "✧", "★"],
		colors: ["#f8d66d", "#84d8ff", "#c7a3ff", "#ffffff"],
		font: "16px serif",
		characterLifeSpanFunction: () => Math.floor(Math.random() * 28 + 44),
		initialCharacterVelocityFunction: () => ({
			x: (Math.random() - 0.5) * 1.4,
			y: Math.random() * 0.6 + 0.4,
		}),
		characterScalingFunction: (age, lifeSpan) => Math.max((lifeSpan - age) / lifeSpan, 0),
		characterNewRotationDegreesFunction: (age, lifeSpan) => (lifeSpan - age) * 4,
	});

	for (const canvas of document.body.querySelectorAll<HTMLCanvasElement>("canvas")) {
		if (canvas.style.pointerEvents === "none" && canvas.style.position === "fixed") {
			canvas.style.zIndex = "2147483647";
		}
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", setupCursorEffect, { once: true });
} else {
	setupCursorEffect();
}
