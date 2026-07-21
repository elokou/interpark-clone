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
  const INTERPARK_AREA_PATTERN = /\b(?:VIP|R|S)\s*Seat\b|\bF(?:[1-9]|1\d|20)\b|\bE(?:[1-9]|1\d|2[0-5])\b/i;
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
  let mutationTimer;
  let lastScanAt = 0;
  let areaLoadingUntil = 0;
  let seatRetryUntil = 0;
  let pendingSeatClick = null;
  let selectionComplete = false;
  let forceAreaRotation = false;
  let executionState = { currentSeat: null, clickCount: 0, rotationCount: 0, lastSuccessAt: null, selectedSeatCount: 0, seatFailureCount: 0, lastVerification: [] };
  let areaRotation = globalThis.STAAreaRotationEngine.create();
  let rotationState = { currentArea: null, nextArea: null, failureCount: 0, seatFoundAt: null, candidateCount: 0 };
  let detectionStrategy = globalThis.STADetectionStrategy.create(defaults);
  let lastFingerprint = '';
  let debugRoot;
  let suppressObserver = false;
  let mapAnalysis = { canvases: [], svgCount: 0, iframeCount: 0, imageMapCount: 0 };
  let lastMapAnalysisAt = 0;
  let lastDomSeatSignature = '';

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

  function inspectIframes() {
    return [...document.querySelectorAll('iframe')].map((frame, index) => {
      const info = { index: index + 1, url: frame.src || null, accessible: false, elements: 0, svg: 0, canvas: 0, seatAreas: 0 };
      try {
        const doc = frame.contentDocument;
        if (!doc) return info;
        info.accessible = true;
        info.elements = doc.querySelectorAll('*').length;
        info.svg = doc.querySelectorAll('svg').length;
        info.canvas = doc.querySelectorAll('canvas').length;
        info.seatAreas = [...doc.querySelectorAll('button, a, [role=button], [onclick], [data-area], [data-section]')].filter((element) => INTERPARK_AREA_PATTERN.test(textOf(element))).length;
      } catch { /* Cross-origin iframe: URL is reported but its DOM remains inaccessible. */ }
      return info;
    });
  }
  function describe(element) {
    const classes = String(element.className || '').split(/\s+/).filter(Boolean).slice(0, 2).map((name) => `.${name}`).join('');
    return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${classes} ${textOf(element).slice(0, 45)}`.trim();
  }
  function inspectSeatMap() {
    if (Date.now() - lastMapAnalysisAt > 1500) { mapAnalysis = globalThis.STASeatMapAnalyzer.analyzeDocument(); lastMapAnalysisAt = Date.now(); }
    return mapAnalysis;
  }
  const interparkStatus = { waiting: '等待页面', area: '购票页面', seat: '座位选择页面' };
  function detectElements() {
    const interpark = { backButton: globalThis.STAInterparkAdapter.getAreaBackButton(), state: globalThis.STAInterparkAdapter.getPageState(), waitingPeople: globalThis.STAInterparkAdapter.getWaitingPeople(), areas: globalThis.STAInterparkAdapter.getAreas(), seats: globalThis.STAInterparkAdapter.getSeats(), frames: globalThis.STAInterparkAdapter.getFrameTree().frames };
    const areaButtons = unique([
      ...interpark.areas.map((area) => area.element),
      ...named(AREA_SELECTOR),
      ...named('button, a, [role=button], [onclick], area').filter((element) => INTERPARK_AREA_PATTERN.test(textOf(element)))
    ]).filter((element) => !isUnavailable(element));
    const areaAnalysis = globalThis.STAAreaPriorityEngine.scoreAreas(areaButtons, settings);
    const recommendedAreas = areaAnalysis.recommended.map((area) => area.element);
    const seats = unique([...interpark.seats.map((seat) => seat.element), ...document.querySelectorAll(SEAT_SELECTOR)]).filter((element) => !isUnavailable(element) && (textOf(element) || element.dataset.seat || element.dataset.seatNo));
    const seatAnalysis = globalThis.STASeatAnalyzer.scoreSeats(seats, settings);
    const domSeatSearch = globalThis.STAInterparkDomSeatEngine.scan({ quantity: settings.quantity });
    const seatSearch = globalThis.STASeatSearchLoop.scan({ seats: [...seats, ...domSeatSearch.candidates.map((seat) => seat.element)], quantity: settings.quantity });
    const filteredSeatSearch = globalThis.STASeatFilterEngine.filter([...domSeatSearch.candidates, ...seatSearch.candidates], settings);
    const canvasSearch = globalThis.STACanvasSeatEngine.scan([...(settings.priorityAreas || []), ...(settings.fallbackAreas || []), 'VIP', 'R', 'S']);
    const selectedSeatCount = Math.max(seats.filter((seat) => globalThis.STASeatClickEngine.isSelected(seat)).length, globalThis.STAInterparkAdapter.getSelectedSeatCount());
    const map = inspectSeatMap();
    const iframes = inspectIframes();
    const nextButtons = named(NEXT_SELECTOR).filter((element) => /next|다음|계속|좌석선택 완료|선택완료/i.test(textOf(element)) && !isUnavailable(element));
    return { areaButtons: recommendedAreas, seats, domSeatSearch, seatSearch, filteredSeatSearch, canvasSearch, selectedSeatCount, nextButtons, seatAnalysis, areaAnalysis, map, iframes, interpark, dom: { areas: areaButtons.slice(0, 6).map(describe), seats: seats.slice(0, 6).map(describe), next: nextButtons.slice(0, 4).map(describe) } };
  }
  function classify(elements) {
    if (interparkStatus[elements.interpark.state.type]) return interparkStatus[elements.interpark.state.type];
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
      page: { type: status, url: location.href, title: document.title, testMode: settings.testMode, interpark: elements.interpark.state, waitingPeople: elements.interpark.waitingPeople },
      structure: { root: describe(document.documentElement), areas: elements.dom.areas, seats: elements.dom.seats, next: elements.dom.next },
      counts: { areaButtons: elements.areaButtons.length, recognizedSeats: elements.seats.length, availableSeats: elements.seatAnalysis.available, unavailableSeats: elements.seatAnalysis.unavailable, canvas: elements.map.canvases.length, svg: elements.map.svgCount, iframe: elements.map.iframeCount, imageMap: elements.map.imageMapCount },
      iframes: elements.iframes,
      interparkFrames: elements.interpark.frames,
      rotation: rotationState,
      execution: executionState,
      interpark: { state: elements.interpark.state, waitingPeople: elements.interpark.waitingPeople, areaSources: elements.interpark.areas.map((area) => area.source), seatSources: elements.interpark.seats.map((seat) => seat.source) },
      areaTemplate: elements.areaAnalysis.templateName,
      unknownAreas: elements.areaAnalysis.unknown,
      areaRecommendations: elements.areaAnalysis.recommended.map((area) => ({ label: area.label, category: area.type, score: area.score, factors: area.factors })),
      seatSearch: { candidateCount: elements.seatSearch.candidates.length, sources: elements.seatSearch.sources },
      filteredSeatSearch: { candidateCount: elements.filteredSeatSearch.candidates.length, recommended: elements.filteredSeatSearch.recommended.map((seat) => ({ region: seat.region, row: seat.row, number: seat.number, grade: seat.grade, floor: seat.floor })) },
      interparkDomSeats: { candidateCount: elements.domSeatSearch.candidates.length, iframeCount: elements.domSeatSearch.iframeCount, candidates: elements.domSeatSearch.candidates.map((seat) => ({ element: { tag: seat.element.tagName, id: seat.element.id || null }, iframe: seat.iframe, x: Math.round(seat.x), y: Math.round(seat.y), row: seat.row, col: seat.col, color: seat.color, className: seat.className, depth: seat.depth })) },
      canvasSearch: { candidateCount: elements.canvasSearch.candidates.length, reports: elements.canvasSearch.reports.map((report) => ({ legendCount: report.legendCount, error: report.error })) },
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
      scanStats: settings.scanStats,
      rotation: rotationState,
      execution: executionState,
      interpark: { state: elements.interpark.state, waitingPeople: elements.interpark.waitingPeople, areaCount: elements.interpark.areas.length, availableSeatCount: elements.interpark.seats.length },
      recognized: { areas: elements.areaButtons.length, seats: elements.seatSearch.candidates.length + elements.canvasSearch.candidates.length, next: elements.nextButtons.length },
      areaRecommendation: elements.areaAnalysis.recommended.map((area) => ({ label: area.label, category: area.type, score: area.score })),
      seatRecommendation: elements.seatAnalysis.recommended.map((seat) => ({ label: seat.label, score: seat.score })),
      map: elements.map,
      iframes: elements.iframes,
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
    const unknownAreas = elements.areaAnalysis.unknown.join('、') || '无';
    const canvasInfo = `Canvas 区域 ${elements.canvasSearch.candidates.length} · ${elements.canvasSearch.reports.map((report) => report.error || `图例${report.legendCount}`).join('；') || '无 Canvas'}`;
    const domSeatInfo = `Interpark DOM 座位 ${elements.domSeatSearch.candidates.length} · iframe ${elements.domSeatSearch.iframeCount}`;
    const filteredSeatInfo = `符合设置 ${elements.filteredSeatSearch.candidates.length} · 推荐 ${elements.filteredSeatSearch.recommended.map((seat) => `${seat.region} ${seat.row || ''}-${seat.number || ''}`).join('、') || '无'}`;
    const seatSearchInfo = `候选 ${elements.seatSearch.candidates.length} · button ${elements.seatSearch.sources.buttons} · area ${elements.seatSearch.sources.areas} · svg rect ${elements.seatSearch.sources.svgRects} · canvas ${elements.seatSearch.sources.canvases} · iframe ${elements.seatSearch.sources.iframes}`;
    const executionInfo = `当前座位 ${executionState.currentSeat || '—'} · 点击 ${executionState.clickCount} · 换区 ${executionState.rotationCount} · 最后成功 ${executionState.lastSuccessAt ? new Date(executionState.lastSuccessAt).toLocaleTimeString() : '—'} · 已选 ${executionState.selectedSeatCount} · 座位失败 ${executionState.seatFailureCount} · 验证 ${(executionState.lastVerification || []).join('/') || '等待中'}`;
    const rotationInfo = `检测区域 ${rotationState.currentArea || '—'} · 下一步 ${rotationState.nextArea || '—'} · 失败 ${rotationState.failureCount} · 发现座位 ${rotationState.seatFoundAt ? new Date(rotationState.seatFoundAt).toLocaleTimeString() : '—'}`;
    const interparkInfo = `${elements.interpark.state.type} · ${elements.interpark.state.source} · 等待人数 ${elements.interpark.waitingPeople ?? '未识别'} · 区域 ${elements.interpark.areas.length} · 可选座位 ${elements.interpark.seats.length}`;
    const areaRecommendation = elements.areaAnalysis.recommended.map((area) => `${escapeHtml(area.label || '区域')} [${area.type}] (${area.score})`).join('、') || '未找到';
    const recommendation = elements.seatAnalysis.recommended.map((seat) => `${escapeHtml(seat.label || '座位')} (${seat.score})`).join('、') || '未找到';
    const maps = `Canvas ${elements.map.canvases.length} · SVG ${elements.map.svgCount} · iframe ${elements.map.iframeCount} · 图片地图 ${elements.map.imageMapCount}`;
    const canvasColors = elements.map.canvases.flatMap((canvas) => canvas.colors.slice(0, 3).map((color) => `${color.state}:${color.color} (${color.samples})`)).join('、') || '无可读 Canvas 颜色';
    const scanInfo = settings.scanStats ? `扫描 #${settings.scanStats.count || 0} · 页面变化 ${settings.scanStats.pageChanges || 0} · 当前 ${settings.scanStats.currentInterval || detectionStrategy.nextDelay()}ms` : '扫描统计初始化中';
    const frameTree = elements.interpark.frames.map((frame) => `深度${frame.depth} ${frame.accessible ? '可访问' : '不可访问'} · 区域${frame.areaCount} · 座位${frame.seatCount}`).join('；');
    const iframeDetails = elements.iframes.map((frame) => `#${frame.index} ${frame.accessible ? '可访问' : '跨域不可访问'} · 元素 ${frame.elements} · SVG ${frame.svg} · Canvas ${frame.canvas} · 区域 ${frame.seatAreas}`).join('；') || '未检测到 iframe';
    const dom = [...elements.dom.areas, ...elements.dom.seats, ...elements.dom.next].map((item) => `<li>${escapeHtml(item)}</li>`).join('') || '<li>未识别到目标 DOM 元素</li>';
    debugRoot.innerHTML = `<strong>Smart Ticket 调试</strong><span>${status} · ${statusPayload(elements).elapsed}</span><dl><div><dt>区域按钮</dt><dd>${elements.areaButtons.length}</dd></div><div><dt>座位元素</dt><dd>${elements.seats.length}</dd></div><div><dt>下一步按钮</dt><dd>${elements.nextButtons.length}</dd></div></dl><p>Interpark：${escapeHtml(interparkInfo)}</p><p>座位图：${escapeHtml(maps)}</p><p>Canvas：${escapeHtml(canvasColors)}</p><p>扫描：${escapeHtml(scanInfo)}</p><p>换区：${escapeHtml(rotationInfo)}</p><p>执行：${escapeHtml(executionInfo)}</p><p>模板：${escapeHtml(elements.areaAnalysis.templateName || '未选择')} · 未知区域：${escapeHtml(unknownAreas)}</p><p>推荐区域：${areaRecommendation}</p><p>iframe：${escapeHtml(iframeDetails)}</p><p>iframe 深度：${escapeHtml(frameTree || '无')}</p><p>座位搜索：${escapeHtml(seatSearchInfo)}</p><p>Interpark DOM：${escapeHtml(domSeatInfo)}</p><p>筛选：${escapeHtml(filteredSeatInfo)}</p><p>Canvas 坐标：${escapeHtml(canvasInfo)}</p><p>推荐座位：${recommendation}</p><details><summary>识别 DOM 结构</summary><ul>${dom}</ul></details><ol>${latest}</ol>`;
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
  async function verifySeatClick(elements) {
    if (!pendingSeatClick) return false;
    const verification = globalThis.STASeatClickEngine.verifySelection(pendingSeatClick.beforeState, pendingSeatClick.labels);
    if (verification.success) {
      executionState.currentSeat = pendingSeatClick.labels.join(', ');
      executionState.lastSuccessAt = Date.now();
      executionState.selectedSeatCount = verification.after.selectedCount;
      executionState.lastVerification = verification.conditions;
      selectionComplete = true;
      await appendLog(`座位点击成功：${executionState.currentSeat}；${verification.conditions.join('、')}`);
      return true;
    }
    if (Date.now() - pendingSeatClick.startedAt >= 2500) {
      executionState.seatFailureCount = (executionState.seatFailureCount || 0) + 1;
      const detail = globalThis.STASeatClickEngine.diagnose(pendingSeatClick.candidates?.[0]?.element);
      await appendLog(`[Seat Finder] 点击失败：${pendingSeatClick.labels.join(', ')}；原因：Selected Seats 未出现座位号；节点 ${detail.tag || '未知'}，iframe ${detail.inIframe ? '是' : '否'}，SVG ${detail.svg ? '是' : '否'}，onclick ${detail.onclick ? '有' : '无'}，seat函数 ${detail.seatFunctions.join('/') || '无'}；5秒后重新扫描当前区域`);
      const wasCanvasClick = pendingSeatClick.canvas;
      pendingSeatClick = null;
      seatRetryUntil = Date.now() + 5000;
      if (wasCanvasClick) forceAreaRotation = true;
    }
    return false;
  }
  async function assist(elements) {
    if (selectionComplete) return;
    areaRotation.configure(elements.areaAnalysis.ranked, settings.maxCycles);
    executionState.selectedSeatCount = elements.selectedSeatCount;
    const hasAvailableSeats = elements.filteredSeatSearch.candidates.length > 0 || (elements.canvasSearch.candidates.length > 0 && !settings.ticketGrades.length && !settings.seatAreas && !settings.seatFloors.length);
    const decision = areaRotation.next({ hasAvailableSeats: hasAvailableSeats && !forceAreaRotation });
    rotationState = areaRotation.snapshot();
    executionState.rotationCount = rotationState.rotationCount;
    if (settings.testMode || !settings.enabled || pendingSeatClick || Date.now() < seatRetryUntil || isSensitive() || status === '等待页面' || status === '信息填写页面') return;
    if (hasAvailableSeats && settings.autoSelectSeats && !forceAreaRotation) {
      const beforeState = globalThis.STASeatClickEngine.selectionState();
      const candidates = elements.filteredSeatSearch.recommended;
      await appendLog(`[Seat Finder] 条件：${(settings.ticketGrades || []).join('/') || '任意票档'}，区域:${settings.seatAreas || '任意'}，数量:${settings.quantity}；发现:${candidates.map((seat) => `${seat.region || '未知'} ${seat.row || ''} ${seat.number || ''}`).join('、') || '无'}`);
      const clickedSeats = globalThis.STASeatClickEngine.selectRecommended(candidates, settings.quantity);
      if (clickedSeats.length) {
        executionState.currentSeat = clickedSeats.join(', ');
        executionState.clickCount += clickedSeats.length;
        pendingSeatClick = { labels: clickedSeats, candidates, beforeState, startedAt: Date.now(), canvas: false };
        await appendLog(`找到座位：${executionState.currentSeat}；点击结果：等待 Selected Seats 确认`);
        return;
      }
      const canvasCandidate = elements.canvasSearch.candidates[0];
      if (canvasCandidate) {
        const result = globalThis.STACanvasSeatEngine.click(canvasCandidate);
        if (result.ok) {
          executionState.currentSeat = `${result.label} @ (${result.coordinate.x}, ${result.coordinate.y})`;
          executionState.clickCount += 1;
          pendingSeatClick = { labels: [result.label], beforeState, startedAt: Date.now(), canvas: true, coordinate: result.coordinate };
          await appendLog(`找到区域坐标：${result.label} (${result.coordinate.x}, ${result.coordinate.y})；点击坐标成功，等待 Selected Seats 确认`);
        } else await appendLog(`Canvas 坐标点击失败：${result.reason}`);
      }
      return;
    }
    if (!settings.autoClick || !settings.autoRotate || Date.now() < areaLoadingUntil) return;
    if (decision.action === 'idle' && status === '座位选择页面' && elements.interpark.backButton) {
      const back = globalThis.STAAreaClickEngine.click(elements.interpark.backButton);
      if (back.ok) { areaLoadingUntil = Date.now() + 2000; await appendLog('当前区域无票，返回区域选择继续查找'); }
      return;
    }
    if (decision.action !== 'rotate') return;
    const result = globalThis.STAAreaClickEngine.click(decision.candidate.element);
    if (result.ok) {
      areaLoadingUntil = Date.now() + 2000;
      forceAreaRotation = false;
      await appendLog(`尝试区域：${decision.currentArea}；等待座位加载，无票时将切换至 ${rotationState.nextArea || '首个候选区域'}`);
    } else {
      areaRotation.clickedFailed();
      rotationState = areaRotation.snapshot();
      executionState.rotationCount = rotationState.rotationCount;
      await appendLog(`区域点击失败：${decision.currentArea}（冷却后继续）`);
    }
  }
  function scheduleScan(reason, immediate = false) {
    if (selectionComplete) return;
    if (scanTimer && !immediate) return;
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(runScan, immediate ? 0 : detectionStrategy.nextDelay());
  }
  function queueMutationScan() {
    if (mutationTimer) return;
    mutationTimer = setTimeout(() => {
      mutationTimer = null;
      if (Date.now() - lastScanAt > 500) scheduleScan('dom-change', true);
    }, 250);
  }
  async function recordScan(signals) {
    const scanStats = detectionStrategy.record(signals);
    const current = (await chrome.storage.local.get(KEY))[KEY] || settings;
    settings = { ...current, scanStats, logs: [{ at: scanStats.lastAt, message: `扫描 #${scanStats.count} · ${scanStats.currentInterval}ms · 页面变化 ${scanStats.pageChanges}` }, ...(current.logs || [])].slice(0, 100) };
    await chrome.storage.local.set({ [KEY]: settings });
  }
  function debugDomSeats(search) {
    if (!settings.debugMode) return;
    const signature = search.candidates.map((seat) => `${Math.round(seat.x)}:${Math.round(seat.y)}:${seat.color}`).join('|');
    if (signature === lastDomSeatSignature) return;
    lastDomSeatSignature = signature;
    const first = search.candidates[0];
    console.group('[InterparkSeat]');
    console.info('count:', search.candidates.length);
    console.info('firstSeat:', first?.element || null);
    console.info('color:', first?.color || null);
    console.info('position:', first ? { x: Math.round(first.x), y: Math.round(first.y), row: first.row, col: first.col } : null);
    console.info('iframe:', first?.iframe || null);
    console.info('筛选后可购买座位:', search.candidates.length);
    console.table(search.candidates.map((seat) => ({ x: Math.round(seat.x), y: Math.round(seat.y), row: seat.row, col: seat.col, color: seat.color, className: seat.className, iframe: seat.iframe, iframeDepth: seat.depth, label: seat.label })));
    console.groupEnd();
  }
  async function runScan() {
    scanTimer = null;
    lastScanAt = Date.now();
    const elements = detectElements();
    const nextStatus = classify(elements);
    debugDomSeats(elements.domSeatSearch);
    if (await verifySeatClick(elements)) { renderDebug(elements); if (window.top === window) sendStatus(elements); return; }
    const keywords = [...settings.priorityAreas, ...settings.fallbackAreas];
    const found = !isSensitive() && elements.areaButtons.some((element) => matches(keywords, element));
    const fingerprint = JSON.stringify({ status: nextStatus, found, seats: elements.seatAnalysis.available, areas: elements.areaButtons.length });
    const changed = fingerprint !== lastFingerprint;
    const enteredSeatSelection = nextStatus === '座位选择页面' && status !== '座位选择页面';
    const seatCountChanged = lastFingerprint && JSON.parse(lastFingerprint).seats !== elements.seatAnalysis.available;
    lastFingerprint = fingerprint;
    if (nextStatus !== status) {
      status = nextStatus;
      enteredAt = Date.now();
      const current = (await chrome.storage.local.get(KEY))[KEY] || settings;
      settings = { ...current, history: [{ at: enteredAt, status, url: location.href }, ...(current.history || [])].slice(0, 100) };
      await chrome.storage.local.set({ [KEY]: settings });
      await appendLog(`页面状态：${status}`);
    }
    if (found && !available) {
      await appendLog('发现可选择的目标区域');
      playTargetTone();
      chrome.runtime.sendMessage({ type: 'STA_TARGET_FOUND', area: matches(keywords, elements.areaButtons.find((element) => matches(keywords, element))) }).catch(() => {});
    }
    available = found;
    await recordScan({ pageChanged: changed, enteredSeatSelection, targetFound: found, seatCountChanged, noAvailableSeats: !found && elements.seatSearch.candidates.length === 0 });
    renderDebug(elements);
    reportFrameDiagnostic(elements);
    if (window.top === window) sendStatus(elements);
    assist(elements);
    scheduleScan('poll');
  }

  function reportFrameDiagnostic(elements) {
    chrome.runtime.sendMessage({ type: 'STA_FRAME_DIAGNOSTIC', payload: { url: location.href, accessible: true, pageType: status, interparkState: elements.interpark.state.type, interparkSource: elements.interpark.state.source, waitingPeople: elements.interpark.waitingPeople, elementCount: document.querySelectorAll('*').length, canvas: elements.map.canvases.length, svg: elements.map.svgCount, childIframes: elements.iframes.length, areaButtons: elements.areaButtons.length, recommendedAreas: elements.areaAnalysis.recommended.length, availableSeats: elements.seatAnalysis.available } }).catch(() => {});
  }

  chrome.storage.local.get(KEY).then((stored) => { settings = { ...defaults, ...(stored[KEY] || {}) }; detectionStrategy = globalThis.STADetectionStrategy.create(settings); scheduleScan('initial', true); });
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes[KEY]) { settings = { ...defaults, ...changes[KEY].newValue }; detectionStrategy.configure(settings); scheduleScan('settings'); } });
  new MutationObserver(() => { if (!suppressObserver) queueMutationScan(); }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'disabled', 'aria-disabled', 'title'] });
  ['pushState', 'replaceState'].forEach((method) => { const original = history[method]; history[method] = function (...args) { const result = original.apply(this, args); queueMicrotask(() => scheduleScan('navigation', true)); return result; }; });
  addEventListener('popstate', () => scheduleScan('navigation', true));
  addEventListener('hashchange', () => scheduleScan('navigation', true));
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message.type === 'STA_STATUS_REQUEST') respond(statusPayload());
    if (message.type === 'STA_SCAN_SEAT_MAP') { lastMapAnalysisAt = 0; const elements = detectElements(); renderDebug(elements); respond({ status: statusPayload(elements), report: buildReport(elements) }); }
    if (message.type === 'STA_EXPORT_ANALYSIS') respond(buildReport());
  });
})();
