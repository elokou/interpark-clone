(() => {
  const unavailablePattern = /sold|unavailable|disabled|locked|매진|판매완료|선택불가|lock/i;
  const seatText = (element) => `${element.innerText || ''} ${element.getAttribute('aria-label') || ''} ${element.title || ''}`.replace(/\s+/g, ' ').trim();
  const numberAfter = (pattern, text) => Number((text.match(pattern) || [])[1]) || null;
  const clamp = (value) => Math.max(0, Math.min(1, value));

  function toSeat(element) {
    const label = seatText(element);
    const rect = element.getBoundingClientRect();
    const unavailable = unavailablePattern.test(`${element.className} ${element.getAttribute('aria-disabled')} ${element.disabled} ${label}`);
    return {
      element,
      label,
      available: !unavailable && rect.width > 0 && rect.height > 0,
      row: numberAfter(/(?:row|열|행)\s*(\d+)/i, label),
      number: numberAfter(/(?:seat|좌석|번)\s*(\d+)/i, label),
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }
  function scoreSeats(elements, settings) {
    const all = elements.map(toSeat);
    const available = all.filter((seat) => seat.available);
    if (!available.length) return { total: all.length, available: 0, unavailable: all.length, ranked: [], recommended: [] };

    const xs = available.map((seat) => seat.x);
    const ys = available.map((seat) => seat.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const centerX = (minX + maxX) / 2;
    const xSpan = Math.max(maxX - minX, 1), ySpan = Math.max(maxY - minY, 1);
    const targetX = settings.targetX == null ? centerX : Number(settings.targetX);
    const targetY = settings.targetY == null ? minY : Number(settings.targetY);
    const maxTargetDistance = Math.max(Math.hypot(maxX - targetX, maxY - targetY), Math.hypot(minX - targetX, minY - targetY), 1);
    const rows = new Map();
    available.forEach((seat) => {
      const key = seat.row ? `row-${seat.row}` : `y-${Math.round(seat.y / 18)}`;
      rows.set(key, [...(rows.get(key) || []), seat]);
    });
    const quantity = Math.max(1, Number(settings.quantity) || 1);
    const contiguous = new Set();
    const contiguousRuns = [];
    for (const rowSeats of rows.values()) {
      const sorted = [...rowSeats].sort((a, b) => a.x - b.x);
      for (let start = 0; start <= sorted.length - quantity; start += 1) {
        const run = sorted.slice(start, start + quantity);
        const gaps = run.slice(1).map((seat, index) => seat.x - run[index].x);
        const typicalGap = gaps.length ? Math.min(...gaps) : 0;
        if (!gaps.length || Math.max(...gaps) <= Math.max(typicalGap * 1.65, 42)) { run.forEach((seat) => contiguous.add(seat)); contiguousRuns.push(run); }
      }
    }
    const ranked = available.map((seat) => {
      const stageScore = 1 - clamp((seat.y - minY) / ySpan);
      const centerScore = 1 - clamp(Math.abs(seat.x - centerX) / (xSpan / 2 || 1));
      const coordinateScore = 1 - clamp(Math.hypot(seat.x - targetX, seat.y - targetY) / maxTargetDistance);
      const contiguousScore = contiguous.has(seat) ? 1 : 0;
      const score = settings.strategy === 'stage'
        ? stageScore * 70 + centerScore * 20 + contiguousScore * 10
        : settings.strategy === 'contiguous'
          ? contiguousScore * 65 + centerScore * 20 + stageScore * 15
          : settings.strategy === 'coordinate'
            ? coordinateScore * 70 + centerScore * 15 + stageScore * 15
            : centerScore * 65 + stageScore * 25 + contiguousScore * 10;
      return { ...seat, score: Math.round(score) };
    }).sort((a, b) => b.score - a.score);

    let recommended = ranked.slice(0, quantity);
    if (settings.strategy === 'contiguous') {
      const byElement = new Map(ranked.map((seat) => [seat.element, seat]));
      const scoredRuns = contiguousRuns.map((run) => run.map((seat) => byElement.get(seat.element)));
      const bestRun = scoredRuns.sort((left, right) => right.reduce((sum, seat) => sum + seat.score, 0) - left.reduce((sum, seat) => sum + seat.score, 0))[0];
      if (bestRun?.length === quantity) recommended = bestRun;
    }
    return { total: all.length, available: available.length, unavailable: all.length - available.length, ranked, recommended };
  }
  globalThis.STASeatAnalyzer = Object.freeze({ scoreSeats });
})();
