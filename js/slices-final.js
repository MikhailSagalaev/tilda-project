// Финальная версия: интерактивные вертикальные слайсы
// Анимация: hover снизу-вверх (bottom 100%→0%), hide вверх (top 0%→100%)
// Click: expand to full, repeat click: обратная анимация
(function() {
  'use strict';

  var CONTAINER_ID = 'interactive-variant-2';
  var DURATION = 450;
  var EASING = 'ease';

  // === Utilities ===
  function getConfig() {
    return Array.isArray(window.SLICES_AUTOGRID_SOURCES) ? window.SLICES_AUTOGRID_SOURCES : [];
  }

  function extractIds(config) {
    var ids = [];
    for (var i = 0; i < config.length; i++) {
      var item = config[i];
      var id = typeof item === 'string' ? item : (item.id || item.recId);
      if (id) ids.push(id);
    }
    return ids;
  }

  function findArtboard(record) {
    return record && (
      record.querySelector('.t396__artboard.rendered') ||
      record.querySelector('.t396__artboard') ||
      record.querySelector('.rec-artboard')
    );
  }

  function isReady() {
    var config = getConfig();
    if (!config.length) return false;
    
    if (!document.getElementById(CONTAINER_ID)) return false;
    
    var ids = extractIds(config);
    for (var i = 0; i < ids.length; i++) {
      var rec = document.getElementById(ids[i]);
      if (!rec || !findArtboard(rec)) return false;
    }
    return true;
  }

  function waitUntilReady(callback, attempts) {
    attempts = attempts || 0;
    if (isReady()) return callback();
    if (attempts > 300) return; // 30 seconds max
    setTimeout(function() { waitUntilReady(callback, attempts + 1); }, 100);
  }

  function createElement(tag, className) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  }

  // === Main Build Function ===
  function build() {
    var container = document.getElementById(CONTAINER_ID);
    var config = getConfig();
    if (!container || !config.length) return;

    // Create DOM structure
    var section = createElement('section', 'slices-portal-section');
    section.style.margin = '0';
    
    var artboard = createElement('div', 'artboard');
    var portal = createElement('div', 'bg-portal');
    var grid = createElement('div', 'slices-grid');
    
    grid.style.gridTemplateColumns = 'repeat(' + config.length + ', 1fr)';
    
    artboard.appendChild(portal);
    artboard.appendChild(grid);
    section.appendChild(artboard);
    container.replaceChildren(section);

    // Hide all source recs immediately
    var allRecIds = [];
    for (var i = 0; i < config.length; i++) {
      var item = config[i];
      var recId = typeof item === 'string' ? item : (item.id || item.recId);
      if (recId) allRecIds.push(recId);
    }
    
    // Hide source recs off-screen
    for (var j = 0; j < allRecIds.length; j++) {
      var rec = document.getElementById(allRecIds[j]);
      if (rec) {
        rec.style.position = 'fixed';
        rec.style.left = '-99999px';
        rec.style.top = '-99999px';
        rec.style.width = '0';
        rec.style.height = '0';
        rec.style.overflow = 'hidden';
        rec.style.visibility = 'hidden';
      }
    }

    // Create slices
    for (var i = 0; i < config.length; i++) {
      var item = config[i];
      var recId = typeof item === 'string' ? item : (item.id || item.recId);
      var label = typeof item === 'string' ? ('Item ' + (i + 1)) : (item.label || item.title || ('Item ' + (i + 1)));
      
      var slice = createElement('div', 'slice');
      slice.setAttribute('data-rec', recId);
      slice.setAttribute('data-slice-id', recId);
      
      var caption = createElement('div', 'slice-label');
      caption.textContent = label;
      slice.appendChild(caption);
      grid.appendChild(slice);
    }

    // === State Management ===
    var holders = {};
    var currentHolder = null;
    var openedHolder = null;
    var hideTimeout = null;
    var isAnimating = false; // флаг блокировки во время анимации

    function getHolder(recId) {
      if (holders[recId]) return holders[recId];
      
      var record = document.getElementById(recId);
      if (!record) return null;
      
      var holder = createElement('div', 'bg-holder');
      holder.dataset.recId = recId;
      
      // Restore record visibility and move to holder
      record.style.position = 'absolute';
      record.style.inset = '0';
      record.style.margin = '0';
      record.style.width = '100%';
      record.style.height = '100%';
      record.style.left = '0';
      record.style.top = '0';
      record.style.overflow = 'hidden';
      record.style.visibility = 'visible';
      
      holder.appendChild(record);
      holders[recId] = holder;
      return holder;
    }

    function getSliceBounds(slice) {
      var artRect = artboard.getBoundingClientRect();
      var sliceRect = slice.getBoundingClientRect();
      return {
        left: Math.max(0, Math.round(sliceRect.left - artRect.left)),
        right: Math.max(0, Math.round(artRect.right - sliceRect.right))
      };
    }

    function enableTransition(holder) {
      holder.style.willChange = 'clip-path';
      holder.style.transition = 'clip-path ' + DURATION + 'ms ' + EASING;
    }

    function disableTransition(holder) {
      holder.style.transition = 'none';
    }

    // === Animations ===
    
    // Появление снизу-вверх: скрываем снизу (top=100%), показываем (top=0%)
    function slideUpFromBottom(holder, bounds, callback) {
      holder.dataset.leftBound = String(bounds.left);
      holder.dataset.rightBound = String(bounds.right);
      
      disableTransition(holder);
      // Скрываем снизу: top=100% (весь контент сверху, видно только низ)
      holder.style.clipPath = 'inset(100% ' + bounds.right + 'px 0% ' + bounds.left + 'px)';
      holder.getBoundingClientRect();
      
      enableTransition(holder);
      
      if (callback) {
        function onShow(event) {
          if (event.propertyName !== 'clip-path') return;
          holder.removeEventListener('transitionend', onShow);
          callback();
        }
        holder.addEventListener('transitionend', onShow);
      }
      
      // Показываем: top=0% (контент появляется снизу-вверх)
      holder.style.clipPath = 'inset(0% ' + bounds.right + 'px 0% ' + bounds.left + 'px)';
    }

    // Уход вверх: bottom 0% -> 100%
    function slideUpToTop(holder, callback) {
      var bounds = {
        left: parseInt(holder.dataset.leftBound || '0', 10),
        right: parseInt(holder.dataset.rightBound || '0', 10)
      };
      
      enableTransition(holder);
      
      function onEnd(event) {
        if (event.propertyName !== 'clip-path') return;
        holder.removeEventListener('transitionend', onEnd);
        if (callback) callback();
      }
      
      holder.addEventListener('transitionend', onEnd);
      // Скрываем сверху: bottom=100% (контент уходит вверх)
      holder.style.clipPath = 'inset(0% ' + bounds.right + 'px 100% ' + bounds.left + 'px)';
    }

    // === Event Handlers ===
    
    function handleMouseEnter(slice) {
      if (openedHolder || isAnimating) return; // ignore hover when fullscreen or animating
      
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
      
      var recId = slice.getAttribute('data-rec');
      var holder = getHolder(recId);
      if (!holder) return;
      
      var bounds = getSliceBounds(slice);
      
      if (currentHolder && currentHolder !== holder) {
        // Switch: animate current up, show new from bottom
        var prev = currentHolder;
        slideUpToTop(prev, function() {
          if (prev.parentNode === portal) portal.removeChild(prev);
        });
        
        portal.appendChild(holder);
        currentHolder = holder;
        slideUpFromBottom(holder, bounds);
        
      } else if (!currentHolder) {
        // First show
        portal.appendChild(holder);
        currentHolder = holder;
        slideUpFromBottom(holder, bounds);
        
      } else {
        // Same slice: just update bounds if needed
        holder.style.clipPath = 'inset(0 ' + bounds.right + 'px 0% ' + bounds.left + 'px)';
        holder.dataset.leftBound = String(bounds.left);
        holder.dataset.rightBound = String(bounds.right);
      }
    }

    function handleMouseLeave() {
      if (openedHolder || !currentHolder) return;
      
      hideTimeout = setTimeout(function() {
        hideTimeout = null;
        if (!openedHolder && currentHolder) {
          var holderToHide = currentHolder;
          slideUpToTop(holderToHide, function() {
            if (holderToHide.parentNode === portal) portal.removeChild(holderToHide);
            if (currentHolder === holderToHide) currentHolder = null;
          });
        }
      }, 50);
    }

    function handleClick(slice) {
      if (isAnimating) return; // блокируем клики во время анимации
      
      var recId = slice.getAttribute('data-rec');
      
      if (openedHolder && openedHolder.dataset.recId === recId) {
        // Close: same slice clicked again - возврат к hover состоянию
        isAnimating = true;
        var holder = openedHolder;
        openedHolder = null;
        
        var originalLeft = parseInt(holder.dataset.originalLeftBound || '0', 10);
        var originalRight = parseInt(holder.dataset.originalRightBound || '0', 10);
        
        // Плавное сужение обратно к колонке (остается активным)
        enableTransition(holder);
        
        function onShrinkToColumn(event) {
          if (event.propertyName !== 'clip-path') return;
          holder.removeEventListener('transitionend', onShrinkToColumn);
          
          // Убираем portal-ontop, слайс остается видимым в колонке
          section.classList.remove('portal-ontop');
          
          // Обновляем dataset для hover состояния
          holder.dataset.leftBound = String(originalLeft);
          holder.dataset.rightBound = String(originalRight);
          
          // Слайс остается currentHolder (активным)
          currentHolder = holder;
          isAnimating = false; // разблокируем
        }
        
        holder.addEventListener('transitionend', onShrinkToColumn);
        holder.style.clipPath = 'inset(0% ' + originalRight + 'px 0% ' + originalLeft + 'px)';
        
      } else {
        // Open: expand to fullscreen
        isAnimating = true;
        var holder = getHolder(recId);
        if (!holder) {
          isAnimating = false;
          return;
        }
        
        var bounds = getSliceBounds(slice);
        
        if (!currentHolder) {
          portal.appendChild(holder);
          currentHolder = holder;
        } else if (currentHolder !== holder) {
          var prev = currentHolder;
          slideUpToTop(prev, function() {
            if (prev.parentNode === portal) portal.removeChild(prev);
          });
          portal.appendChild(holder);
          currentHolder = holder;
        }
        
        // Set to column size first
        disableTransition(holder);
        holder.style.clipPath = 'inset(0 ' + bounds.right + 'px 0% ' + bounds.left + 'px)';
        holder.dataset.originalLeftBound = String(bounds.left);
        holder.dataset.originalRightBound = String(bounds.right);
        holder.getBoundingClientRect();
        
        // Then expand to fullscreen
        enableTransition(holder);
        
        function onExpand(event) {
          if (event.propertyName !== 'clip-path') return;
          holder.removeEventListener('transitionend', onExpand);
          isAnimating = false; // разблокируем после расширения
        }
        
        holder.addEventListener('transitionend', onExpand);
        holder.style.clipPath = 'inset(0 0 0 0)';
        
        openedHolder = holder;
        section.classList.add('portal-ontop');
      }
    }

    // === Event Binding ===
    var slices = Array.prototype.slice.call(grid.querySelectorAll('.slice'));
    
    for (var i = 0; i < slices.length; i++) {
      (function(slice) {
        slice.addEventListener('mouseenter', function() { handleMouseEnter(slice); });
        slice.addEventListener('mouseleave', handleMouseLeave);
        slice.addEventListener('click', function() { handleClick(slice); });
      })(slices[i]);
    }

    // Show first slice by default
    if (slices[0]) handleMouseEnter(slices[0]);

    // Global handlers
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape' && openedHolder) {
        // Find which slice corresponds to opened holder
        for (var i = 0; i < slices.length; i++) {
          if (slices[i].getAttribute('data-rec') === openedHolder.dataset.recId) {
            handleClick(slices[i]);
            break;
          }
        }
      }
    });

    artboard.addEventListener('click', function(event) {
      if (openedHolder && !event.target.closest('.slice')) {
        // Find which slice corresponds to opened holder
        for (var i = 0; i < slices.length; i++) {
          if (slices[i].getAttribute('data-rec') === openedHolder.dataset.recId) {
            handleClick(slices[i]);
            break;
          }
        }
      }
    });

    // Resize handling
    var resizeRaf = null;
    window.addEventListener('resize', function() {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(function() {
        resizeRaf = null;
        if (!openedHolder && currentHolder) {
          var hoveredSlice = grid.querySelector('.slice:hover');
          if (hoveredSlice) {
            var bounds = getSliceBounds(hoveredSlice);
            currentHolder.style.clipPath = 'inset(0 ' + bounds.right + 'px 0% ' + bounds.left + 'px)';
            currentHolder.dataset.leftBound = String(bounds.left);
            currentHolder.dataset.rightBound = String(bounds.right);
          }
        }
      });
    });
  }

  // === Initialization ===
  function init() {
    waitUntilReady(build);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
