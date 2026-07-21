(() => {
  const unavailable = /sold|unavailable|disabled|locked|매진|판매완료|선택불가|lock/i;
  const textOf = (element) => `${element.innerText || ''} ${element.getAttribute('aria-label') || ''} ${element.title || ''}`.replace(/\s+/g, ' ').trim();
  const unique = (elements) => [...new Set(elements)].filter((element) => element instanceof HTMLElement && element.isConnected);
  const visible = (element) => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; };
  const source = (name, element) => ({ element, label: textOf(element), source: name });

  function getPageState() {
    const page = document.body?.innerText || '';
    if (/queue|waiting|대기|예매 대기|접속 대기/i.test(page)) return { type: 'waiting', source: 'Interpark waiting keywords' };
    if (getSeats().length || /seat|좌석/i.test(page)) return { type: 'seat', source: 'Interpark seat controls' };
    if (getAreas().length || /seat grade|좌석등급|구역 선택/i.test(page)) return { type: 'area', source: 'Interpark area controls' };
    return { type: 'unknown', source: 'No Interpark-specific marker' };
  }
  function getWaitingPeople() {
    const text = document.body?.innerText || '';
    const match = text.match(/(?:대기(?:人数|인원)?|waiting(?: | )*(?:people|users|number)?)\D{0,18}([\d,]+)/i);
    return match ? Number(match[1].replace(/,/g, '')) : null;
  }
  function getAreas(documentRef = document) {
    const selector = '#divSeatGrade button, #divSeatGrade a, [id*="SeatGrade" i], [id*="SeatArea" i], [class*="seat_grade" i], [class*="seat_area" i], [data-area], [data-section]';
    return unique([...documentRef.querySelectorAll(selector)]).filter((element) => visible(element) && !unavailable.test(`${element.className} ${textOf(element)}`)).map((element) => source('Interpark area selector', element));
  }
  function getSeats(documentRef = document) {
    const selector = '#divSeatArray [id*="Seat" i], #divSeatArray [class*="seat" i], [data-seat], [data-seat-no], [aria-label*="좌석"]';
    return unique([...documentRef.querySelectorAll(selector)]).filter((element) => visible(element) && !unavailable.test(`${element.className} ${element.getAttribute('aria-disabled')} ${textOf(element)}`)).map((element) => source('Interpark seat selector', element));
  }
  function getSelectedSeatCount(documentRef = document) {
    return unique([...documentRef.querySelectorAll('[aria-selected="true"], [aria-pressed="true"], [class*="selected" i], [class*="chosen" i], [class*="seat_on" i]')]).filter(visible).length;
  }
  function getAreaBackButton(documentRef = document) {
    return unique([...documentRef.querySelectorAll('button, a, [role="button"]')]).find((element) => visible(element) && /seat grade|area selection|좌석등급|구역 선택|이전|back/i.test(textOf(element))) || null;
  }
  function getFrameTree(documentRef = document, depth = 0, frames = []) {
    const areas = getAreas(documentRef);
    const seats = getSeats(documentRef);
    frames.push({ depth, url: documentRef.location?.href || null, accessible: true, elementCount: documentRef.querySelectorAll('*').length, areaCount: areas.length, seatCount: seats.length });
    for (const frame of documentRef.querySelectorAll('iframe')) {
      try { if (frame.contentDocument) getFrameTree(frame.contentDocument, depth + 1, frames); }
      catch { frames.push({ depth: depth + 1, url: frame.src || null, accessible: false, elementCount: 0, areaCount: 0, seatCount: 0 }); }
    }
    return { frames };
  }
  globalThis.STAInterparkAdapter = Object.freeze({ getPageState, getWaitingPeople, getAreas, getSeats, getSelectedSeatCount, getAreaBackButton, getFrameTree });
})();
