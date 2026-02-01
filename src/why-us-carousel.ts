/**
 * Why Us Carousel - Horizontal scrolling, one card at a time
 * Auto-advances, prev/next buttons, dots indicator
 */

const INTERVAL_MS = 2500;

export function initWhyUsCarousel(): void {
  const carousel = document.getElementById('whyUsCarousel');
  const track = document.getElementById('whyUsCarouselTrack');
  const dotsContainer = document.getElementById('whyUsCarouselDots');
  const prevBtn = document.querySelector('.why-us-carousel-btn--prev');
  const nextBtn = document.querySelector('.why-us-carousel-btn--next');

  if (!carousel || !track || !dotsContainer) return;

  const dotsEl = dotsContainer;
  const cards = track.querySelectorAll('.why-us-card');
  const cardCount = cards.length;
  if (cardCount === 0) return;

  let currentIndex = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  function scrollToIndex(index: number): void {
    currentIndex = Math.max(0, Math.min(index, cardCount - 1));
    const card = cards[currentIndex] as HTMLElement;
    const trackEl = track as HTMLElement;
    if (card && trackEl) {
      const cardLeft = card.offsetLeft;
      const cardWidth = card.offsetWidth;
      const trackWidth = trackEl.offsetWidth;
      const scrollTarget = cardLeft - (trackWidth / 2) + (cardWidth / 2);
      trackEl.scrollTo({ left: scrollTarget, behavior: 'smooth' });
    }
    updateDots();
  }

  function updateDots(): void {
    dotsEl.querySelectorAll('.why-us-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === currentIndex);
    });
  }

  function next(): void {
    scrollToIndex(currentIndex >= cardCount - 1 ? 0 : currentIndex + 1);
  }

  function prev(): void {
    scrollToIndex(currentIndex <= 0 ? cardCount - 1 : currentIndex - 1);
  }

  function startAutoAdvance(): void {
    stopAutoAdvance();
    intervalId = setInterval(() => {
      const nextIndex = (currentIndex + 1) % cardCount;
      scrollToIndex(nextIndex);
    }, INTERVAL_MS);
  }

  function stopAutoAdvance(): void {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  // Create dots
  for (let i = 0; i < cardCount; i++) {
    const dot = document.createElement('button');
    dot.className = 'why-us-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
    dot.addEventListener('click', () => {
      scrollToIndex(i);
      startAutoAdvance();
    });
    dotsEl.appendChild(dot);
  }

  // Prev/Next buttons
  prevBtn?.addEventListener('click', () => {
    prev();
    startAutoAdvance();
  });
  nextBtn?.addEventListener('click', () => {
    next();
    startAutoAdvance();
  });

  // Pause on hover
  carousel.addEventListener('mouseenter', stopAutoAdvance);
  carousel.addEventListener('mouseleave', startAutoAdvance);

  // Touch swipe support
  let touchStartX = 0;
  let touchEndX = 0;
  carousel.addEventListener(
    'touchstart',
    (e) => {
      touchStartX = e.changedTouches[0].screenX;
    },
    { passive: true }
  );
  carousel.addEventListener(
    'touchend',
    (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) next();
        else prev();
        startAutoAdvance();
      }
    },
    { passive: true }
  );

  startAutoAdvance();
}
