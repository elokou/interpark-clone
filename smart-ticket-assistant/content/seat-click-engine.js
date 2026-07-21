(() => {
  const selected = (element) => /selected|chosen|active|on|선택/i.test(`${element.className} ${element.getAttribute('aria-selected')} ${element.getAttribute('aria-pressed')}`);
  const blocked = (element) => !element?.isConnected || element.disabled || element.getAttribute('aria-disabled') === 'true' || /sold|unavailable|disabled|locked|매진|판매완료|선택불가|lock/i.test(`${element.className} ${element.getAttribute('aria-disabled')}`);
  const enabled = (element) => Boolean(element) && !element.disabled && element.getAttribute('aria-disabled') !== 'true' && !/disabled|off/i.test(`${element.className}`);
  const textOf = (element) => `${element?.innerText || element?.textContent || ''} ${element?.getAttribute?.('aria-label') || ''} ${element?.title || ''}`.replace(/\s+/g, ' ').trim();
  const allDocuments = () => globalThis.STAInterparkAdapter?.documents?.().filter((item) => item.document).map((item) => item.document) || [document];
  function selectionState() {
    const docs = allDocuments();
    const selectedElements = docs.flatMap((doc) => [...doc.querySelectorAll('[aria-selected="true"], [aria-pressed="true"], [class*="selected" i], [class*="chosen" i], [class*="seat_on" i]')]).filter((element) => element.getBoundingClientRect().width > 0);
    const lists = globalThis.STAInterparkAdapter?.selectedSeatLists?.() || docs.flatMap((doc) => [...doc.querySelectorAll('[id*="SelectedSeat" i], [class*="selected-seat" i], [class*="selectedSeat" i], [id*="selected" i]')].map((element) => ({ element, text: textOf(element) })));
    const completed = globalThis.STAInterparkAdapter?.getSeatCompletionButton?.() || null;
    const next = docs.flatMap((doc) => [...doc.querySelectorAll('#btnNext, #btnNextStep, [id*="Next" i], [class*="btn_next" i], [class*="next" i], button[type="submit"]')]).find((element) => /next|다음|계속|완료/i.test(textOf(element)) || element.id === 'btnNext');
    return { selectedCount: selectedElements.length, selectedText: lists.map((list) => list.text).join(' '), completedEnabled: enabled(completed), nextEnabled: enabled(next), documents: docs.length };
  }
  function dispatchClick(element) {
    if (blocked(element) || selected(element)) return { ok: false, reason: '座位不可点击或已选中' };
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    const view = element.ownerDocument.defaultView || window;
    ['mousedown', 'mouseup', 'click'].forEach((type) => element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, view, button: 0, buttons: type === 'mousedown' ? 1 : 0 })));
    try { element.click?.(); } catch { /* The real event dispatch above remains the primary click path. */ }
    return { ok: true, label: textOf(element), element, iframe: element.ownerDocument.location?.href || null };
  }
  function selectRecommended(recommended, quantity) {
    const candidates = recommended?.length ? recommended : globalThis.STAInterparkDomSeatEngine?.scan({ quantity }).recommended || [];
    const selectedSeats = [];
    for (const seat of candidates) { if (selectedSeats.length < quantity) { const result = dispatchClick(seat.element); if (result.ok) selectedSeats.push(result.label || seat.label || '座位'); } }
    return selectedSeats;
  }
  function verifySelection(before, labels) {
    const after = selectionState();
    const conditions = [];
    if (after.selectedCount > before.selectedCount) conditions.push('Selected Seats 数量增加');
    if (after.selectedText && (labels.some((label) => label && after.selectedText.includes(label)) || /\b(?:row|seat|좌석)\b/i.test(after.selectedText))) conditions.push('Selected Seats 列表出现座位编号');
    if (after.completedEnabled && !before.completedEnabled) conditions.push('座位选择完成按钮已启用');
    if (after.nextEnabled && !before.nextEnabled) conditions.push('下一步按钮已启用');
    return { success: conditions.includes('Selected Seats 列表出现座位编号') || conditions.length >= 2, conditions, after };
  }
  function completeSelection() {
    const button = globalThis.STAInterparkAdapter?.getSeatCompletionButton?.();
    if (!enabled(button)) return { ok: false, reason: 'Seat selection completed 按钮不可用' };
    const result = dispatchClick(button);
    return result.ok ? { ok: true, label: textOf(button), iframe: result.iframe } : result;
  }
  function diagnose(element) {
    const doc = element?.ownerDocument, view = doc?.defaultView;
    const globals = ['seatSelect', 'selectSeat', 'fnSeatSelect'].filter((name) => typeof view?.[name] === 'function');
    return { tag: element?.tagName || null, iframe: doc?.location?.href || null, inIframe: view?.top !== view, svg: /^(path|rect|circle)$/i.test(element?.tagName || ''), onclick: Boolean(element?.onclick || element?.getAttribute?.('onclick')), seatFunctions: globals };
  }
  globalThis.STASeatClickEngine = Object.freeze({ dispatchClick, selectRecommended, selectionState, verifySelection, completeSelection, diagnose, isSelected: selected });
})();
