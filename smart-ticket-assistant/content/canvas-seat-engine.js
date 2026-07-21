(() => {
  const parseColor = (value) => { const match = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i); return match ? match.slice(1, 4).map(Number) : null; };
  const textOf = (element) => `${element.innerText || ''} ${element.getAttribute('aria-label') || ''}`.replace(/\s+/g, ' ').trim();
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  function legendColors(keywords) {
    const result = [];
    for (const element of document.querySelectorAll('button, label, li, span, div')) {
      const label = textOf(element);
      const keyword = keywords.find((term) => term.length === 1 ? new RegExp(`\\b${term}\\b`, 'i').test(label) : label.toLowerCase().includes(term.toLowerCase()));
      if (!keyword) continue;
      const style = getComputedStyle(element);
      const color = parseColor(style.backgroundColor) || parseColor(style.borderColor) || parseColor(style.color);
      if (color && !result.some((item) => item.keyword === keyword && distance(item.color, color) < 5)) result.push({ keyword, color });
    }
    return result;
  }
  function scanCanvas(canvas, keywords) {
    const rect = canvas.getBoundingClientRect();
    try {
      const context = canvas.getContext('2d', { willReadFrequently: true });
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const legends = legendColors(keywords);
      const visited = new Uint8Array(canvas.width * canvas.height);
      const candidates = [];
      const matchAt = (x, y) => {
        const offset = (y * canvas.width + x) * 4;
        if (image.data[offset + 3] < 100) return null;
        const pixel = [image.data[offset], image.data[offset + 1], image.data[offset + 2]];
        return legends.find((legend) => distance(pixel, legend.color) <= 42) || null;
      };
      for (let y = 0; y < canvas.height; y += 2) for (let x = 0; x < canvas.width; x += 2) {
        const index = y * canvas.width + x;
        if (visited[index]) continue;
        const legend = matchAt(x, y);
        if (!legend) continue;
        const stack = [[x, y]], pixels = []; visited[index] = 1;
        while (stack.length && pixels.length < 3000) {
          const [px, py] = stack.pop(); pixels.push([px, py]);
          for (const [nx, ny] of [[px + 2, py], [px - 2, py], [px, py + 2], [px, py - 2]]) {
            if (nx < 0 || ny < 0 || nx >= canvas.width || ny >= canvas.height) continue;
            const next = ny * canvas.width + nx;
            if (!visited[next] && matchAt(nx, ny)?.keyword === legend.keyword) { visited[next] = 1; stack.push([nx, ny]); }
          }
        }
        if (pixels.length < 4 || pixels.length > 1200) continue;
        const center = pixels.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]).map((sum) => sum / pixels.length);
        candidates.push({ canvas, keyword: legend.keyword, x: center[0], y: center[1], clientX: rect.left + center[0] * rect.width / canvas.width, clientY: rect.top + center[1] * rect.height / canvas.height, pixels: pixels.length, source: 'canvas-color-region' });
      }
      return { candidates, legendCount: legends.length, error: null };
    } catch { return { candidates: [], legendCount: 0, error: 'Canvas 像素受同源策略保护，无法读取' }; }
  }
  function scan(keywords) { const reports = [...document.querySelectorAll('canvas')].map((canvas) => scanCanvas(canvas, keywords)); return { candidates: reports.flatMap((report) => report.candidates), reports }; }
  function click(candidate) {
    if (!candidate?.canvas?.isConnected) return { ok: false, reason: 'Canvas 不可用' };
    const view = candidate.canvas.ownerDocument.defaultView || window;
    ['mousedown', 'mouseup', 'click'].forEach((type) => candidate.canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, view, clientX: candidate.clientX, clientY: candidate.clientY, button: 0, buttons: type === 'mousedown' ? 1 : 0 })));
    return { ok: true, label: candidate.keyword, coordinate: { x: Math.round(candidate.x), y: Math.round(candidate.y) } };
  }
  globalThis.STACanvasSeatEngine = Object.freeze({ scan, click });
})();
