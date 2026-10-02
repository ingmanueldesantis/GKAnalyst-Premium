import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
];

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Token might have expired or not cached yet in memory
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (
  emailHint?: string,
  forceConsent: boolean = true
): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const provider = new GoogleAuthProvider();
    for (const scope of WORKSPACE_SCOPES) {
      provider.addScope(scope);
    }
    
    const customParams: Record<string, string> = {
      // Force consent prompt so newly added Workspace scopes (Drive & Sheets) are granted by the user
      prompt: forceConsent ? 'consent select_account' : 'select_account',
    };
    if (emailHint && emailHint.trim()) {
      customParams.login_hint = emailHint.trim();
    }
    provider.setCustomParameters(customParams);

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google access token from credentials');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const clearCachedAccessToken = (): void => {
  cachedAccessToken = null;
};

export const getAccessToken = async (forcePromptIfMissing = false, emailHint?: string): Promise<string | null> => {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }
  if (forcePromptIfMissing) {
    const res = await googleSignIn(emailHint);
    return res?.accessToken ?? null;
  }
  return null;
};

export const logoutGoogle = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};
