(() => {
  const GROUPS = [
    { key: 'floor', type: '内场', weight: 45, pattern: /floor|standing|arena|vip|\bga\b/i },
    { key: 'first', type: '一层看台', weight: 30, pattern: /\b1f\b|lower|main/i },
    { key: 'second', type: '二层看台', weight: 20, pattern: /\b2f\b/i },
    { key: 'third', type: '三层看台', weight: 10, pattern: /\b3f\b|upper/i }
  ];
  const textOf = (element) => `${element.innerText || ''} ${element.getAttribute('aria-label') || ''} ${element.title || ''}`.replace(/\s+/g, ' ').trim();
  const normal = (value) => value.toLocaleLowerCase();
  const matches = (terms, value) => terms.find((term) => normal(value).includes(normal(term)));
  const classify = (label, template) => {
    const mapped = GROUPS.find((group) => (template?.mappings?.[group.key] || []).some((keyword) => normal(label).includes(normal(keyword))));
    return mapped || GROUPS.find((group) => group.pattern.test(label)) || { type: '未分类', weight: 5 };
  };

  function scoreAreas(elements, settings) {
    const descriptors = elements.map((element) => ({ element, label: textOf(element), rect: element.getBoundingClientRect() }));
    const usable = descriptors.filter((area) => area.rect.width > 0 && area.rect.height > 0);
    const xs = usable.map((area) => area.rect.left + area.rect.width / 2);
    const ys = usable.map((area) => area.rect.top + area.rect.height / 2);
    const centerX = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
    const minY = ys.length ? Math.min(...ys) : 0;
    const ySpan = Math.max(...ys, minY) - minY || 1;
    const template = (settings.templates || []).find((item) => item.id === settings.activeTemplateId);
    const targets = [...(settings.priorityAreas || []), ...(settings.fallbackAreas || [])];
    const excluded = settings.excludedAreas || [];
    const ranked = usable.filter((area) => !matches(excluded, area.label)).map((area) => {
      const group = classify(area.label, template);
      const x = area.rect.left + area.rect.width / 2;
      const y = area.rect.top + area.rect.height / 2;
      const centerScore = /center|central|middle|중앙/i.test(area.label) ? 15 : Math.max(0, 10 - Math.round(Math.abs(x - centerX) / Math.max(area.rect.width, 1)));
      const stageScore = /front|pit|stage|near|앞|전면/i.test(area.label) ? 15 : Math.round((1 - (y - minY) / ySpan) * 10);
      const contiguousScore = settings.quantity > 1 && (/contiguous|pair|연석|연속/i.test(area.label) || Number(area.element.dataset.availableSeats) >= settings.quantity) ? 10 : 0;
      const preferenceIndex = targets.findIndex((term) => normal(area.label).includes(normal(term)));
      const primaryCount = (settings.priorityAreas || []).length;
      const preferenceScore = preferenceIndex < 0 ? 0 : preferenceIndex < primaryCount ? 120 - preferenceIndex * 8 : 60 - (preferenceIndex - primaryCount) * 4;
      return { ...area, type: group.type, score: Math.round(group.weight + centerScore + stageScore + contiguousScore + preferenceScore), factors: { grade: group.weight, center: centerScore, stage: stageScore, contiguous: contiguousScore, preference: preferenceScore } };
    }).sort((a, b) => b.score - a.score);
    return { templateName: template?.name || null, ranked, recommended: ranked.slice(0, 8), unknown: ranked.filter((area) => area.type === '未分类').map((area) => area.label).slice(0, 12), excludedCount: descriptors.length - usable.length + descriptors.filter((area) => matches(excluded, area.label)).length };
  }
  globalThis.STAAreaPriorityEngine = Object.freeze({ scoreAreas });
})();
