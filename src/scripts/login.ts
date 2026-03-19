import {
  fetchSignInMethodsForEmail,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from '../lib/firebase/client';
import { ensureUserProfile, type UserProfile } from '../lib/firebase/data';

const EMAIL_STORAGE_KEY = 'eco-email-link-signin';
const REGISTRATION_STORAGE_KEY = 'eco-email-link-registration';

interface RegistrationDraft {
  name: string;
  email: string;
}

function getActionCodeSettings() {
  return {
    url: new URL('/login', window.location.origin).toString(),
    handleCodeInApp: true,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof FirebaseError) {
    if (error.code === 'auth/invalid-email') return 'El correo no tiene un formato valido.';
    if (error.code === 'auth/missing-email') return 'Ingresa tu correo para continuar.';
    if (error.code === 'auth/invalid-action-code') return 'El vinculo ya no es valido o ya fue usado.';
    if (error.code === 'auth/expired-action-code') return 'El vinculo expiro. Solicita uno nuevo.';
    if (error.code === 'auth/too-many-requests') return 'Demasiados intentos. Espera un momento e intenta otra vez.';
    if (error.code === 'auth/network-request-failed') return 'No se pudo conectar con Firebase. Revisa tu conexion.';
  }

  if (error instanceof Error) return error.message;
  return 'No se pudo iniciar sesion.';
}

export function initLoginPage() {
  const authMode = document.body.dataset.authMode === 'register' ? 'register' : 'login';
  const form = document.querySelector<HTMLFormElement>('#loginForm');
  const message = document.querySelector<HTMLElement>('#loginMessage');
  const nameInput = document.querySelector<HTMLInputElement>('input[name="name"]');
  const emailInput = document.querySelector<HTMLInputElement>('input[name="email"]');
  const submitButton = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
  const title = document.querySelector<HTMLElement>('#loginTitle');
  const helper = document.querySelector<HTMLElement>('#loginHelper');
  const steps = document.querySelector<HTMLElement>('#loginSteps');
  const nameField = document.querySelector<HTMLElement>('#nameField');
  const searchParams = new URLSearchParams(window.location.search);
  const emailFromQuery = searchParams.get('email')?.trim() ?? '';
  const redirectFromLogin = searchParams.get('from') === 'login';

  if (authMode === 'login') {
    nameField?.classList.add('hidden');
    if (nameInput) nameInput.required = false;
  }

  if (authMode === 'register' && emailFromQuery && emailInput) {
    emailInput.value = emailFromQuery;
    if (redirectFromLogin) {
      emailInput.readOnly = true;
      emailInput.classList.add('bg-green-50');
      if (helper) helper.textContent = 'Completa tu nombre para terminar el registro.';
      nameInput?.focus();
    }
  }

  const setLoading = (loading: boolean, text: string) => {
    if (!submitButton) return;
    submitButton.disabled = loading;
    submitButton.textContent = text;
  };

  const saveEmail = (email: string) => {
    window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
  };

  const saveRegistrationDraft = (draft: RegistrationDraft) => {
    window.localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(draft));
  };

  const getSavedEmail = () => {
    return window.localStorage.getItem(EMAIL_STORAGE_KEY)?.trim() ?? '';
  };

  const getRegistrationDraft = (): RegistrationDraft | null => {
    const rawValue = window.localStorage.getItem(REGISTRATION_STORAGE_KEY);
    if (!rawValue) return null;

    try {
      const parsed = JSON.parse(rawValue) as Partial<RegistrationDraft>;
      if (!parsed.email) return null;
      return {
        name: typeof parsed.name === 'string' ? parsed.name : '',
        email: typeof parsed.email === 'string' ? parsed.email : '',
      };
    } catch {
      return null;
    }
  };

  const clearSavedEmail = () => {
    window.localStorage.removeItem(EMAIL_STORAGE_KEY);
  };

  const clearRegistrationDraft = () => {
    window.localStorage.removeItem(REGISTRATION_STORAGE_KEY);
  };

  const getProfileDefaults = (): Partial<UserProfile> | undefined => {
    const draft = getRegistrationDraft();
    if (!draft) return undefined;

    return {
      name: draft.name || draft.email.split('@')[0] || 'Nuevo beneficiario',
      email: draft.email,
    };
  };

  const setCompleteMode = () => {
    form?.setAttribute('data-mode', 'complete');
    if (title) title.textContent = 'Confirma tu acceso';
    if (helper) helper.textContent = 'Abre el vinculo en el mismo navegador o vuelve a escribir el correo para completar el acceso.';
    if (steps) {
      steps.innerHTML = [
        '1. Abre el correo recibido.',
        '2. Toca el vinculo seguro de acceso.',
        '3. Confirma el mismo correo para entrar.',
      ].map((item) => `<li class="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3">${item}</li>`).join('');
    }
    if (submitButton) submitButton.textContent = 'Confirmar acceso';
    if (authMode === 'login') {
      nameField?.classList.add('hidden');
    }
    if (authMode === 'register' && redirectFromLogin && helper) {
      helper.textContent = 'Completa tu nombre para terminar el registro.';
    }
  };

  const setMessage = (text: string, tone: 'error' | 'success' | 'info' = 'info') => {
    if (!message) return;
    message.textContent = text;
    message.className = `text-center text-sm min-h-5 font-medium ${tone === 'error' ? 'text-red-500' : tone === 'success' ? 'text-emerald-600' : 'text-green-700'}`;
  };

  const completeEmailLinkAccess = async (providedEmail?: string) => {
    const email = (providedEmail || getSavedEmail() || window.prompt('Confirma el correo con el que solicitaste el acceso:') || '').trim();

    if (!email) {
      setMessage('Necesitamos confirmar tu correo para validar el vinculo.', 'error');
      return;
    }

    setLoading(true, 'Confirmando acceso...');
    setMessage('Validando el vinculo seguro...', 'info');

    try {
      const credentials = await signInWithEmailLink(auth, email, window.location.href);
      const profileDefaults = getProfileDefaults();
      clearSavedEmail();
      await ensureUserProfile(credentials.user, profileDefaults);
      clearRegistrationDraft();
      window.history.replaceState({}, document.title, '/login');
      setMessage('Acceso confirmado. Redirigiendo...', 'success');
      window.location.replace('/dashboard');
    } catch (error) {
      setMessage(getErrorMessage(error), 'error');
    } finally {
      setLoading(false, 'Confirmar acceso');
    }
  };

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    await ensureUserProfile(user, authMode === 'register' ? getProfileDefaults() : undefined);
    if (authMode === 'register') clearRegistrationDraft();
    window.location.replace('/dashboard');
  });

  if (isSignInWithEmailLink(auth, window.location.href)) {
    setCompleteMode();
    const savedEmail = getSavedEmail();
    const draft = getRegistrationDraft();
    if (authMode === 'register' && nameInput && draft?.name) nameInput.value = draft.name;
    if (emailInput && savedEmail) emailInput.value = savedEmail;
    if (savedEmail) {
      completeEmailLinkAccess(savedEmail);
    }
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const name = String(formData.get('name') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();

    if (!email || (authMode === 'register' && !name)) {
      setMessage(authMode === 'register' ? 'Completa nombre y correo para registrarte.' : 'Ingresa tu correo para acceder.', 'error');
      return;
    }

    if (form.dataset.mode === 'complete' || isSignInWithEmailLink(auth, window.location.href)) {
      if (authMode === 'register') {
        saveRegistrationDraft({ name, email });
      }
      await completeEmailLinkAccess(email);
      return;
    }

    setLoading(true, 'Enviando vinculo...');
    setMessage('Generando tu acceso seguro...', 'info');

    try {
      if (authMode === 'login') {
        const methods = await fetchSignInMethodsForEmail(auth, email);
        if (!methods.length) {
          window.location.replace(`/registro?email=${encodeURIComponent(email)}&from=login`);
          return;
        }
      }

      await sendSignInLinkToEmail(auth, email, getActionCodeSettings());
      saveEmail(email);
      if (authMode === 'register') {
        saveRegistrationDraft({ name, email });
      }
      setMessage(authMode === 'register'
        ? 'Registro iniciado. Te enviamos un vinculo de acceso para activar tu cuenta.'
        : 'Te enviamos un vinculo de acceso. Abre el correo en este mismo navegador para entrar.', 'success');
      setCompleteMode();
    } catch (error) {
      setMessage(getErrorMessage(error), 'error');
    } finally {
      setLoading(false, form.dataset.mode === 'complete'
        ? 'Confirmar acceso'
        : authMode === 'register'
          ? 'Registrarme con mi correo'
          : 'Enviar vinculo de acceso');
    }
  });
}
