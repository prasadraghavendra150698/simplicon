/**
 * Services Horizontal Scroll - Auto-advance when user scrolls into section
 * Wheel scroll in section = horizontal scroll through cards
 * Auto-cycles through all 3 services when section is in view
 */

const SCROLL_SPEED = 2.5;
const AUTO_ADVANCE_MS = 3000;
const CARD_GAP = 32;

export function initServicesHorizontalScroll() {
  const section = document.getElementById('services');
  const wrapper = document.getElementById('servicesScrollWrapper') as HTMLElement | null;
  const track = document.getElementById('servicesTrack');

  if (!section || !wrapper || !track) return;

  let autoAdvanceId: number | null = null;
  let isUserScrolling = false;
  let userScrollTimeout: number | null = null;

  function getScrollState() {
    const rect = section!.getBoundingClientRect();
    const scrollX = wrapper!.scrollLeft;
    const maxScrollX = Math.max(0, wrapper!.scrollWidth - wrapper!.clientWidth);
    const cards = track!.querySelectorAll('.service-card');
    const cardWidth = cards[0]?.getBoundingClientRect().width ?? 380;
    const cardCount = cards.length;
    return {
      sectionTop: rect.top,
      sectionBottom: rect.bottom,
      viewportHeight: window.innerHeight,
      scrollX,
      maxScrollX,
      cardWidth,
      cardCount,
      atStart: scrollX <= 5,
      atEnd: maxScrollX <= 5 || scrollX >= maxScrollX - 5,
    };
  }

  function getCurrentCardIndex(): number {
    const state = getScrollState();
    if (state.maxScrollX <= 0) return 0;
    const step = state.cardWidth + CARD_GAP;
    return Math.round(state.scrollX / step);
  }

  function scrollToCard(index: number) {
    const state = getScrollState();
    const step = state.cardWidth + CARD_GAP;
    const targetScroll = Math.min(index * step, state.maxScrollX);
    wrapper!.scrollTo({ left: targetScroll, behavior: 'smooth' });
  }

  function startAutoAdvance() {
    stopAutoAdvance();
    autoAdvanceId = window.setInterval(() => {
      if (isUserScrolling) return;
      const state = getScrollState();
      if (state.maxScrollX <= 0) return;
      const currentCard = getCurrentCardIndex();
      const nextCard = (currentCard + 1) % state.cardCount;
      scrollToCard(nextCard);
    }, AUTO_ADVANCE_MS);
  }

  function stopAutoAdvance() {
    if (autoAdvanceId) {
      clearInterval(autoAdvanceId);
      autoAdvanceId = null;
    }
  }

  // Section is "active" when a meaningful part is in view
  function isSectionActive(): boolean {
    const state = getScrollState();
    return state.sectionTop < state.viewportHeight * 0.85 && state.sectionBottom > state.viewportHeight * 0.15;
  }

  // Intersection Observer: when section enters view, start auto-advance
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          requestAnimationFrame(() => {
            scrollToCard(0);
            startAutoAdvance();
          });
        } else {
          stopAutoAdvance();
        }
      });
    },
    { threshold: 0.2, rootMargin: '80px 0px' }
  );
  observer.observe(section!);

  // Wheel: convert vertical scroll to horizontal when services section is in view
  function handleWheel(e: WheelEvent) {
    const state = getScrollState();
    if (!isSectionActive() || state.maxScrollX <= 0) return;

    const delta = e.deltaY;
    if (delta !== 0) {
      isUserScrolling = true;
      if (userScrollTimeout) clearTimeout(userScrollTimeout);
      userScrollTimeout = window.setTimeout(() => {
        isUserScrolling = false;
        userScrollTimeout = null;
      }, 1500);
    }

    if (delta > 0) {
      // Scroll down = move right (next card)
      if (state.atEnd) return; // Let vertical scroll continue
      e.preventDefault();
      e.stopPropagation();
      const step = state.cardWidth + CARD_GAP;
      const nextScroll = Math.min(state.scrollX + Math.abs(delta) * SCROLL_SPEED, state.maxScrollX);
      wrapper!.scrollTo({ left: nextScroll, behavior: 'auto' });
    } else if (delta < 0) {
      // Scroll up = move left (prev card)
      if (state.atStart) return;
      e.preventDefault();
      e.stopPropagation();
      const prevScroll = Math.max(state.scrollX + delta * SCROLL_SPEED, 0);
      wrapper!.scrollTo({ left: prevScroll, behavior: 'auto' });
    }
  }

  // Use capture so we get wheel before other handlers
  document.addEventListener('wheel', handleWheel, { passive: false, capture: true });
}
