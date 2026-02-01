/**
 * Contact Form Handler - Submits to /api/submit-contact
 * Uses form submit event with preventDefault - no page reload
 */

const FETCH_TIMEOUT_MS = 10000;

interface FormPayload {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}

function sleep(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Request timed out')), ms)
  );
}

export function initContactForm(): void {
  const form = document.getElementById('contact-form') as HTMLFormElement | null;
  const formSuccess = document.getElementById('formSuccess') as HTMLDivElement | null;

  if (!form || !formSuccess) return;

  console.log('CONTACT FORM JS LOADED');

  form.addEventListener('submit', async (e: SubmitEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('SUBMIT HANDLER FIRED');

    const name = (form.querySelector('#name') as HTMLInputElement)?.value?.trim();
    const email = (form.querySelector('#email') as HTMLInputElement)?.value?.trim();
    const message = (form.querySelector('#message') as HTMLTextAreaElement)?.value?.trim();

    if (!name || !email || !message) {
      alert('Please fill in all required fields (Name, Email, Message).');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    const originalText = submitBtn?.textContent ?? 'Send Message';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
    }

    const resetButton = (): void => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    };

    try {
      const isLocalDev =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
        window.location.port !== '3000';

      if (isLocalDev) {
        console.log('Local dev: API not available, simulating success');
        form.reset();
        form.style.display = 'none';
        formSuccess.style.display = 'block';
        return;
      }

      const url = `${window.location.origin}/api/submit-contact`;
      console.log('FETCH STARTED', url);

      const fetchPromise = (async (): Promise<void> => {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            message,
            phone: (form.querySelector('#phone') as HTMLInputElement)?.value?.trim() || undefined,
            subject: (form.querySelector('#subject') as HTMLSelectElement)?.value || undefined,
          } as FormPayload),
        });

        console.log('FETCH COMPLETE', res.status);
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const msg = data.error ?? `Request failed (${res.status})`;
          throw new Error(msg);
        }

        form.reset();
        form.style.display = 'none';
        formSuccess.style.display = 'block';
      })();

      await Promise.race([fetchPromise, sleep(FETCH_TIMEOUT_MS)]);
    } catch (err) {
      const isTimeout = err instanceof Error && err.message === 'Request timed out';
      if (isTimeout) {
        console.error('FETCH TIMEOUT');
        alert('Request timed out. Please try again or email us directly at info@simplicontaxadvisors.com');
      } else if (err instanceof Error) {
        console.error('FETCH ERROR', err.message);
        alert(err.message);
      } else {
        console.error('FETCH ERROR', err);
        alert('Something went wrong. Please try again or email us directly at info@simplicontaxadvisors.com');
      }
    } finally {
      resetButton();
    }
  });
}
