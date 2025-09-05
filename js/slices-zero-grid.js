// Скрипт №1 — есть основной Zero‑блок‑сетка и внутренние rec‑задники
(function(){
  const art = document.getElementById('artboard-v1');
  if (!art) return;
  const grid = document.getElementById('slices-grid-v1');
  const portal = document.getElementById('bg-portal-v1');

  // Привязка хранится в data-rec на каждом .slice
  // Пример разметки: <div class="slice" data-slice-id="s1" data-rec="rec-bg-1">
  const defaults = { s1:'rec-bg-1', s2:'rec-bg-2', s3:'rec-bg-3', s4:'rec-bg-4', s5:'rec-bg-5', s6:'rec-bg-6' };

  const cache = {};
  function getHolder(recId){
    if (cache[recId]) return cache[recId];
    const rec = document.getElementById(recId);
    if (!rec) return null;
    const artboard = rec.querySelector('.rec-artboard');
    if (!artboard) return null;
    const holder = document.createElement('div');
    holder.className = 'bg-holder';
    holder.appendChild(artboard.cloneNode(true));
    cache[recId] = holder;
    return holder;
  }

  function clipToSlice(holder, slice){
    const a = art.getBoundingClientRect();
    const r = slice.getBoundingClientRect();
    const left = Math.max(0, Math.round(r.left - a.left) + 1);
    const right = Math.max(0, Math.round(a.right - r.right) + 1);
    holder.style.clipPath = `inset(0 ${right}px 0 ${left}px)`;
  }

  let current = null; let opened = null;
  function show(slice){
    const sliceId = slice.getAttribute('data-slice-id');
    const recId = slice.getAttribute('data-rec') || defaults[sliceId];
    const holder = getHolder(recId);
    if (!holder) return;
    if (current !== holder){
      portal.replaceChildren();
      portal.appendChild(holder);
      current = holder;
    }
    if (!opened){
      clipToSlice(holder, slice);
      holder.classList.add('is-visible');
    }
  }

  function hide(){ if (!opened && current) current.classList.remove('is-visible'); }
  function open(slice){ if (!current) show(slice); if (!current) return; current.classList.add('is-open','is-visible'); opened = current; }
  function close(){ opened = null; if (current){ current.classList.remove('is-open','is-visible'); portal.replaceChildren(); current = null; } }

  const slices = Array.from(grid.querySelectorAll('.slice'));
  const isTouch = window.matchMedia('(hover: none)').matches;
  slices.forEach(sl => {
    if (!isTouch){ sl.addEventListener('mouseenter', () => show(sl)); sl.addEventListener('mouseleave', hide); }
    sl.addEventListener('click', () => open(sl));
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  art.addEventListener('click', e => { if (opened && !e.target.closest('.slice')) close(); });
  window.addEventListener('resize', () => { if (!opened && current){ const hovered = grid.querySelector('.slice:hover'); if (hovered) clipToSlice(current, hovered); } });
})();



