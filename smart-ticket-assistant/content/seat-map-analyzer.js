(() => {
  const colorKey = (r, g, b) => `${Math.round(r / 16) * 16},${Math.round(g / 16) * 16},${Math.round(b / 16) * 16}`;
  const classifyColor = (r, g, b) => {
    const max = Math.max(r, g, b), min = Math.min(r, g, b), saturation = max - min;
    if (max < 80 || saturation < 20) return 'disabled';
    if (r > g * 1.25 && r > b * 1.25) return 'sold';
    return 'available';
  };
  function inspectCanvas(canvas) {
    try {
      const context = canvas.getContext('2d', { willReadFrequently: true });
      const { width, height } = canvas;
      if (!context || !width || !height) return { width, height, colors: [], error: 'Canvas 无可读像素' };
      const image = context.getImageData(0, 0, width, height);
      const step = Math.max(1, Math.ceil(Math.sqrt((width * height) / 12000)));
      const groups = new Map();
      for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) {
        const offset = (y * width + x) * 4;
        if (image.data[offset + 3] < 100) continue;
        const r = image.data[offset], g = image.data[offset + 1], b = image.data[offset + 2];
        const key = colorKey(r, g, b);
        const group = groups.get(key) || { color: key, state: classifyColor(r, g, b), samples: 0 };
        group.samples += 1;
        groups.set(key, group);
      }
      return { width, height, colors: [...groups.values()].sort((a, b) => b.samples - a.samples).slice(0, 12) };
    } catch (error) {
      return { width: canvas.width, height: canvas.height, colors: [], error: 'Canvas 像素受同源策略保护，无法读取' };
    }
  }
  function captureCanvas(canvas) {
    try { return { dataUrl: canvas.toDataURL('image/png'), error: null }; }
    catch { return { dataUrl: null, error: 'Canvas 截图受同源策略保护，无法导出' }; }
  }
  function analyzeDocument() {
    const canvases = [...document.querySelectorAll('canvas')].map(inspectCanvas);
    const svgs = [...document.querySelectorAll('svg')];
    const frames = [...document.querySelectorAll('iframe')];
    const imageMaps = [...document.querySelectorAll('map, img[usemap]')];
    return { canvases, svgCount: svgs.length, iframeCount: frames.length, imageMapCount: imageMaps.length };
  }
  globalThis.STASeatMapAnalyzer = Object.freeze({ analyzeDocument, captureCanvas });
})();
