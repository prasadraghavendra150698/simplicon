// floating contact - shows after scrolling past services
const SCROLL_DEBOUNCE_MS = 200;
const SERVICES_SECTION_ID = 'services';

export function initFloatingContact() {
  const floatingContact = document.querySelector('.floating-contact') as HTMLElement | null;
  const servicesSection = document.getElementById(SERVICES_SECTION_ID);

  if (!floatingContact || !servicesSection) return;

  const fc = floatingContact;
  const ss = servicesSection;
  let scrollTimeout: number | null = null;

  fc.classList.add('floating-contact--hidden');
  fc.classList.add('floating-contact--scrolling');

  function updateVisibility() {
    const servicesRect = ss.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    const hasPassedServices = servicesRect.bottom < viewportHeight * 0.3;

    if (hasPassedServices) {
      fc.classList.remove('floating-contact--hidden');
    } else {
      fc.classList.add('floating-contact--hidden');
    }
  }

  function onScroll() {
    fc.classList.add('floating-contact--scrolling');

    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = window.setTimeout(() => {
      fc.classList.remove('floating-contact--scrolling');
      scrollTimeout = null;
    }, SCROLL_DEBOUNCE_MS);

    updateVisibility();
  }

  let ticking = false;
  function onScrollThrottled() {
    if (!ticking) {
      requestAnimationFrame(() => {
        onScroll();
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScrollThrottled, { passive: true });
  window.addEventListener('resize', updateVisibility);
  updateVisibility();
}
