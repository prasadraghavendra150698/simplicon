/**
 * Contact Form Handler - Submits to /api/submit-contact
 * Flow: User submits → JS collects data → POST to API → Success: modal + reset + scroll | Error: toast
 */

const FETCH_TIMEOUT_MS = 25000;

interface FormPayload {
  name: string;
  email: string;
  phone?: string;
  inquiry_type: string;
  message: string;
}

function sleep(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Request timed out')), ms)
  );
}

function showToast(message: string, isError = true): void {
  const existing = document.querySelector('.form-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'form-toast' + (isError ? ' form-toast--error' : '');
  toast.setAttribute('role', 'alert');

  const msg = document.createElement('span');
  msg.className = 'form-toast-message';
  msg.textContent = message;
  toast.appendChild(msg);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'form-toast-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '×';
  toast.appendChild(closeBtn);

  const close = (): void => toast.remove();
  closeBtn.addEventListener('click', close);
  setTimeout(close, 6000);

  document.body.appendChild(toast);
}

export function initContactForm(): void {
  const form = document.getElementById('contact-form') as HTMLFormElement | null;
  const formSuccess = document.getElementById('formSuccess') as HTMLDivElement | null;

  if (!form || !formSuccess) return;
  if (form.getAttribute('data-handled') === 'inline') return;

  console.log('CONTACT FORM JS LOADED');

  form.addEventListener('submit', async (e: SubmitEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const name = (form.querySelector('#name') as HTMLInputElement)?.value?.trim();
    const email = (form.querySelector('#email') as HTMLInputElement)?.value?.trim();
    const phone = (form.querySelector('#phone') as HTMLInputElement)?.value?.trim();
    const inquiry_type = (form.querySelector('#inquiry_type') as HTMLSelectElement)?.value?.trim();
    const message = (form.querySelector('#message') as HTMLTextAreaElement)?.value?.trim();

    if (!name || !email || !message) {
      showToast('Please fill in Name, Email, and Message.');
      return;
    }
    if (!inquiry_type) {
      showToast('Please select an Inquiry Type.');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    const btnText = submitBtn?.querySelector('.btn-text');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('btn-loading');
      if (btnText) btnText.textContent = 'Sending...';
    }

    const resetButton = (): void => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-loading');
        if (btnText) btnText.textContent = 'Send Message';
      }
    };

    try {
      const isLocalDev =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1');

      if (isLocalDev) {
        console.log('Local dev detected (Simulating success)');
        await new Promise(resolve => setTimeout(resolve, 1500));
        form.reset();
        form.style.display = 'none';
        formSuccess.style.display = 'block';
        return;
      }

      const url = `${window.location.origin}/api/submit-contact`;
      console.log('[CONTACT FORM] FETCH STARTED', url);

      const fetchPromise = (async (): Promise<void> => {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            phone: phone || undefined,
            inquiry_type,
            message,
          } as FormPayload),
        });

        console.log('[CONTACT FORM] FETCH STATUS', res.status);

        let data: any = {};
        try {
          data = await res.json();
        } catch (e) {
          console.warn('[CONTACT FORM] Could not parse response as JSON');
        }

        if (!res.ok) {
          const msg = data.message || data.error || `Server error (${res.status})`;
          throw new Error(msg);
        }

        if (data.success === false) {
          throw new Error(data.message || 'Submission failed');
        }

        form.reset();
        form.style.display = 'none';
        formSuccess.style.display = 'block';
        formSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
      })();

      await Promise.race([fetchPromise, sleep(FETCH_TIMEOUT_MS)]);
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err || 'Unknown error');
      const isTimeout = msg === 'Request timed out';

      if (isTimeout) {
        console.error('[CONTACT FORM] TIMEOUT after', FETCH_TIMEOUT_MS / 1000, 'seconds');
        showToast('Request timed out. Please check your internet or try again later.');
      } else {
        console.error('[CONTACT FORM] ERROR:', msg);
        showToast(msg);
      }
    } finally {
      resetButton();
    }
  });
}
