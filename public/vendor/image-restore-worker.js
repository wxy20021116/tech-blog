let cvReadyPromise;

function waitForOpenCv() {
	if (self.cv?.Mat && self.cv?.inpaint && self.cv?.matFromImageData) {
		return Promise.resolve(self.cv);
	}
	if (cvReadyPromise) return cvReadyPromise;

	cvReadyPromise = new Promise((resolve, reject) => {
		const startedAt = Date.now();
		const timer = setInterval(() => {
			if (self.cv?.Mat && self.cv?.inpaint && self.cv?.matFromImageData) {
				clearInterval(timer);
				resolve(self.cv);
				return;
			}
			if (Date.now() - startedAt > 20000) {
				clearInterval(timer);
				reject(new Error("OpenCV 初始化超时，请刷新页面后重试"));
			}
		}, 80);
	});

	return cvReadyPromise;
}

async function loadOpenCv() {
	if (!self.cv) importScripts("/vendor/opencv.js");
	return waitForOpenCv();
}

self.onmessage = async (event) => {
	const { id, imageData, maskData, radius, algorithm } = event.data;
	let srcRgba;
	let src;
	let maskRgba;
	let mask;
	let dst;
	let outputRgba;

	try {
		const cv = await loadOpenCv();
		srcRgba = cv.matFromImageData(imageData);
		src = new cv.Mat();
		maskRgba = cv.matFromImageData(maskData);
		mask = new cv.Mat();
		dst = new cv.Mat();
		outputRgba = new cv.Mat();

		cv.cvtColor(srcRgba, src, cv.COLOR_RGBA2RGB);
		cv.cvtColor(maskRgba, mask, cv.COLOR_RGBA2GRAY);
		cv.inpaint(
			src,
			mask,
			dst,
			Math.max(1, Math.min(20, Number(radius) || 3)),
			algorithm === "ns" ? cv.INPAINT_NS : cv.INPAINT_TELEA,
		);
		cv.cvtColor(dst, outputRgba, cv.COLOR_RGB2RGBA);

		const output = new ImageData(
			new Uint8ClampedArray(outputRgba.data),
			outputRgba.cols,
			outputRgba.rows,
		);
		self.postMessage({ id, imageData: output }, [output.data.buffer]);
	} catch (error) {
		self.postMessage({
			id,
			error: error instanceof Error ? error.message : "图片还原失败",
		});
	} finally {
		srcRgba?.delete();
		src?.delete();
		maskRgba?.delete();
		mask?.delete();
		dst?.delete();
		outputRgba?.delete();
	}
};
