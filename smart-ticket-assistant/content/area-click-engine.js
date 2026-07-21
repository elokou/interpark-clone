(() => {
  const unavailable = (element) => !element?.isConnected || element.disabled || element.getAttribute('aria-disabled') === 'true' || /disabled|sold|locked|매진|판매완료|선택불가/i.test(`${element.className} ${element.getAttribute('aria-disabled')}`);
  function click(element) {
    if (unavailable(element)) return { ok: false, reason: '区域不可点击' };
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    const view = element.ownerDocument.defaultView || window;
    ['mousedown', 'mouseup', 'click'].forEach((type) => element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, view, button: 0, buttons: type === 'mousedown' ? 1 : 0 })));
    try { element.click?.(); } catch { /* Dispatched pointer events remain the primary area-click path. */ }
    return { ok: true, label: (element.innerText || element.getAttribute('aria-label') || element.title || '').trim() };
  }
  globalThis.STAAreaClickEngine = Object.freeze({ click, isClickable: (element) => !unavailable(element) });
})();
