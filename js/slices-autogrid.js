// Скрипт №2 — Полностью кодом. Динамически строит сетку и управляет анимацией
// Поведение:
// - hover: появление снизу-вверх в границах колонки; при уходе курсора — уходит вверх
// - click: разворачивает фон на весь блок (прячем сетку/границы); повторный клик — закрытие с уходом вверх
(function(){
  const container = document.getElementById('interactive-variant-2');
  if (!container) return;

  const sourcesRoot = document.getElementById('variant2-sources');
  const cfg = Array.isArray(window.SLICES_AUTOGRID_SOURCES) ? window.SLICES_AUTOGRID_SOURCES : null;

  const sourceItems = collectSources(cfg, sourcesRoot);
  if (!sourceItems.length) return;

  // Build shell
  const section = document.createElement('section');
  section.className = 'slices-portal-section';
  section.style.margin = '0';
  const art = document.createElement('div');
  art.className = 'artboard';
  const portal = document.createElement('div');
  portal.className = 'bg-portal';
  const grid = document.createElement('div');
  grid.className = 'slices-grid';
  grid.style.gridTemplateColumns = `repeat(${sourceItems.length}, 1fr)`;
  art.appendChild(portal);
  art.appendChild(grid);
  section.appendChild(art);
  container.replaceChildren(section);

  // Render slices
  for (let i = 0; i < sourceItems.length; i++) {
    const item = sourceItems[i];
    const slice = document.createElement('div');
    slice.className = 'slice';
    slice.setAttribute('data-slice-id', item.id);
    slice.setAttribute('data-rec', item.id);
    const cap = document.createElement('div'); cap.className = 'slice-label'; cap.textContent = item.label || `item ${i+1}`;
    slice.appendChild(cap);
    grid.appendChild(slice);
  }

  // State
  /** @type {HTMLElement|null} */
  let current = null;  // current holder inside portal
  /** @type {HTMLElement|null} */
  let opened = null;   // opened holder (fullscreen)

  // Cache of holders; we MOVE real recs into holders to preserve #rec styles
  const holderByRecId = new Map();

  function getHolder(recId){
    if (holderByRecId.has(recId)) return holderByRecId.get(recId);
    const rec = document.getElementById(recId) || (sourcesRoot && sourcesRoot.querySelector(`#${CSS.escape(recId)}`));
    if (!rec) return null;
    const holder = document.createElement('div');
    holder.className = 'bg-holder';
    holder.dataset.recId = recId;
    rec.style.position = 'absolute';
    rec.style.inset = '0';
    rec.style.margin = '0';
    rec.style.width = '100%';
    rec.style.height = '100%';
    rec.style.left = '0';
    rec.style.top = '0';
    rec.style.overflow = 'hidden';
    holder.appendChild(rec);
    holderByRecId.set(recId, holder);
    return holder;
  }

  function computeLRForSlice(slice){
    const a = art.getBoundingClientRect();
    const r = slice.getBoundingClientRect();
    return {
      l: Math.max(0, Math.round(r.left - a.left) + 1),
      r: Math.max(0, Math.round(a.right - r.right) + 1),
    };
  }

  function setClipBottom(holder, bottomPercent, lr){
    holder.style.clipPath = `inset(0 ${lr.r}px ${bottomPercent}% ${lr.l}px)`;
    holder.dataset.l = String(lr.l);
    holder.dataset.r = String(lr.r);
    holder.dataset.b = String(bottomPercent);
  }

  function animateFromBottom(holder, lr){
    const prev = holder.style.transition;
    holder.style.transition = 'none';
    setClipBottom(holder, 100, lr); // hidden (from bottom)
    void holder.offsetHeight; // reflow
    holder.style.transition = prev || 'clip-path .45s ease';
    setClipBottom(holder, 0, lr);  // reveal upward
  }

  function animateToTop(holder, after){
    const lr = { l: parseInt(holder.dataset.l || '0', 10), r: parseInt(holder.dataset.r || '0', 10) };
    const onEnd = (ev)=>{
      if (ev.propertyName === 'clip-path'){
        holder.removeEventListener('transitionend', onEnd);
        if (after) after();
      }
    };
    holder.style.transition = holder.style.transition || 'clip-path .45s ease';
    // ensure start at 0%
    setClipBottom(holder, 0, lr);
    void holder.offsetHeight;
    holder.addEventListener('transitionend', onEnd);
    setClipBottom(holder, 100, lr);
  }

  function show(slice){
    if (opened) return; // ignore hover when fullscreen
    const recId = slice.getAttribute('data-rec');
    const holder = getHolder(recId);
    if (!holder) return;
    const lr = computeLRForSlice(slice);
    if (current && current !== holder){
      // animate previous up, then remove it when finished
      const prev = current;
      animateToTop(prev, () => { if (prev.parentNode === portal && current !== prev) portal.removeChild(prev); });
      // append new on top
      portal.appendChild(holder);
      current = holder;
      animateFromBottom(holder, lr);
    } else if (!current) {
      portal.appendChild(holder);
      current = holder;
      animateFromBottom(holder, lr);
    } else {
      // same slice re-hover: just ensure LR
      setClipBottom(holder, 0, lr);
    }
  }

  function hide(){
    if (!opened && current){
      const prev = current;
      animateToTop(prev, () => { if (prev.parentNode === portal && current !== prev) portal.removeChild(prev); else if (current === prev) { portal.removeChild(prev); current = null; } });
    }
  }

  function open(slice){
    const recId = slice.getAttribute('data-rec');
    const holder = getHolder(recId); if(!holder) return;
    const lr = computeLRForSlice(slice);
    if (!current){ portal.appendChild(holder); current = holder; }
    else if (current !== holder){
      // switch with anim: hide old up, then keep new on top
      const prev = current;
      animateToTop(prev, () => { if (prev.parentNode === portal && current !== prev) portal.removeChild(prev); });
      portal.appendChild(holder);
      current = holder;
    }
    // set base clip to 0% and expand to full
    holder.style.transition = 'none';
    setClipBottom(holder, 0, lr);
    void holder.offsetHeight;
    holder.style.transition = 'clip-path .45s ease';
    holder.style.clipPath = 'inset(0 0 0 0)';
    // store original LR for symmetric close
    holder.dataset.ol = String(lr.l);
    holder.dataset.or = String(lr.r);
    opened = holder;
    grid.classList.add('is-hidden');
    section.classList.add('is-full');
  }

  function close(){
    if (!opened) return;
    const holder = opened; opened = null;
    // restore LR and animate bottom to 100%
    const l = parseInt(holder.dataset.ol || holder.dataset.l || '0', 10);
    const r = parseInt(holder.dataset.or || holder.dataset.r || '0', 10);
    holder.style.transition = 'none';
    setClipBottom(holder, 0, { l, r });
    void holder.offsetHeight;
    holder.style.transition = 'clip-path .45s ease';
    animateToTop(holder, () => {
      if (holder.parentNode === portal) portal.removeChild(holder);
      current = null;
      section.classList.remove('is-full');
      grid.classList.remove('is-hidden');
    });
  }

  // Events
  const slices = Array.from(grid.querySelectorAll('.slice'));
  slices.forEach(sl => {
    sl.addEventListener('mouseenter', () => show(sl));
    sl.addEventListener('mouseleave', hide);
    sl.addEventListener('click', () => {
      if (opened && opened.dataset.recId === sl.getAttribute('data-rec')) close();
      else open(sl);
    });
  });

  if (slices[0]) show(slices[0]);

  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  art.addEventListener('click', e => { if (opened && !e.target.closest('.slice')) close(); });

  // Optimize resize — recompute only when hovering
  let resizeRaf = null;
  window.addEventListener('resize', () => {
    if (resizeRaf) return; resizeRaf = requestAnimationFrame(() => {
      resizeRaf = null;
      if (!opened && current){ const hovered = grid.querySelector('.slice:hover'); if (hovered) setHorizontalClip(current, hovered); }
    });
  });

  // Helpers
  function collectSources(cfg, sourcesRoot){
    const out = [];
    if (cfg && cfg.length){
      for (let i=0;i<cfg.length;i++){
        const entry = cfg[i];
        const id = typeof entry === 'string' ? entry : (entry.id || entry.recId);
        const label = typeof entry === 'string' ? null : (entry.label || entry.title || null);
        const rec = id ? document.getElementById(id) : null;
        if (id && rec) out.push({ id, label, rec });
      }
    } else if (sourcesRoot){
      const nodes = Array.from(sourcesRoot.querySelectorAll('.slice-source'));
      for (let i=0;i<nodes.length;i++){
        const node = nodes[i];
        out.push({ id: node.id || `src-${i+1}`, label: node.getAttribute('data-label') || null, rec: node });
      }
    }
    // hide original recs off-screen to avoid flashes
    out.forEach(item => { if (item.rec){ item.rec.style.position='fixed'; item.rec.style.left='-99999px'; item.rec.style.top='-99999px'; item.rec.style.width='0'; item.rec.style.height='0'; item.rec.style.overflow='hidden'; } });
    return out;
  }
})();



