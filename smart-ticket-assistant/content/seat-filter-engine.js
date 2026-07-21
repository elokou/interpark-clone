(() => {
  const words = (value) => String(value || '').split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  const norm = (value) => String(value || '').toLowerCase();
  const match = (terms, value) => !terms.length || terms.some((term) => norm(value).includes(norm(term)));
  const meta = (seat) => {
    const element = seat.element;
    const context = `${seat.label || ''} ${seat.className || ''} ${element?.closest?.('[data-area], [data-section], [class*="area" i], [class*="zone" i]')?.textContent || ''}`.replace(/\s+/g, ' ').trim();
    const grade = (context.match(/\b(VIP|R|S)\b/i) || [])[1]?.toUpperCase() || null;
    const row = (context.match(/(?:row|열|행)\s*([\w-]+)/i) || [])[1] || seat.row || null;
    const number = (context.match(/(?:seat|좌석|번)\s*(\d+)/i) || [])[1] || seat.col || null;
    const floor = (context.match(/\b([1-4]F)\b/i) || [])[1]?.toUpperCase() || null;
    return { ...seat, region: context, grade, row, number, floor, purchasable: Boolean(element?.isConnected) };
  };
  function filter(candidates, settings) {
    const grades = settings.ticketGrades || [];
    const areas = words(settings.seatAreas);
    const floors = settings.seatFloors || [];
    const filtered = candidates.map(meta).filter((seat) => seat.purchasable && (!grades.length || grades.includes(seat.grade)) && match(areas, seat.region) && (!floors.length || floors.includes(seat.floor)));
    const quantity = Math.max(1, Number(settings.quantity) || 1);
    let recommended = filtered.slice(0, quantity);
    if (settings.requireContiguous && quantity > 1) {
      const groups = new Map();
      filtered.forEach((seat) => { const key = `${seat.row || Math.round(seat.y / 14)}:${seat.floor || ''}`; groups.set(key, [...(groups.get(key) || []), seat]); });
      for (const group of groups.values()) { const sorted = [...group].sort((a, b) => a.x - b.x); for (let i = 0; i <= sorted.length - quantity; i += 1) { const run = sorted.slice(i, i + quantity); if (run.every((seat, n) => n === 0 || seat.x - run[n - 1].x <= 48)) { recommended = run; return { candidates: filtered, recommended }; } } }
      return { candidates: filtered, recommended: [] };
    }
    return { candidates: filtered, recommended };
  }
  globalThis.STASeatFilterEngine = Object.freeze({ filter });
})();
