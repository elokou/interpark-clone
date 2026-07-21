(() => {
  const unavailable = /sold|unavailable|disabled|locked|매진|판매완료|선택불가|lock/i;
  const AREA_PATTERN = /\b(?:VIP|R|S)\b|\b[1-4]F\b|\b(?:F|E|S)\d{1,2}\b|좌석|seat|구역|area|zone/i;
  const textOf = (element) => `${element.innerText || element.textContent || ''} ${element.getAttribute('aria-label') || ''} ${element.title || ''}`.replace(/\s+/g, ' ').trim();
  const visible = (element) => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; };
  const available = (element) => visible(element) && !unavailable.test(`${element.className} ${element.getAttribute('aria-disabled')} ${textOf(element)}`);

  /** Return every same-origin document, including nested seat-map iframes. */
  function documents(documentRef = document, depth = 0, iframe = null, output = []) {
    output.push({ document: documentRef, depth, iframe, url: documentRef.location?.href || iframe?.src || null });
    for (const child of documentRef.querySelectorAll('iframe')) {
      try { if (child.contentDocument) documents(child.contentDocument, depth + 1, child, output); }
      catch { output.push({ document: null, depth: depth + 1, iframe: child, url: child.src || null, accessible: false }); }
    }
    return output;
  }
  const source = (name, element, context) => ({ element, label: textOf(element), source: name, iframe: context.url, frameDepth: context.depth });

  function areasIn(context) {
    const doc = context.document;
    if (!doc) return [];
    const selector = [
      '#divAvailableSeat button', '#divAvailableSeat a', '#divSeatGrade button', '#divSeatGrade a',
      '[id*="AvailableSeat" i] button', '[class*="available" i] button',
      '[id*="SeatGrade" i]', '[id*="SeatArea" i]', '[class*="seat_grade" i]', '[class*="seat_area" i]',
      '[data-area]', '[data-section]', 'map area[alt]', 'map area[title]'
    ].join(', ');
    return [...doc.querySelectorAll(selector)].filter((element) => available(element) && AREA_PATTERN.test(textOf(element))).map((element) => source('Interpark available-area selector', element, context));
  }
  function seatsIn(context) {
    const doc = context.document;
    if (!doc) return [];
    const selector = '#divSeatArray [id*="Seat" i], #divSeatArray [class*="seat" i], [data-seat], [data-seat-no], [aria-label*="좌석"]';
    return [...doc.querySelectorAll(selector)].filter(available).map((element) => source('Interpark seat selector', element, context));
  }
  function getAreas(documentRef = document) {
    const byElement = new Map();
    documents(documentRef).forEach((context) => areasIn(context).forEach((area) => byElement.set(area.element, area)));
    return [...byElement.values()];
  }
  function getSeats(documentRef = document) {
    const byElement = new Map();
    documents(documentRef).forEach((context) => seatsIn(context).forEach((seat) => byElement.set(seat.element, seat)));
    return [...byElement.values()];
  }
  function selectedSeatLists(documentRef = document) {
    const lists = [];
    documents(documentRef).forEach((context) => {
      if (!context.document) return;
      context.document.querySelectorAll('[id*="SelectedSeat" i], [class*="selected-seat" i], [class*="selectedSeat" i], [id*="selected" i]').forEach((element) => lists.push({ element, text: textOf(element), iframe: context.url, frameDepth: context.depth }));
    });
    return lists;
  }
  function getSelectedSeatCount(documentRef = document) {
    let count = 0;
    documents(documentRef).forEach((context) => {
      if (!context.document) return;
      count += [...context.document.querySelectorAll('[aria-selected="true"], [aria-pressed="true"], [class*="selected" i], [class*="chosen" i], [class*="seat_on" i]')].filter(visible).length;
    });
    return count;
  }
  function findButton(documentRef, pattern) {
    for (const context of documents(documentRef)) {
      if (!context.document) continue;
      const element = [...context.document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]')].find((node) => available(node) && pattern.test(textOf(node)));
      if (element) return { element, iframe: context.url, frameDepth: context.depth };
    }
    return null;
  }
  function getAreaBackButton(documentRef = document) { return findButton(documentRef, /seat grade|area selection|좌석등급|구역 선택|이전|back/i)?.element || null; }
  function getSeatCompletionButton(documentRef = document) { return findButton(documentRef, /seat selection completed|selection completed|좌석선택 완료|선택완료/i)?.element || null; }
  function getPageState() {
    const docs = documents();
    const page = docs.filter((item) => item.document).map((item) => item.document.body?.innerText || '').join(' ');
    if (/queue|waiting|대기|예매 대기|접속 대기/i.test(page)) return { type: 'waiting', source: 'Interpark waiting keywords' };
    if (getSeats().length || /seat|좌석/i.test(page)) return { type: 'seat', source: 'Interpark seat controls / iframe content' };
    if (getAreas().length || /seat grade|좌석등급|구역 선택/i.test(page)) return { type: 'area', source: 'Interpark available-area controls / iframe content' };
    return { type: 'unknown', source: 'No Interpark-specific marker' };
  }
  function getWaitingPeople() {
    const text = documents().filter((item) => item.document).map((item) => item.document.body?.innerText || '').join(' ');
    const match = text.match(/(?:대기(?:人数|인원)?|waiting(?: | )*(?:people|users|number)?)\D{0,18}([\d,]+)/i);
    return match ? Number(match[1].replace(/,/g, '')) : null;
  }
  function getFrameTree(documentRef = document) {
    return { frames: documents(documentRef).map((context) => context.document ? ({ depth: context.depth, url: context.url, accessible: true, elementCount: context.document.querySelectorAll('*').length, areaCount: areasIn(context).length, seatCount: seatsIn(context).length }) : ({ depth: context.depth, url: context.url, accessible: false, elementCount: 0, areaCount: 0, seatCount: 0 })) };
  }
  globalThis.STAInterparkAdapter = Object.freeze({ documents, getPageState, getWaitingPeople, getAreas, getSeats, selectedSeatLists, getSelectedSeatCount, getAreaBackButton, getSeatCompletionButton, getFrameTree });
})();
