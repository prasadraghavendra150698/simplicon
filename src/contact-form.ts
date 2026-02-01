/**
 * Contact Form Handler - Submits to /api/submit-contact
 * Uses form submit event with preventDefault - no page reload
 */

interface FormPayload {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
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
      const res = await fetch('/api/submit-contact', {
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

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.error ?? `Request failed (${res.status})`;
        throw new Error(msg);
      }

      form.reset();
      form.style.display = 'none';
      formSuccess.style.display = 'block';
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again or email us directly.';
      alert(msg);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });
}
