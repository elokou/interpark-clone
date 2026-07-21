(() => {
  const randomWait = () => 3000 + Math.floor(Math.random() * 3001);
  function create() {
    let candidates = [], index = 0, lastAttemptAt = 0, failureCount = 0, rotationCount = 0, currentArea = null, seatFoundAt = null, maxCycles = 20, pauseUntil = 0;
    function configure(rankedAreas, limit = 20) {
      maxCycles = Math.max(1, Number(limit) || 20);
      candidates = rankedAreas.filter((area) => area.element?.isConnected);
      if (index >= candidates.length) index = 0;
    }
    function next({ hasAvailableSeats, now = Date.now() }) {
      if (hasAvailableSeats) { seatFoundAt ||= now; return { action: 'found', currentArea, seatFoundAt }; }
      if (pauseUntil > now) return { action: 'pause', currentArea, waitMs: pauseUntil - now, failureCount };
      if (failureCount >= maxCycles) { pauseUntil = now + 30000; failureCount = 0; return { action: 'pause', currentArea, waitMs: 30000, reason: '连续失败达到上限' }; }
      if (!candidates.length) return { action: 'idle', reason: '未发现可点击区域' };
      const cooldown = Math.min(15000, Math.max(5000, randomWait()) + failureCount * 1000);
      const remaining = lastAttemptAt ? cooldown - (now - lastAttemptAt) : 0;
      if (remaining > 0) return { action: 'wait', currentArea, waitMs: remaining, failureCount };
      const candidate = candidates[index++ % candidates.length];
      currentArea = candidate.label;
      rotationCount += 1;
      lastAttemptAt = now;
      failureCount += 1;
      return { action: 'rotate', candidate, currentArea, cooldown, failureCount };
    }
    function clickedFailed() { lastAttemptAt = Date.now(); failureCount += 1; }
    function snapshot() { return { currentArea, nextArea: candidates[index % Math.max(candidates.length, 1)]?.label || null, failureCount, rotationCount, seatFoundAt, candidateCount, pauseUntil, maxCycles }; }
    return { configure, next, clickedFailed, snapshot };
  }
  globalThis.STAAreaRotationEngine = Object.freeze({ create });
})();
