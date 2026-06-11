function buildMask(maskData) {
	const mask = new Uint8Array(maskData.width * maskData.height);
	for (let i = 0, p = 0; i < maskData.data.length; i += 4, p++) {
		mask[p] = maskData.data[i + 3] > 0 ? 1 : 0;
	}
	return mask;
}

function expandMask(mask, width, height, radius) {
	const expanded = new Uint8Array(mask);
	const passes = Math.max(0, Math.min(4, Math.floor(radius / 4)));
	for (let pass = 0; pass < passes; pass++) {
		const snapshot = new Uint8Array(expanded);
		for (let y = 1; y < height - 1; y++) {
			for (let x = 1; x < width - 1; x++) {
				const p = y * width + x;
				if (!snapshot[p]) continue;
				expanded[p - 1] = 1;
				expanded[p + 1] = 1;
				expanded[p - width] = 1;
				expanded[p + width] = 1;
			}
		}
	}
	return expanded;
}

function fillMaskedPixels(data, mask, width, height) {
	const known = new Uint8Array(mask.length);
	const pending = new Uint8Array(mask.length);
	const queue = [];
	let head = 0;

	for (let p = 0; p < mask.length; p++) {
		if (!mask[p]) known[p] = 1;
	}

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const p = y * width + x;
			if (!mask[p]) continue;
			let touchesKnown = false;
			for (let dy = -1; dy <= 1 && !touchesKnown; dy++) {
				for (let dx = -1; dx <= 1; dx++) {
					if (dx === 0 && dy === 0) continue;
					const nx = x + dx;
					const ny = y + dy;
					if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
					if (known[ny * width + nx]) {
						touchesKnown = true;
						break;
					}
				}
			}
			if (touchesKnown) {
				pending[p] = 1;
				queue.push(p);
			}
		}
	}

	while (head < queue.length) {
		const p = queue[head++];
		if (known[p]) continue;
		const x = p % width;
		const y = Math.floor(p / width);
		let totalWeight = 0;
		let r = 0;
		let g = 0;
		let b = 0;
		let a = 0;

		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				if (dx === 0 && dy === 0) continue;
				const nx = x + dx;
				const ny = y + dy;
				if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
				const np = ny * width + nx;
				if (!known[np]) continue;
				const weight = dx === 0 || dy === 0 ? 1 : 0.7;
				const index = np * 4;
				r += data[index] * weight;
				g += data[index + 1] * weight;
				b += data[index + 2] * weight;
				a += data[index + 3] * weight;
				totalWeight += weight;
			}
		}

		if (totalWeight > 0) {
			const index = p * 4;
			data[index] = Math.round(r / totalWeight);
			data[index + 1] = Math.round(g / totalWeight);
			data[index + 2] = Math.round(b / totalWeight);
			data[index + 3] = Math.round(a / totalWeight);
			known[p] = 1;
		}

		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				if (dx === 0 && dy === 0) continue;
				const nx = x + dx;
				const ny = y + dy;
				if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
				const np = ny * width + nx;
				if (mask[np] && !known[np] && !pending[np]) {
					pending[np] = 1;
					queue.push(np);
				}
			}
		}
	}
}

function smoothMaskedPixels(data, mask, width, height, rounds) {
	for (let round = 0; round < rounds; round++) {
		const snapshot = new Uint8ClampedArray(data);
		for (let y = 1; y < height - 1; y++) {
			for (let x = 1; x < width - 1; x++) {
				const p = y * width + x;
				if (!mask[p]) continue;
				let totalWeight = 0;
				let r = 0;
				let g = 0;
				let b = 0;
				for (let dy = -1; dy <= 1; dy++) {
					for (let dx = -1; dx <= 1; dx++) {
						const np = (y + dy) * width + x + dx;
						const weight = dx === 0 && dy === 0 ? 2 : 1;
						const index = np * 4;
						r += snapshot[index] * weight;
						g += snapshot[index + 1] * weight;
						b += snapshot[index + 2] * weight;
						totalWeight += weight;
					}
				}
				const index = p * 4;
				data[index] = Math.round(r / totalWeight);
				data[index + 1] = Math.round(g / totalWeight);
				data[index + 2] = Math.round(b / totalWeight);
			}
		}
	}
}

self.onmessage = (event) => {
	const { id, imageData, maskData, radius, algorithm } = event.data;

	try {
		const output = new ImageData(
			new Uint8ClampedArray(imageData.data),
			imageData.width,
			imageData.height,
		);
		const mask = expandMask(
			buildMask(maskData),
			imageData.width,
			imageData.height,
			Number(radius) || 3,
		);

		fillMaskedPixels(output.data, mask, output.width, output.height);
		smoothMaskedPixels(
			output.data,
			mask,
			output.width,
			output.height,
			algorithm === "ns" ? 2 : 1,
		);

		self.postMessage({ id, imageData: output }, [output.data.buffer]);
	} catch (error) {
		self.postMessage({
			id,
			error: error instanceof Error ? error.message : "图片还原失败",
		});
	}
};
