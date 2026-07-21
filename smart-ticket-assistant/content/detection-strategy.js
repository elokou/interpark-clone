(() => {
  const RANGES = {
    stable: [5000, 8000],
    balanced: [2500, 4500],
    fast: [2000, 3000]
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const randomBetween = (min, max) => Math.round(min + Math.random() * (max - min));

  function create(settings = {}) {
    let profile = RANGES[settings.scanProfile] ? settings.scanProfile : 'balanced';
    let level = 0;
    let idleScans = 0;
    let stats = { count: 0, pageChanges: 0, lastAt: null, currentInterval: RANGES[profile][0], ...(settings.scanStats || {}) };
    function range() {
      const [min, max] = RANGES[profile];
      if (!level) return [min, max];
      return [Math.min(10000, min + level * 1000), Math.min(10000, max + level * 1500)];
    }
    return {
      configure(next) { profile = RANGES[next.scanProfile] ? next.scanProfile : profile; },
      record({ pageChanged, enteredSeatSelection, targetFound, seatCountChanged, noAvailableSeats }) {
        const accelerate = pageChanged || enteredSeatSelection || targetFound || seatCountChanged;
        if (accelerate) { level = 0; idleScans = 0; }
        else if (noAvailableSeats) { idleScans += 1; if (idleScans >= 3) { level = clamp(level + 1, 0, 2); idleScans = 0; } }
        else { idleScans = 0; }
        const [min, max] = range();
        const interval = randomBetween(min, max);
        stats = { count: stats.count + 1, pageChanges: stats.pageChanges + Number(pageChanged), lastAt: Date.now(), currentInterval: interval, profile, level };
        return { ...stats };
      },
      nextDelay() { return stats.currentInterval; },
      stats() { return { ...stats }; }
    };
  }
  globalThis.STADetectionStrategy = Object.freeze({ create, ranges: RANGES });
})();
