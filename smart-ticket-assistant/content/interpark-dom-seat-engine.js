(() => {
  const textOf = (element) => `${element.getAttribute?.('aria-label') || ''} ${element.title || ''} ${element.className?.baseVal || element.className || ''}`.replace(/\s+/g, ' ').trim();
  const unavailable = (element) => /sold|unavailable|disabled|locked|매진|판매완료|선택불가|lock/i.test(`${textOf(element)} ${element.getAttribute?.('aria-disabled')}`);
  const visibleSeatLike = (element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4 || rect.width > 72 || rect.height > 72 || unavailable(element)) return false;
    const style = element.ownerDocument.defaultView.getComputedStyle(element);
    const colored = style.backgroundColor !== 'rgba(0, 0, 0, 0)' || style.backgroundImage !== 'none' || style.fill !== 'none';
    const mapAncestor = element.closest?.('[id*="seat" i], [class*="seat" i], [id*="map" i], [class*="map" i], [id*="plan" i], [class*="plan" i]');
    return colored && Boolean(mapAncestor) && style.pointerEvents !== 'none';
  };
  function collect(documentRef, depth, output) {
    const frame = documentRef.location?.href || null;
    const selector = '[style*="background" i], [class*="seat" i], [id*="seat" i], button, a, area, rect';
    for (const element of documentRef.querySelectorAll(selector)) {
      if (!visibleSeatLike(element)) continue;
      const rect = element.getBoundingClientRect(), style = element.ownerDocument.defaultView.getComputedStyle(element);
      output.push({ element, iframe: frame, depth, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width, height: rect.height, color: style.backgroundColor !== 'rgba(0, 0, 0, 0)' ? style.backgroundColor : style.fill, className: String(element.className?.baseVal || element.className || ''), label: textOf(element) });
    }
    for (const frame of documentRef.querySelectorAll('iframe')) { try { if (frame.contentDocument) collect(frame.contentDocument, depth + 1, output); } catch {} }
  }
  function contiguous(candidates, quantity) {
    if (quantity <= 1) return candidates.slice(0, 1);
    const rows = new Map();
    candidates.forEach((seat) => { const key = Math.round(seat.y / 14); rows.set(key, [...(rows.get(key) || []), seat]); });
    for (const row of rows.values()) {
      const sorted = [...row].sort((a, b) => a.x - b.x);
      for (let index = 0; index <= sorted.length - quantity; index += 1) {
        const run = sorted.slice(index, index + quantity);
        const gaps = run.slice(1).map((seat, i) => seat.x - run[i].x);
        const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] || 0;
        if (gaps.every((gap) => gap <= Math.max(48, median * 1.8))) return run;
      }
    }
    return [];
  }
  function scan({ quantity = 1 }) {
    const candidates = []; collect(document, 0, candidates);
    const unique = [...new Map(candidates.map((seat) => [seat.element, seat])).values()];
    const centerX = unique.length ? (Math.min(...unique.map((seat) => seat.x)) + Math.max(...unique.map((seat) => seat.x))) / 2 : 0;
    unique.forEach((seat) => { seat.score = Math.round(40 - Math.min(40, Math.abs(seat.x - centerX)) + Math.max(0, 30 - seat.y / 30)); });
    const rowGroups = new Map();
    unique.sort((a, b) => a.y - b.y || a.x - b.x).forEach((seat) => { const row = Math.round(seat.y / 14); const group = [...(rowGroups.get(row) || []), seat]; rowGroups.set(row, group); seat.row = row; seat.col = group.length; });
    const ranked = unique.sort((a, b) => b.score - a.score);
    const run = contiguous(ranked, quantity);
    return { candidates: ranked, recommended: run.length === quantity ? run : ranked.slice(0, quantity), contiguous: run.length === quantity, iframeCount: document.querySelectorAll('iframe').length };
  }
  globalThis.STAInterparkDomSeatEngine = Object.freeze({ scan });
})();
