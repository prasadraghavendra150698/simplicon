/**
 * Simplicon Tax - Interactive Features
 * TypeScript for type-safe UI interactions
 */

import { initMobileNav } from './nav';
import { initTestimonials } from './testimonials';
import { initContactForm } from './contact-form';
import { initScrollEffects } from './scroll-effects';
import { initAnimations } from './animations';
import { initEfilingPopupModule } from './efiling-popup';
import { initHeroCarousel } from './hero-carousel';
import { initServicesHorizontalScroll } from './services-horizontal-scroll';
import { initFloatingContact } from './floating-contact';
import { initWhyUsCarousel } from './why-us-carousel';

function init(): void {
  initMobileNav();
  initTestimonials();
  initContactForm();
  initScrollEffects();
  initAnimations();
  initEfilingPopupModule();
  initHeroCarousel();
  initServicesHorizontalScroll();
  initWhyUsCarousel();
  initFloatingContact();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
