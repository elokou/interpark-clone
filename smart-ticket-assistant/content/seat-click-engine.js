(() => {
  const selected = (element) => /selected|chosen|active|on|선택/i.test(`${element.className} ${element.getAttribute('aria-selected')} ${element.getAttribute('aria-pressed')}`);
  const blocked = (element) => !element?.isConnected || element.disabled || element.getAttribute('aria-disabled') === 'true' || /sold|unavailable|disabled|locked|매진|판매완료|선택불가|lock/i.test(`${element.className} ${element.getAttribute('aria-disabled')}`);
  const enabled = (element) => Boolean(element) && !element.disabled && element.getAttribute('aria-disabled') !== 'true' && !/disabled|off/i.test(`${element.className}`);
  const textOf = (element) => `${element?.innerText || element?.textContent || ''} ${element?.getAttribute?.('aria-label') || ''}`.replace(/\s+/g, ' ').trim();
  function selectionState(documentRef = document) {
    const selectedElements = [...documentRef.querySelectorAll('[aria-selected="true"], [aria-pressed="true"], [class*="selected" i], [class*="chosen" i], [class*="seat_on" i]')].filter((element) => element.getBoundingClientRect().width > 0);
    const selectedLists = [...documentRef.querySelectorAll('[id*="SelectedSeat" i], [class*="selected-seat" i], [class*="selectedSeat" i], [id*="selected" i]')];
    const completed = [...documentRef.querySelectorAll('button, [role="button"]')].find((element) => /seat selection completed|selection completed|좌석선택 완료|선택완료/i.test(textOf(element)));
    const next = [...documentRef.querySelectorAll('#btnNext, #btnNextStep, [id*="Next" i], [class*="btn_next" i], [class*="next" i], button[type="submit"]')].find((element) => /next|다음|계속|완료/i.test(textOf(element)) || element.id === 'btnNext');
    return { selectedCount: selectedElements.length, selectedText: selectedLists.map(textOf).join(' '), completedEnabled: enabled(completed), nextEnabled: enabled(next) };
  }
  function dispatchClick(element) {
    if (blocked(element) || selected(element)) return { ok: false, reason: '座位不可点击或已选中' };
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    const view = element.ownerDocument.defaultView || window;
    ['mousedown', 'mouseup', 'click'].forEach((type) => element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, view, button: 0, buttons: type === 'mousedown' ? 1 : 0 })));
    return { ok: true, label: textOf(element) };
  }
  function selectRecommended(recommended, quantity) {
    const selectedSeats = [];
    for (const seat of recommended) { if (selectedSeats.length < quantity) { const result = dispatchClick(seat.element); if (result.ok) selectedSeats.push(result.label || '座位'); } }
    return selectedSeats;
  }
  function verifySelection(before, labels, documentRef = document) {
    const after = selectionState(documentRef);
    const conditions = [];
    if (after.selectedCount > before.selectedCount) conditions.push('Selected Seats 数量增加');
    if (labels.some((label) => label && after.selectedText.includes(label))) conditions.push('Selected Seats 列表出现座位编号');
    if (after.completedEnabled && !before.completedEnabled) conditions.push('座位选择完成按钮已启用');
    if (after.nextEnabled && !before.nextEnabled) conditions.push('下一步按钮已启用');
    return { success: conditions.length >= 2, conditions, after };
  }
  globalThis.STASeatClickEngine = Object.freeze({ dispatchClick, selectRecommended, selectionState, verifySelection, isSelected: selected });
})();
