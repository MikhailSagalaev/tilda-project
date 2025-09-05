// Дополнение к js/slices-final.js - исправление race conditions
// Замени функцию handleClick в основном файле на эту версию

function handleClick(slice) {
  if (isAnimating) return; // блокируем клики во время анимации
  
  var recId = slice.getAttribute('data-rec');
  
  if (openedHolder && openedHolder.dataset.recId === recId) {
    // Close: same slice clicked again
    isAnimating = true;
    var holder = openedHolder;
    openedHolder = null;
    
    var originalLeft = parseInt(holder.dataset.originalLeftBound || '0', 10);
    var originalRight = parseInt(holder.dataset.originalRightBound || '0', 10);
    
    // Двухфазное закрытие с блокировкой
    enableTransition(holder);
    holder.style.clipPath = 'inset(0% ' + originalRight + 'px 0% ' + originalLeft + 'px)';
    holder.dataset.leftBound = String(originalLeft);
    holder.dataset.rightBound = String(originalRight);
    
    function onShrink(event) {
      if (event.propertyName !== 'clip-path') return;
      holder.removeEventListener('transitionend', onShrink);
      
      section.classList.remove('portal-ontop');
      
      enableTransition(holder);
      
      function onHide(event) {
        if (event.propertyName !== 'clip-path') return;
        holder.removeEventListener('transitionend', onHide);
        if (holder.parentNode === portal) portal.removeChild(holder);
        currentHolder = null;
        isAnimating = false; // разблокируем только в самом конце
      }
      
      holder.addEventListener('transitionend', onHide);
      holder.style.clipPath = 'inset(0% ' + originalRight + 'px 100% ' + originalLeft + 'px)';
    }
    
    holder.addEventListener('transitionend', onShrink);
    
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

// Также нужно добавить блокировку в handleMouseEnter:
function handleMouseEnter(slice) {
  if (openedHolder || isAnimating) return; // блокируем hover во время анимации
  
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
