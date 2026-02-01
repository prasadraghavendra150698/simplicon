/**
 * Contact Form Handler - Submits to /api/submit-contact
 * Uses form submit event with preventDefault - no page reload
 */

const FETCH_TIMEOUT_MS = 15000;

interface FormPayload {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
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

    try {
      const isLocalDev = typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '3000';
      if (isLocalDev) {
        console.log('Local dev: API not available, simulating success');
        form.reset();
        form.style.display = 'none';
        formSuccess.style.display = 'block';
        return;
      }

      console.log('FETCH STARTED');
      const res = await fetchWithTimeout(
        '/api/submit-contact',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            message,
            phone: (form.querySelector('#phone') as HTMLInputElement)?.value?.trim() || undefined,
            subject: (form.querySelector('#subject') as HTMLSelectElement)?.value || undefined,
          } as FormPayload),
        },
        FETCH_TIMEOUT_MS
      );

      console.log('FETCH COMPLETE', res.status);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.error ?? `Request failed (${res.status})`;
        throw new Error(msg);
      }

      form.reset();
      form.style.display = 'none';
      formSuccess.style.display = 'block';
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          console.error('FETCH TIMEOUT');
          alert('Request timed out. Please try again or email us directly at info@simplicontaxadvisors.com');
        } else {
          console.error('FETCH ERROR', err.message);
          alert(err.message);
        }
      } else {
        console.error('FETCH ERROR', err);
        alert('Something went wrong. Please try again or email us directly at info@simplicontaxadvisors.com');
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });
}
