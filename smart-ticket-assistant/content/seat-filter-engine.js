(() => {
  const words = (value) => String(value || '').split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  const norm = (value) => String(value || '').toLowerCase();
  const match = (terms, value) => !terms.length || terms.some((term) => norm(value).includes(norm(term)));
  const number = (value) => Number(String(value || '').replace(/[^\d.]/g, '')) || null;
  const seatPrice = (seat, context) => number(seat.price || seat.element?.dataset?.price || seat.element?.getAttribute?.('data-price') || (context.match(/(?:₩|krw|won|price|가격)\s*([\d,]+)/i) || [])[1]);
  const meta = (seat) => {
    const element = seat.element;
    const context = `${seat.label || ''} ${seat.className || ''} ${element?.closest?.('[data-area], [data-section], [class*="area" i], [class*="zone" i]')?.textContent || ''}`.replace(/\s+/g, ' ').trim();
    const grade = (context.match(/\b(VIP|R|S)\b/i) || [])[1]?.toUpperCase() || null;
    const row = (context.match(/(?:row|열|행)\s*([\w-]+)/i) || [])[1] || seat.row || null;
    const seatNumber = (context.match(/(?:seat|좌석|번)\s*(\d+)/i) || [])[1] || seat.col || null;
    const floor = (context.match(/\b([1-4]F)\b/i) || [])[1]?.toUpperCase() || null;
    return { ...seat, region: context, grade, row, number: seatNumber, floor, price: seatPrice(seat, context), purchasable: Boolean(element?.isConnected) };
  };
  function coordinateDistance(seat, settings) {
    if (settings.strategy !== 'coordinate' || settings.targetX == null || settings.targetY == null) return 0;
    return Math.hypot(Number(seat.x) - Number(settings.targetX), Number(seat.y) - Number(settings.targetY));
  }
  function ordered(seats, settings) {
    return [...seats].sort((left, right) => coordinateDistance(left, settings) - coordinateDistance(right, settings) || (right.score || 0) - (left.score || 0) || left.y - right.y || left.x - right.x);
  }
  function filter(candidates, settings) {
    const grades = settings.ticketGrades || [], areas = words(settings.seatAreas), floors = settings.seatFloors || [];
    const minPrice = settings.priceMin == null ? null : Number(settings.priceMin);
    const maxPrice = settings.priceMax == null ? null : Number(settings.priceMax);
    const filtered = ordered(candidates.map(meta).filter((seat) => seat.purchasable && (!grades.length || grades.includes(seat.grade)) && match(areas, seat.region) && (!floors.length || floors.includes(seat.floor)) && (minPrice == null && maxPrice == null || seat.price != null && (minPrice == null || seat.price >= minPrice) && (maxPrice == null || seat.price <= maxPrice))), settings);
    const quantity = Math.max(1, Number(settings.quantity) || 1);
    let recommended = filtered.slice(0, quantity);
    if (settings.requireContiguous && quantity > 1) {
      const groups = new Map();
      filtered.forEach((seat) => { const key = `${seat.row || Math.round(seat.y / 14)}:${seat.floor || ''}:${seat.grade || ''}`; groups.set(key, [...(groups.get(key) || []), seat]); });
      const runs = [];
      for (const group of groups.values()) {
        const sorted = [...group].sort((a, b) => a.x - b.x);
        for (let i = 0; i <= sorted.length - quantity; i += 1) {
          const run = sorted.slice(i, i + quantity);
          if (run.every((seat, index) => index === 0 || seat.x - run[index - 1].x <= 48)) runs.push(run);
        }
      }
      recommended = runs.sort((left, right) => coordinateDistance(left[0], settings) - coordinateDistance(right[0], settings) || right.reduce((sum, seat) => sum + (seat.score || 0), 0) - left.reduce((sum, seat) => sum + (seat.score || 0), 0))[0] || [];
    }
    return { candidates: filtered, recommended };
  }
  globalThis.STASeatFilterEngine = Object.freeze({ filter });
})();
