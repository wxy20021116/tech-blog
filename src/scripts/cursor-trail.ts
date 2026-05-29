const finePointer = window.matchMedia("(pointer: fine)").matches;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (finePointer && !reducedMotion) {
	const wand = document.createElement("div");
	const ring = document.createElement("div");
	wand.className = "cursor-wand";
	ring.className = "cursor-ring";
	document.body.append(wand, ring);

	let x = window.innerWidth / 2;
	let y = window.innerHeight / 2;
	let ringX = x;
	let ringY = y;
	let lastMeteor = 0;

	const interactiveSelector = "a, button, [role='button'], input, textarea, select, summary, .btn-plain, .btn-regular, .btn-card";

	function moveCursor(event: MouseEvent) {
		x = event.clientX;
		y = event.clientY;
		wand.style.transform = `translate3d(${x - 16}px, ${y - 12}px, 0) rotate(-28deg)`;

		const target = event.target;
		if (target instanceof Element && target.closest(interactiveSelector)) {
			ring.classList.add("is-hovering");
		} else {
			ring.classList.remove("is-hovering");
		}

		const now = performance.now();
		if (now - lastMeteor > 34) {
			lastMeteor = now;
			spawnStar(x, y);
		}
	}

	function spawnStar(clientX: number, clientY: number) {
		const star = document.createElement("span");
		star.className = "cursor-star";
		star.textContent = Math.random() > 0.5 ? "✦" : "✧";
		const offsetX = (Math.random() - 0.5) * 18;
		const offsetY = (Math.random() - 0.5) * 18;
		const driftX = `${(Math.random() - 0.5) * 34}px`;
		const driftY = `${18 + Math.random() * 22}px`;
		star.style.setProperty("--star-x", `${clientX + offsetX - 8}px`);
		star.style.setProperty("--star-y", `${clientY + offsetY - 8}px`);
		star.style.setProperty("--star-dx", driftX);
		star.style.setProperty("--star-dy", driftY);
		document.body.appendChild(star);
		window.setTimeout(() => star.remove(), 860);
	}

	function renderRing() {
		ringX += (x - ringX) * 0.18;
		ringY += (y - ringY) * 0.18;
		const size = ring.classList.contains("is-hovering") ? 46 : 34;
		ring.style.transform = `translate3d(${ringX - size / 2}px, ${ringY - size / 2}px, 0)`;
		requestAnimationFrame(renderRing);
	}

	function hideCursor() {
		wand.style.opacity = "0";
		ring.style.opacity = "0";
	}

	function showCursor() {
		wand.style.opacity = "1";
		ring.style.opacity = "1";
	}

	window.addEventListener("mousemove", moveCursor, { passive: true });
	document.addEventListener("mouseleave", hideCursor);
	document.addEventListener("mouseenter", showCursor);
	renderRing();
}
