(() => {
  const unavailable = (element) => !element?.isConnected || element.disabled || element.getAttribute('aria-disabled') === 'true' || /sold|unavailable|disabled|locked|매진|판매완료|선택불가|lock/i.test(`${element.className} ${element.getAttribute('aria-disabled')} ${element.getAttribute('aria-label')} ${element.title}`);
  const selected = (element) => /selected|chosen|active|on|선택/i.test(`${element.className} ${element.getAttribute('aria-selected')} ${element.getAttribute('aria-pressed')}`);
  const textOf = (element) => `${element.textContent || ''} ${element.getAttribute('aria-label') || ''} ${element.title || ''}`.replace(/\s+/g, ' ').trim();
  const unique = (elements) => [...new Set(elements)].filter((element) => element?.isConnected);
  function scan({ seats = [], quantity = 1 }) {
    const selectors = '[data-seat], [data-seat-no], [aria-label*="seat" i], [aria-label*="좌석"], button[class*="seat" i], area[class*="seat" i], svg rect[data-seat], svg rect[class*="seat" i]';
    const candidates = unique([...seats, ...document.querySelectorAll(selectors)]).filter((element) => !unavailable(element) && !selected(element)).map((element) => {
      const rect = element.getBoundingClientRect();
      return { element, label: textOf(element), x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, vip: /vip|floor|inner|내부/i.test(`${element.className} ${textOf(element)}`) };
    }).filter((seat) => seat.x || seat.y);
    const xs = candidates.map((seat) => seat.x), ys = candidates.map((seat) => seat.y);
    const center = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
    const xSpan = Math.max((Math.max(...xs, 0) - Math.min(...xs, 0)) / 2, 1), minY = Math.min(...ys, 0), ySpan = Math.max(Math.max(...ys, 0) - minY, 1);
    const ranked = candidates.map((seat) => {
      const centerScore = Math.max(0, 40 - Math.round(Math.abs(seat.x - center) / xSpan * 40));
      const stageScore = Math.max(0, 30 - Math.round((seat.y - minY) / ySpan * 30));
      const vipScore = seat.vip ? 30 : 0;
      const contiguousScore = quantity > 1 ? 20 : 0;
      return { ...seat, score: centerScore + stageScore + vipScore + contiguousScore };
    }).sort((a, b) => b.score - a.score);
    return { candidates: ranked, recommended: ranked.slice(0, quantity), sources: { buttons: document.querySelectorAll('button').length, areas: document.querySelectorAll('area').length, svgRects: document.querySelectorAll('svg rect').length, canvases: document.querySelectorAll('canvas').length, iframes: document.querySelectorAll('iframe').length } };
  }
  globalThis.STASeatSearchLoop = Object.freeze({ scan });
})();
