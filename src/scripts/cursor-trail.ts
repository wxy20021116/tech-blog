const finePointer = window.matchMedia("(pointer: fine)").matches;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (finePointer && !reducedMotion) {
	const dot = document.createElement("div");
	const ring = document.createElement("div");
	dot.className = "cursor-dot";
	ring.className = "cursor-ring";
	document.body.append(dot, ring);

	let x = window.innerWidth / 2;
	let y = window.innerHeight / 2;
	let ringX = x;
	let ringY = y;
	let lastMeteor = 0;

	const interactiveSelector = "a, button, [role='button'], input, textarea, select, summary, .btn-plain, .btn-regular, .btn-card";

	function moveCursor(event: MouseEvent) {
		x = event.clientX;
		y = event.clientY;
		dot.style.transform = `translate3d(${x - 3.5}px, ${y - 3.5}px, 0)`;

		const target = event.target;
		if (target instanceof Element && target.closest(interactiveSelector)) {
			ring.classList.add("is-hovering");
		} else {
			ring.classList.remove("is-hovering");
		}

		const now = performance.now();
		if (now - lastMeteor > 34) {
			lastMeteor = now;
			spawnMeteor(x, y);
		}
	}

	function spawnMeteor(clientX: number, clientY: number) {
		const meteor = document.createElement("span");
		meteor.className = "cursor-meteor";
		const offsetX = (Math.random() - 0.5) * 12;
		const offsetY = (Math.random() - 0.5) * 12;
		meteor.style.transform = `translate3d(${clientX + offsetX - 4}px, ${clientY + offsetY - 4}px, 0) scale(${0.7 + Math.random() * 0.45})`;
		document.body.appendChild(meteor);
		window.setTimeout(() => meteor.remove(), 760);
	}

	function renderRing() {
		ringX += (x - ringX) * 0.18;
		ringY += (y - ringY) * 0.18;
		const size = ring.classList.contains("is-hovering") ? 46 : 34;
		ring.style.transform = `translate3d(${ringX - size / 2}px, ${ringY - size / 2}px, 0)`;
		requestAnimationFrame(renderRing);
	}

	function hideCursor() {
		dot.style.opacity = "0";
		ring.style.opacity = "0";
	}

	function showCursor() {
		dot.style.opacity = "1";
		ring.style.opacity = "1";
	}

	window.addEventListener("mousemove", moveCursor, { passive: true });
	document.addEventListener("mouseleave", hideCursor);
	document.addEventListener("mouseenter", showCursor);
	renderRing();
}
