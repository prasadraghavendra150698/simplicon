/**
 * Floating Contact Icons - Show after services, hide while scrolling
 * Only on homepage (index.html)
 */

const SCROLL_DEBOUNCE_MS = 200;
const SERVICES_SECTION_ID = 'services';

export function initFloatingContact() {
  const floatingContact = document.querySelector('.floating-contact') as HTMLElement | null;
  const servicesSection = document.getElementById(SERVICES_SECTION_ID);

  if (!floatingContact || !servicesSection) return;

  let scrollTimeout: number | null = null;
  let lastScrollY = window.scrollY;

  // Initially hidden - only show after passing services
  floatingContact.classList.add('floating-contact--hidden');
  floatingContact.classList.add('floating-contact--scrolling'); // Start as "scrolling"

  function updateVisibility() {
    const servicesRect = servicesSection.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Show only when user has scrolled past the services section (bottom of services above viewport)
    const hasPassedServices = servicesRect.bottom < viewportHeight * 0.3;

    if (hasPassedServices) {
      floatingContact.classList.remove('floating-contact--hidden');
    } else {
      floatingContact.classList.add('floating-contact--hidden');
    }
  }

  function onScroll() {
    // Hide while scrolling
    floatingContact.classList.add('floating-contact--scrolling');

    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = window.setTimeout(() => {
      floatingContact.classList.remove('floating-contact--scrolling');
      scrollTimeout = null;
    }, SCROLL_DEBOUNCE_MS);

    updateVisibility();
  }

  // Throttled scroll handler for performance
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

  // Initial check
  updateVisibility();
}
