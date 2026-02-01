/**
 * Services Horizontal Scroll - Scroll-driven horizontal page
 *
 * No horizontal scroll at all. Vertical scroll is the only input.
 * As the user scrolls down through the sticky section, cards move left-to-right
 * via transform - like turning pages of a horizontal book.
 *
 * - position: sticky keeps section in view
 * - Scroll position within container maps to translateX on the track
 * - Works on desktop and mobile (native vertical scroll)
 * - No wheel/touch hijacking, no scroll trapping
 */

export function initServicesHorizontalScroll(): void {
  const container = document.getElementById('servicesScrollContainer');
  const wrapper = document.getElementById('servicesScrollWrapper') as HTMLElement | null;
  const track = document.getElementById('servicesTrack') as HTMLElement | null;

  if (!container || !wrapper || !track) return;

  const containerEl = container;
  const wrapperEl = wrapper;
  const trackEl = track;
  let ticking = false;

  /**
   * Update horizontal position based on scroll.
   * Progress 0 = first card, 1 = last card fully visible.
   */
  function updateHorizontalPosition(): void {
    const containerRect = containerEl.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Scroll range: from when container top hits viewport top to when container bottom hits viewport bottom
    const scrollRange = containerEl.offsetHeight - viewportHeight;
    if (scrollRange <= 0) return;

    const maxTranslate = Math.max(0, trackEl.offsetWidth - wrapperEl.clientWidth);
    if (maxTranslate <= 0) return;

    // progress 0 = start (first card), 1 = end (last card)
    // When container.top = 0 we're at start; when container.top = -scrollRange we're at end
    const progress = Math.max(0, Math.min(1, -containerRect.top / scrollRange));
    const translateX = -progress * maxTranslate;

    trackEl.style.transform = `translate3d(${translateX}px, 0, 0)`;
  }

  function onScroll(): void {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateHorizontalPosition();
      ticking = false;
    });
  }

  // Listen to scroll (passive for performance)
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  // Initial position
  updateHorizontalPosition();
}
