export const PHIGROS_URL = 'https://tycofficial.github.io/phigros/';

// Preserve normal link behavior for new tabs, downloads and modified clicks.
export function shouldAnimateNavigation(event) {
  return !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}
export function portalTransform(rect, viewport) {
  const width = Math.max(1, viewport.width), height = Math.max(1, viewport.height);
  return `translate(${rect.left}px, ${rect.top}px) scale(${Math.max(1, rect.width) / width}, ${Math.max(1, rect.height) / height})`;
}

export function attachPortal(link, overlay, motionEnabled, { navigate = url => window.location.assign(url) } = {}) {
  let transitioning = false, recoveryTimer = 0, generation = 0;
  const animations = [];
  function reset() {
    generation++;
    clearTimeout(recoveryTimer);animations.splice(0).forEach(a => a.cancel());
    overlay.classList.remove('is-active');overlay.style.removeProperty('transform');
    document.body.classList.remove('is-transitioning');
    link.removeAttribute('aria-busy');transitioning = false;
  }
  async function enter(event) {
    if (!shouldAnimateNavigation(event)) return;
    event.preventDefault();if (transitioning) return;
    if (!motionEnabled() || typeof overlay.animate !== 'function') { navigate(PHIGROS_URL); return; }
    transitioning = true;const attempt=++generation;link.setAttribute('aria-busy', 'true');
    const rect = link.getBoundingClientRect();
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const initialTransform = portalTransform(rect, viewport);
    overlay.style.transform = initialTransform;overlay.classList.add('is-active');
    document.body.classList.add('is-transitioning');
    try {
      const zoom = overlay.animate([
        { transform: initialTransform, borderRadius: '3px', offset: 0 },
        { transform: 'translate(0px, 0px) scale(1, 1)', borderRadius: '0px', offset: 1 }
      ], { duration: 1050, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' });
      animations.push(zoom);
      const title = overlay.querySelector('.transition-center');
      if (title) animations.push(title.animate([{ opacity: 0, translate: '0 20px' }, { opacity: 1, translate: '0 0' }], { duration: 650, delay: 240, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' }));
      const line = overlay.querySelector('.transition-line');
      if (line) animations.push(line.animate([{ scale: '0 1' }, { scale: '1 1' }], { duration: 650, delay: 380, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' }));
      // A timer remains as a fallback if a browser interrupts the animation.
      await Promise.race([zoom.finished.catch(() => {}), new Promise(resolve => setTimeout(resolve, 1300))]);
      if(!transitioning || attempt!==generation)return;
      navigate(PHIGROS_URL);
      // Restore the home page if navigation is blocked by the browser.
      recoveryTimer = setTimeout(reset, 4500);
    } catch { reset(); navigate(PHIGROS_URL); }
  }
  link.addEventListener('click', enter);
  window.addEventListener('pageshow', reset); // Includes Safari's back/forward cache.
  window.addEventListener('pagehide', reset);
  return { reset };
}
