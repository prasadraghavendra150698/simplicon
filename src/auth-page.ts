import { getSupabase, isAdmin } from './supabase';

function setNote(el: HTMLElement, message: string, isError = false): void {
  el.hidden = false;
  el.textContent = message;
  el.classList.toggle('auth-note--error', isError);
}

function setLoading(btn: HTMLButtonElement, loading: boolean, text: string): void {
  btn.disabled = loading;
  btn.classList.toggle('btn-loading', loading);
  const btnText = btn.querySelector('.btn-text');
  if (btnText) btnText.textContent = text;
}

function getNextPath(): string {
  const url = new URL(window.location.href);
  const next = url.searchParams.get('next') || '/portal';
  if (!next.startsWith('/')) return '/portal';
  return next;
}

function getSafeOrigin(): string | null {
  const origin = window.location.origin;
  if (!origin || origin === 'null') return null;
  if (!/^https?:\/\//i.test(origin)) return null;
  return origin;
}

function initTabs(): void {
  const signinTab = document.getElementById('signinTab') as HTMLButtonElement | null;
  const signupTab = document.getElementById('signupTab') as HTMLButtonElement | null;
  const signinPanel = document.getElementById('signinPanel') as HTMLElement | null;
  const signupPanel = document.getElementById('signupPanel') as HTMLElement | null;
  if (!signinTab || !signupTab || !signinPanel || !signupPanel) return;

  const setActive = (tab: 'signin' | 'signup'): void => {
    const isSignIn = tab === 'signin';
    signinTab.classList.toggle('auth-tab--active', isSignIn);
    signupTab.classList.toggle('auth-tab--active', !isSignIn);
    signinTab.setAttribute('aria-selected', String(isSignIn));
    signupTab.setAttribute('aria-selected', String(!isSignIn));
    signinPanel.hidden = !isSignIn;
    signupPanel.hidden = isSignIn;
    signinPanel.classList.toggle('auth-panel--active', isSignIn);
    signupPanel.classList.toggle('auth-panel--active', !isSignIn);
  };

  signinTab.addEventListener('click', () => setActive('signin'));
  signupTab.addEventListener('click', () => setActive('signup'));
}

async function redirectIfAlreadySignedIn(): Promise<void> {
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getSession();
  if (data?.session) window.location.href = getNextPath();
}

async function initAuth(): Promise<void> {
  const note = document.getElementById('authNote') as HTMLElement | null;
  if (!note) return;

  const signInForm = document.getElementById('signInForm') as HTMLFormElement | null;
  const signUpForm = document.getElementById('signUpForm') as HTMLFormElement | null;
  const signInBtn = document.getElementById('signInBtn') as HTMLButtonElement | null;
  const signUpBtn = document.getElementById('signUpBtn') as HTMLButtonElement | null;
  if (!signInForm || !signUpForm || !signInBtn || !signUpBtn) return;

  const supabase = await getSupabase();
  const nextPath = getNextPath();
  const safeClientNext = nextPath.startsWith('/admin') ? '/portal' : nextPath;

  // Toggle Password Visibility
  const setupToggle = (btnId: string, inputId: string) => {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId) as HTMLInputElement;
    if (!btn || !input) return;

    btn.addEventListener('click', () => {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.innerHTML = isPassword
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
      btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
  };

  setupToggle('toggleSigninPassword', 'signinPassword');
  setupToggle('toggleSignupPassword', 'signupPassword');

  // Forgot Password Logic
  const forgotBtn = document.getElementById('forgotPasswordBtn');
  const forgotModal = document.getElementById('forgotPasswordModal');
  const closeForgot = document.getElementById('closeForgotModal');
  const forgotForm = document.getElementById('forgotPasswordForm');
  const forgotMsg = document.getElementById('forgotMessage');
  const sendResetBtn = document.getElementById('sendResetBtn') as HTMLButtonElement;

  if (forgotBtn && forgotModal && closeForgot) {
    const toggleForgot = (show: boolean) => {
      if (show) forgotModal.classList.add('efiling-popup--visible');
      else forgotModal.classList.remove('efiling-popup--visible');
    };

    forgotBtn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleForgot(true);
    });

    closeForgot.addEventListener('click', () => toggleForgot(false));
    forgotModal.addEventListener('click', (e) => {
      if (e.target === forgotModal) toggleForgot(false);
    });

    if (forgotForm) {
      forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = (document.getElementById('forgotEmail') as HTMLInputElement).value.trim();
        if (!email) return;

        setLoading(sendResetBtn, true, 'Sending...');
        forgotMsg!.hidden = true;

        try {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/portal?reset=true'
          });

          if (error) throw error;

          setNote(forgotMsg!, 'Password reset link has been sent to your email.', false);
        } catch (err: any) {
          setNote(forgotMsg!, err.message || 'Failed to send reset link', true);
        } finally {
          setLoading(sendResetBtn, false, 'Send Reset Link');
        }
      });
    }
  }

  signInForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    note.hidden = true;

    // Strict Role Enforcement Check
    const roleValue =
      (document.querySelector('input[name="signinRole"]:checked') as HTMLInputElement | null)?.value ??
      'client';
    const role = roleValue === 'internal' ? 'internal' : 'client';

    const email = (document.getElementById('signinEmail') as HTMLInputElement | null)?.value?.trim();
    const password = (document.getElementById('signinPassword') as HTMLInputElement | null)?.value ?? '';
    if (!email || password.length < 1) {
      setNote(note, 'Please enter your email and password.', true);
      return;
    }

    setLoading(signInBtn, true, 'Signing in...');
    try {
      const { error, data: signinData } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password. Please try again.');
        }
        throw error;
      };

      // Double check constraints immediately after login
      if (role === 'internal') {
        const ok = await isAdmin();
        if (!ok) {
          // Check if request already exists
          const { data: request } = await supabase.from('admin_access_requests').select('status').eq('user_id', signinData.user.id).single();

          if (!request) {
            // Auto-create request if not exists
            await supabase.from('admin_access_requests').insert({
              user_id: signinData.user.id,
              email: signinData.user.email,
              status: 'pending',
            });
          }

          await supabase.auth.signOut();
          const statusMsg = request?.status === 'denied'
            ? 'Your admin access request was denied.'
            : 'Internal access requires approval. Your request matches a client account or is pending approval.';

          setNote(note, statusMsg, true);
          return;
        }
        window.location.href = '/admin';
        return;
      } else {
        // Client Login Attempt
        const isInternal = await isAdmin();
        if (isInternal) {
          await supabase.auth.signOut();
          setNote(note, 'You are an registered Administrator. Please sign in using the "Internal" tab.', true);
          return;
        }
        window.location.href = safeClientNext;
      }
    } catch (err: any) {
      const msg = err?.message ? String(err.message) : 'Sign in failed. Please try again.';
      setNote(note, msg, true);
    } finally {
      setLoading(signInBtn, false, 'Sign in');
    }
  });

  signUpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    note.hidden = true;

    const signupRoleValue =
      (document.querySelector('input[name="signupRole"]:checked') as HTMLInputElement | null)?.value ??
      'client';
    const signupRole = signupRoleValue === 'internal' ? 'internal' : 'client';

    const name = (document.getElementById('signupName') as HTMLInputElement | null)?.value?.trim();
    const email = (document.getElementById('signupEmail') as HTMLInputElement | null)?.value?.trim();
    const password = (document.getElementById('signupPassword') as HTMLInputElement | null)?.value ?? '';
    const password2 = (document.getElementById('signupPassword2') as HTMLInputElement | null)?.value ?? '';

    if (!name || !email || password.length < 8) {
      setNote(note, 'Please enter your name, a valid email, and a password with at least 8 characters.', true);
      return;
    }
    if (password !== password2) {
      setNote(note, 'Passwords do not match.', true);
      return;
    }

    setLoading(signUpBtn, true, 'Creating...');
    try {
      const origin = getSafeOrigin();
      const { data, error } = await supabase.auth.signUp(
        origin
          ? {
            email,
            password,
            options: {
              emailRedirectTo: `${origin}/portal`,
              data: { full_name: name }
            }
          }
          : {
            email,
            password,
            options: {
              data: { full_name: name }
            }
          }
      );
      if (error) throw error;

      if (data?.session) {
        if (signupRole === 'internal') {
          // If they try to signup as internal, we don't make them admin immediately.
          // We check if they are ALREADY admin (rare race condition or existing user).
          const ok = await isAdmin();
          if (ok) {
            window.location.href = '/admin';
            return;
          }

          // Create access request
          try {
            const userId = data.session.user.id as string;
            const userEmail = data.session.user.email as string | null;
            if (userId && userEmail) {
              await supabase.from('admin_access_requests').insert({
                user_id: userId,
                email: userEmail,
                status: 'pending',
              });
            }
          } catch (_) { }

          await supabase.auth.signOut();
          setNote(
            note,
            'Internal account created but requires approval. A request has been sent to the Super Admin.',
            false
          );
          return;
        }

        // Client signup
        window.location.href = safeClientNext;
        return;
      }

      // Email confirmation needed case
      if (signupRole === 'internal') {
        setNote(
          note,
          'Account created. Please confirm your email. After confirmation, you must wait for Admin approval before logging in.',
          false
        );
      } else {
        setNote(note, 'Account created. Please check your email to confirm, then sign in.', false);
      }
    } catch (err: any) {
      const msg = err?.message ? String(err.message) : 'Sign up failed. Please try again.';
      setNote(note, msg, true);
    } finally {
      setLoading(signUpBtn, false, 'Create account');
    }
  });
}


async function init(): Promise<void> {
  initTabs();
  try {
    await redirectIfAlreadySignedIn();
    await initAuth();
  } catch (err: any) {
    const note = document.getElementById('authNote') as HTMLElement | null;
    if (!note) return;
    const msg = err?.message ? String(err.message) : 'Portal is not configured yet.';
    setNote(note, msg, true);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void init());
} else {
  void init();
}
