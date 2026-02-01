/**
 * Contact Form Handler - Submits to Netlify Function
 * Admin receives form copy | User receives acknowledgement
 */

interface FormData {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

function getSubmitUrl(): string {
  // Vercel: /api/submit-contact (relative = same origin, no full-domain issues)
  // Netlify: /.netlify/functions/submit-contact
  if (typeof window === 'undefined') return '';
  return '/api/submit-contact';
}

export function initContactForm(): void {
  const form = document.getElementById('contactForm') as HTMLFormElement | null;
  const formSuccess = document.getElementById('formSuccess') as HTMLDivElement | null;

  if (!form || !formSuccess) return;

  form.addEventListener('submit', async (e: Event) => {
    e.preventDefault();

    const name = (form.querySelector('#name') as HTMLInputElement)?.value?.trim();
    const email = (form.querySelector('#email') as HTMLInputElement)?.value?.trim();
    const message = (form.querySelector('#message') as HTMLTextAreaElement)?.value?.trim();

    if (!name || !email || !message) {
      alert('Please fill in all required fields (Name, Email, Message).');
      return;
    }

    const formData: FormData = {
      name,
      email,
      phone: (form.querySelector('#phone') as HTMLInputElement)?.value?.trim() || '',
      subject: (form.querySelector('#subject') as HTMLSelectElement)?.value || 'general',
      message,
    };

    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    const originalText = submitBtn?.textContent || 'Send Message';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
    }

    try {
      const url = getSubmitUrl();
      if (!url || (url.includes('localhost') && !url.includes('3000'))) {
        // Local Vite dev - API not available, show success for testing. Run "vercel dev" for full form testing.
        form.style.display = 'none';
        formSuccess.style.display = 'block';
        return;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          message: formData.message,
          phone: formData.phone || undefined,
          subject: formData.subject || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Form service not available. Please run "vercel dev" for local testing, or deploy to Vercel.');
        }
        throw new Error(data.error || `Request failed (${res.status})`);
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
