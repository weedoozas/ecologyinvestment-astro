import {
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from '../lib/firebase/client';
import { ensureUserProfile } from '../lib/firebase/data';

function getErrorMessage(error: unknown) {
  if (error instanceof FirebaseError) {
    if (error.code === 'auth/popup-closed-by-user') return 'Se cerro la ventana antes de completar el acceso.';
    if (error.code === 'auth/popup-blocked') return 'El navegador bloqueo la ventana emergente de Google.';
    if (error.code === 'auth/cancelled-popup-request') return 'Ya hay un acceso en proceso.';
    if (error.code === 'auth/network-request-failed') return 'No se pudo conectar. Revisa tu conexion.';
    if (error.code === 'auth/invalid-email') return 'El correo no tiene un formato valido.';
    if (error.code === 'auth/missing-password') return 'Ingresa tu contrasena.';
    if (error.code === 'auth/weak-password') return 'La contrasena debe tener al menos 6 caracteres.';
    if (error.code === 'auth/email-already-in-use') return 'Ese correo ya tiene una cuenta registrada.';
    if (error.code === 'auth/invalid-credential') return 'Correo o contrasena incorrectos.';
    if (error.code === 'auth/user-not-found') return 'No existe una cuenta con ese correo.';
    if (error.code === 'auth/wrong-password') return 'Correo o contrasena incorrectos.';
    if (error.code === 'auth/too-many-requests') return 'Demasiados intentos. Espera un momento e intenta otra vez.';
  }

  if (error instanceof Error) return error.message;
  return 'No se pudo completar el acceso.';
}

export function initLoginPage() {
  const authMode = document.body.dataset.authMode === 'register' ? 'register' : 'login';
  const form = document.querySelector<HTMLFormElement>('#loginForm');
  const googleButton = document.querySelector<HTMLButtonElement>('#googleAuthButton');
  const googleButtonLabel = googleButton?.querySelector<HTMLSpanElement>('span');
  const formSubmitButton = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
  const message = document.querySelector<HTMLElement>('#loginMessage');

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const setMessage = (text: string, tone: 'error' | 'success' | 'info' = 'info') => {
    if (!message) return;
    message.textContent = text;
    if (!text) {
      message.className = 'hidden rounded-2xl px-4 py-3 text-sm font-semibold';
      return;
    }

    message.className = `block rounded-2xl px-4 py-3 text-sm font-semibold ${tone === 'error'
      ? 'border border-red-200 bg-red-50 text-red-700'
      : tone === 'success'
        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border border-sky-200 bg-sky-50 text-sky-700'}`;
  };

  const setFormLoading = (loading: boolean) => {
    if (!formSubmitButton) return;
    formSubmitButton.disabled = loading;
    formSubmitButton.textContent = authMode === 'register'
      ? loading ? 'Creando cuenta...' : 'Crear cuenta'
      : loading ? 'Entrando...' : 'Entrar';
  };

  const setGoogleLoading = (loading: boolean) => {
    if (!googleButton) return;
    googleButton.disabled = loading;
    if (googleButtonLabel) {
      googleButtonLabel.textContent = authMode === 'register'
        ? loading ? 'Creando con Google...' : 'Continuar con Google'
        : loading ? 'Entrando con Google...' : 'Entrar con Google';
    }
  };

  const redirectToDashboard = () => {
    window.location.replace('/dashboard');
  };

  const completeGoogleAccess = async () => {
    setGoogleLoading(true);
    setMessage(authMode === 'register' ? 'Conectando tu cuenta de Google...' : 'Abriendo Google...', 'info');

    try {
      const result = await signInWithPopup(auth, provider);
      const info = getAdditionalUserInfo(result);
      await ensureUserProfile(result.user);
      setMessage(authMode === 'register'
        ? info?.isNewUser ? 'Cuenta creada. Redirigiendo...' : 'Cuenta lista. Redirigiendo...'
        : 'Acceso correcto. Redirigiendo...', 'success');
      redirectToDashboard();
    } catch (error) {
      setMessage(getErrorMessage(error), 'error');
    } finally {
      setGoogleLoading(false);
    }
  };

  const completeEmailAccess = async () => {
    if (!form) return;

    const formData = new FormData(form);
    const name = String(formData.get('name') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '').trim();

    if (!email || !password || (authMode === 'register' && !name)) {
      setMessage(authMode === 'register'
        ? 'Completa nombre, correo y contrasena.'
        : 'Completa correo y contrasena.', 'error');
      return;
    }

    setFormLoading(true);
    setMessage(authMode === 'register' ? 'Creando tu cuenta...' : 'Validando acceso...', 'info');

    try {
      if (authMode === 'register') {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        if (name) {
          await updateProfile(result.user, { displayName: name });
        }
        await ensureUserProfile(result.user, { name, email });
        setMessage('Cuenta creada. Redirigiendo...', 'success');
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        await ensureUserProfile(result.user);
        setMessage('Acceso correcto. Redirigiendo...', 'success');
      }

      redirectToDashboard();
    } catch (error) {
      setMessage(getErrorMessage(error), 'error');
    } finally {
      setFormLoading(false);
    }
  };

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    await ensureUserProfile(user);
    redirectToDashboard();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await completeEmailAccess();
  });

  googleButton?.addEventListener('click', completeGoogleAccess);
}
