(() => {
  const KEY = 'smartTicketAssistant';
  const defaults = globalThis.STA_DEFAULTS;
  const AREA_SELECTOR = [
    '[id*="SeatGrade" i]', '[id*="SeatArea" i]', '[id*="Area" i]', '[class*="seat_grade" i]',
    '[class*="seat-area" i]', '[class*="seat_area" i]', '[class*="zone" i]', '[data-area]', '[data-section]'
  ].join(', ');
  const SEAT_SELECTOR = [
    '[id*="Seat" i]', '[class*="seat" i]', '[data-seat]', '[data-seat-no]', '[aria-label*="seat" i]', '[aria-label*="좌석"]'
  ].join(', ');
  const NEXT_SELECTOR = [
    '#btnNext', '#btnNextStep', '[id*="Next" i]', '[class*="btn_next" i]', '[class*="next" i]',
    'button[type="submit"]', '[role="button"]'
  ].join(', ');
  let settings = { ...defaults };
  let status = '正在识别页面';
  let enteredAt = Date.now();
  let available = false;
  let clickPending = false;
  let lastClickedArea;
  let scanTimer;
  let debugRoot;
  let suppressObserver = false;
  let mapAnalysis = { canvases: [], svgCount: 0, iframeCount: 0, imageMapCount: 0 };
  let lastMapAnalysisAt = 0;

  const textOf = (element) => `${element.innerText || ''} ${element.getAttribute('aria-label') || ''} ${element.title || ''}`.replace(/\s+/g, ' ').trim();
  const normal = (value) => value.toLocaleLowerCase();
  const isUnavailable = (element) => /sold|unavailable|disabled|locked|매진|판매완료|선택불가|lock/i.test(`${element.className} ${element.getAttribute('aria-disabled')} ${textOf(element)}`);
  const unique = (elements) => [...new Set(elements)].filter((element) => element instanceof HTMLElement && element.isConnected);
  const named = (selector) => unique([...document.querySelectorAll(selector)]).filter((element) => textOf(element));
  const matches = (keywords, element) => keywords.find((word) => normal(textOf(element)).includes(normal(word)));
  const isSensitive = () => /captcha|인증|verification|결제|payment|card number|비밀번호|password/i.test(document.body?.innerText || '');
  function playTargetTone() {
    try {
      const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContext) return;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      oscillator.frequency.setValueAtTime(1175, context.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.3);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.31);
      oscillator.addEventListener('ended', () => context.close());
    } catch { /* Sound is best-effort; browser autoplay rules may block it. */ }
  }
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

  function describe(element) {
    const classes = String(element.className || '').split(/\s+/).filter(Boolean).slice(0, 2).map((name) => `.${name}`).join('');
    return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${classes} ${textOf(element).slice(0, 45)}`.trim();
  }
  function inspectSeatMap() {
    if (Date.now() - lastMapAnalysisAt > 1500) { mapAnalysis = globalThis.STASeatMapAnalyzer.analyzeDocument(); lastMapAnalysisAt = Date.now(); }
    return mapAnalysis;
  }
  function detectElements() {
    const areaButtons = named(AREA_SELECTOR).filter((element) => !isUnavailable(element));
    const seats = unique([...document.querySelectorAll(SEAT_SELECTOR)]).filter((element) => !isUnavailable(element) && (textOf(element) || element.dataset.seat || element.dataset.seatNo));
    const seatAnalysis = globalThis.STASeatAnalyzer.scoreSeats(seats, settings);
    const map = inspectSeatMap();
    const nextButtons = named(NEXT_SELECTOR).filter((element) => /next|다음|계속|좌석선택 완료|선택완료/i.test(textOf(element)) && !isUnavailable(element));
    return { areaButtons, seats, nextButtons, seatAnalysis, map, dom: { areas: areaButtons.slice(0, 6).map(describe), seats: seats.slice(0, 6).map(describe), next: nextButtons.slice(0, 4).map(describe) } };
  }
  function classify(elements) {
    const page = normal(document.body?.innerText || '');
    if (isSensitive()) return '安全/支付页面（不操作）';
    if (/queue|waiting|대기|예매 대기|접속 대기/.test(page)) return '等待页面';
    if (elements.seats.length || /seat|좌석/.test(page)) return '座位选择页面';
    if (/name|address|연락처|배송|정보 입력/.test(page)) return '信息填写页面';
    if (elements.areaButtons.length || /ticket|예매|booking/.test(page)) return '购票页面';
    return '非票务页面';
  }
  async function appendLog(message) {
    const stored = await chrome.storage.local.get(KEY);
    const current = { ...defaults, ...(stored[KEY] || settings) };
    settings = { ...current, logs: [{ at: Date.now(), message }, ...(current.logs || [])].slice(0, 100) };
    await chrome.storage.local.set({ [KEY]: settings });
    renderDebug();
  }
  function buildReport(elements = detectElements()) {
    const scoreByElement = new Map(elements.seatAnalysis.ranked.map((seat) => [seat.element, seat]));
    return {
      generatedAt: new Date().toISOString(),
      page: { type: status, url: location.href, title: document.title, testMode: settings.testMode },
      structure: { root: describe(document.documentElement), areas: elements.dom.areas, seats: elements.dom.seats, next: elements.dom.next },
      counts: { areaButtons: elements.areaButtons.length, recognizedSeats: elements.seats.length, availableSeats: elements.seatAnalysis.available, unavailableSeats: elements.seatAnalysis.unavailable, canvas: elements.map.canvases.length, svg: elements.map.svgCount, iframe: elements.map.iframeCount, imageMap: elements.map.imageMapCount },
      seatElements: elements.seats.map((element) => { const seat = scoreByElement.get(element); return { label: textOf(element), id: element.id || null, classes: String(element.className || ''), coordinate: seat ? { x: Math.round(seat.x), y: Math.round(seat.y) } : null, row: seat?.row || null, number: seat?.number || null, status: seat?.available ? 'available' : 'unavailable', score: seat?.score ?? null }; }),
      canvas: elements.map.canvases,
      recommendation: elements.seatAnalysis.recommended.map((seat) => ({ label: seat.label, coordinate: { x: Math.round(seat.x), y: Math.round(seat.y) }, score: seat.score, status: 'recommendation-only' }))
    };
  }
  function statusPayload(elements = detectElements()) {
    return {
      status,
      elapsed: `${Math.floor((Date.now() - enteredAt) / 1000)} 秒`,
      available,
      recognized: { areas: elements.areaButtons.length, seats: elements.seatAnalysis.available, next: elements.nextButtons.length },
      seatRecommendation: elements.seatAnalysis.recommended.map((seat) => ({ label: seat.label, score: seat.score })),
      map: elements.map,
      dom: elements.dom
    };
  }
  function sendStatus(elements) { chrome.runtime.sendMessage({ type: 'STA_PAGE_STATUS', payload: statusPayload(elements) }).catch(() => {}); }
  function clearDebugMarks() { document.querySelectorAll('.sta-debug-area, .sta-debug-seat, .sta-debug-next, .sta-debug-recommended').forEach((element) => element.classList.remove('sta-debug-area', 'sta-debug-seat', 'sta-debug-next', 'sta-debug-recommended')); }
  function renderDebug(elements = detectElements()) {
    suppressObserver = true;
    clearDebugMarks();
    debugRoot?.remove();
    debugRoot = null;
    if (!settings.debugMode) { setTimeout(() => { suppressObserver = false; }, 0); return; }
    elements.areaButtons.forEach((element) => element.classList.add('sta-debug-area'));
    elements.seats.forEach((element) => element.classList.add('sta-debug-seat'));
    elements.nextButtons.forEach((element) => element.classList.add('sta-debug-next'));
    elements.seatAnalysis.recommended.forEach((seat) => seat.element.classList.add('sta-debug-recommended'));
    debugRoot = document.createElement('aside');
    debugRoot.id = 'sta-debug-panel';
    const latest = (settings.logs || []).slice(0, 4).map((log) => `<li>${escapeHtml(new Date(log.at).toLocaleTimeString())} ${escapeHtml(log.message)}</li>`).join('') || '<li>等待操作日志</li>';
    const recommendation = elements.seatAnalysis.recommended.map((seat) => `${escapeHtml(seat.label || '座位')} (${seat.score})`).join('、') || '未找到';
    const maps = `Canvas ${elements.map.canvases.length} · SVG ${elements.map.svgCount} · iframe ${elements.map.iframeCount} · 图片地图 ${elements.map.imageMapCount}`;
    const canvasColors = elements.map.canvases.flatMap((canvas) => canvas.colors.slice(0, 3).map((color) => `${color.state}:${color.color} (${color.samples})`)).join('、') || '无可读 Canvas 颜色';
    const dom = [...elements.dom.areas, ...elements.dom.seats, ...elements.dom.next].map((item) => `<li>${escapeHtml(item)}</li>`).join('') || '<li>未识别到目标 DOM 元素</li>';
    debugRoot.innerHTML = `<strong>Smart Ticket 调试</strong><span>${status} · ${statusPayload(elements).elapsed}</span><dl><div><dt>区域按钮</dt><dd>${elements.areaButtons.length}</dd></div><div><dt>座位元素</dt><dd>${elements.seats.length}</dd></div><div><dt>下一步按钮</dt><dd>${elements.nextButtons.length}</dd></div></dl><p>座位图：${escapeHtml(maps)}</p><p>Canvas：${escapeHtml(canvasColors)}</p><p>推荐座位：${recommendation}</p><details><summary>识别 DOM 结构</summary><ul>${dom}</ul></details><ol>${latest}</ol>`;
    document.documentElement.append(debugRoot);
    setTimeout(() => { suppressObserver = false; }, 0);
  }
  async function clickArea(element, keyword) {
    clickPending = true;
    const delay = Math.max(200, settings.waitTime) + Math.floor(Math.random() * 250);
    await new Promise((resolve) => setTimeout(resolve, delay));
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise((resolve) => setTimeout(resolve, 100));
    element.click();
    await appendLog(`自动点击区域：${keyword}`);
    clickPending = false;
  }
  async function assist(elements) {
    if (!settings.enabled || !settings.autoClick || settings.testMode || clickPending || isSensitive() || status === '等待页面' || status === '信息填写页面') return;
    const keywords = [...settings.priorityAreas, ...settings.fallbackAreas];
    const target = elements.areaButtons.find((element) => matches(keywords, element));
    if (target && target !== lastClickedArea) {
      lastClickedArea = target;
      await clickArea(target, matches(keywords, target));
    }
  }
  async function scan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(async () => {
      const elements = detectElements();
      const nextStatus = classify(elements);
      if (nextStatus !== status) {
        status = nextStatus;
        enteredAt = Date.now();
        const current = (await chrome.storage.local.get(KEY))[KEY] || settings;
        settings = { ...current, history: [{ at: enteredAt, status, url: location.href }, ...(current.history || [])].slice(0, 100) };
        await chrome.storage.local.set({ [KEY]: settings });
        await appendLog(`页面状态：${status}`);
      }
      const keywords = [...settings.priorityAreas, ...settings.fallbackAreas];
      const found = !isSensitive() && elements.areaButtons.some((element) => matches(keywords, element));
      if (found && !available) {
        await appendLog('发现可选择的目标区域');
        playTargetTone();
        chrome.runtime.sendMessage({ type: 'STA_TARGET_FOUND', area: matches(keywords, elements.areaButtons.find((element) => matches(keywords, element))) }).catch(() => {});
      }
      available = found;
      renderDebug(elements);
      sendStatus(elements);
      assist(elements);
    }, 200);
  }

  chrome.storage.local.get(KEY).then((stored) => { settings = { ...defaults, ...(stored[KEY] || {}) }; scan(); });
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes[KEY]) { settings = { ...defaults, ...changes[KEY].newValue }; scan(); } });
  new MutationObserver(() => { if (!suppressObserver) scan(); }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'disabled', 'aria-disabled', 'title'] });
  ['pushState', 'replaceState'].forEach((method) => { const original = history[method]; history[method] = function (...args) { const result = original.apply(this, args); queueMicrotask(scan); return result; }; });
  addEventListener('popstate', scan);
  addEventListener('hashchange', scan);
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message.type === 'STA_STATUS_REQUEST') respond(statusPayload());
    if (message.type === 'STA_SCAN_SEAT_MAP') { lastMapAnalysisAt = 0; const elements = detectElements(); renderDebug(elements); respond({ status: statusPayload(elements), report: buildReport(elements) }); }
    if (message.type === 'STA_EXPORT_ANALYSIS') respond(buildReport());
  });
})();
