/**
 * Authentication Service for GKAnalytics
 * Connected to Google Apps Script Web App Backend:
 * https://script.google.com/macros/s/AKfycbxS3581QQeZ0xLAVO5jut8ghG6zVBY0_fq8Ej6pZYc79TLO7GfSdQv2xBbo3KmMHtd7ZQ/exec
 */

export const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxS3581QQeZ0xLAVO5jut8ghG6zVBY0_fq8Ej6pZYc79TLO7GfSdQv2xBbo3KmMHtd7ZQ/exec';

export const STORAGE_KEY_DEVICE_ID = 'app_device_id';
export const STORAGE_KEY_AUTH_USER = 'auth_username';
export const STORAGE_KEY_AUTH_PASS = 'auth_password';
export const STORAGE_KEY_AUTH_SCADENZA = 'auth_scadenza';

export interface ScriptAuthResponse {
  success: boolean;
  status:
    | 'ATTIVO'
    | 'DISABILITATO'
    | 'SCADUTO'
    | 'DISPOSITIVO_NON_AUTORIZZATO'
    | 'NON_TROVATO'
    | 'ERRORE_DISPOSITIVO'
    | string;
  scadenza?: string;
  message?: string;
}

export interface SavedAuthSession {
  username: string;
  password: string;
  scadenza: string;
}

/**
 * Salva un valore in un cookie a lunga scadenza (365 giorni) come fallback
 */
export function setLongLivedCookie(name: string, value: string, days: number = 365): void {
  try {
    if (typeof document === 'undefined') return;
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch (err) {
    console.warn('Impossibile impostare il cookie di backup:', err);
  }
}

/**
 * Recupera un valore dai cookie di backup
 */
export function getLongLivedCookie(name: string): string | null {
  try {
    if (typeof document === 'undefined') return null;
    const key = encodeURIComponent(name) + '=';
    const cookies = document.cookie ? document.cookie.split('; ') : [];
    for (const c of cookies) {
      if (c.indexOf(key) === 0) {
        return decodeURIComponent(c.substring(key.length));
      }
    }
  } catch (err) {
    console.warn('Impossibile leggere il cookie di backup:', err);
  }
  return null;
}

/**
 * 2. GENERAZIONE DEVICE ID UNIVOCO (Anti-condivisione account)
 * - Controlla prima se esiste la chiave `app_device_id` in localStorage.
 * - Se non presente in localStorage, recupera dal fallback nei cookie a lunga scadenza (365 giorni).
 * - Se non esiste in nessuno dei due, genera un codice univoco e salvalo in entrambi (localStorage e Cookie a 365 giorni).
 * - NOTA CRITICA: Non cancellare MAI `app_device_id` dal localStorage né dai cookie, nemmeno al logout.
 */
export function getOrCreateDeviceId(): string {
  try {
    // 1. Controlla prima in localStorage
    const storedId = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
    if (storedId && storedId.trim()) {
      const cleanId = storedId.trim();
      // Sincronizza e rinnova sempre il cookie a 365 giorni
      setLongLivedCookie(STORAGE_KEY_DEVICE_ID, cleanId, 365);
      return cleanId;
    }

    // 2. Fallback sui Cookie a lunga scadenza (365 giorni) nel caso in cui la WebView Android abbia pulito la cache
    const cookieId = getLongLivedCookie(STORAGE_KEY_DEVICE_ID);
    if (cookieId && cookieId.trim()) {
      const cleanId = cookieId.trim();
      // Ripristina in localStorage e rinnova il cookie
      try {
        localStorage.setItem(STORAGE_KEY_DEVICE_ID, cleanId);
      } catch (err) {
        console.warn('Errore ripristino app_device_id in localStorage:', err);
      }
      setLongLivedCookie(STORAGE_KEY_DEVICE_ID, cleanId, 365);
      return cleanId;
    }

    // 3. Generazione nuovo codice univoco
    let uniqueId = '';
    // Prova crypto.randomUUID() se disponibile
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      try {
        uniqueId = 'DEV-' + crypto.randomUUID();
      } catch {
        // Fallback sotto
      }
    }

    if (!uniqueId) {
      // Robusto generatore casuale per compatibilità WebView Android
      const nowHex = Date.now().toString(36).toUpperCase();
      const rand1 = Math.random().toString(36).substring(2, 8).toUpperCase();
      const rand2 = Math.random().toString(36).substring(2, 8).toUpperCase();
      uniqueId = `DEV-${nowHex}-${rand1}-${rand2}`;
    }

    // Salva sia in localStorage che nel cookie a 365 giorni per persistenza garantita
    try {
      localStorage.setItem(STORAGE_KEY_DEVICE_ID, uniqueId);
    } catch (err) {
      console.warn('Errore salvataggio app_device_id in localStorage:', err);
    }
    setLongLivedCookie(STORAGE_KEY_DEVICE_ID, uniqueId, 365);

    return uniqueId;
  } catch (err) {
    console.error('Errore gestione app_device_id:', err);
    return 'DEV-GK-CLIENT';
  }
}

/**
 * Restituisce le credenziali e la scadenza salvate in localStorage se presenti
 */
export function getSavedAuthSession(): SavedAuthSession | null {
  try {
    const username = localStorage.getItem(STORAGE_KEY_AUTH_USER);
    const password = localStorage.getItem(STORAGE_KEY_AUTH_PASS);
    const scadenza = localStorage.getItem(STORAGE_KEY_AUTH_SCADENZA) || '';

    if (username && password) {
      return { username, password, scadenza };
    }
  } catch (err) {
    console.error('Errore lettura sessione salvata:', err);
  }
  return null;
}

/**
 * Salva le credenziali e la scadenza in localStorage al login con successo
 */
export function saveAuthSession(username: string, password: string, scadenza: string = ''): void {
  try {
    localStorage.setItem(STORAGE_KEY_AUTH_USER, username);
    localStorage.setItem(STORAGE_KEY_AUTH_PASS, password);
    localStorage.setItem(STORAGE_KEY_AUTH_SCADENZA, scadenza || '');
  } catch (err) {
    console.error('Errore salvataggio credenziali:', err);
  }
}

/**
 * Cancella le credenziali salvate (Logout o Account Bloccato)
 * IMPORTANTE: Non cancella MAI app_device_id!
 */
export function clearAuthSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_AUTH_USER);
    localStorage.removeItem(STORAGE_KEY_AUTH_PASS);
    localStorage.removeItem(STORAGE_KEY_AUTH_SCADENZA);
    // Cleanup eventuali vecchie chiavi legacy senza toccare app_device_id
    localStorage.removeItem('gkanaytics_auth_session');
  } catch (err) {
    console.error('Errore cancellazione sessione:', err);
  }
}

/**
 * 3. CHIAMATA ALLO SCRIPT (CORS-Safe con supporto GET e POST)
 * Google Apps Script Web Apps espongono CORS (access-control-allow-origin: *) in modo affidabile
 * sulle richieste HTTP. Se il backend è pubblicato solo come doGet(e), le chiamate POST
 * generano errore "allow: HEAD, GET" e browser "Failed to fetch".
 *
 * Questa funzione implementa una strategia ibrida sicura:
 * 1. Esegue prima la richiesta GET con parametri query (supportata nativamente con CORS da Google Apps Script).
 * 2. Se necessario effettua fallback su richiesta POST con 'Content-Type': 'text/plain;charset=utf-8'.
 */
export async function verifyCredentials(
  username: string,
  password: string
): Promise<ScriptAuthResponse> {
  const deviceId = getOrCreateDeviceId();
  const cleanUsername = username.trim();
  const cleanPassword = password.trim();

  if (!cleanUsername || !cleanPassword) {
    return {
      success: false,
      status: 'NON_TROVATO',
      message: 'Inserisci sia il nome utente che la password.',
    };
  }

  // 1. TENTATIVO PRINCIPALE: GET con query parameters (CORS-Safe garantito)
  try {
    const url = new URL(APPS_SCRIPT_URL);
    url.searchParams.set('username', cleanUsername);
    url.searchParams.set('password', cleanPassword);
    url.searchParams.set('deviceId', deviceId);
    url.searchParams.set('action', 'verify');
    url.searchParams.set('_t', Date.now().toString());

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const getResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (getResponse.ok) {
      const responseText = await getResponse.text();
      try {
        const data = JSON.parse(responseText);
        if (data && typeof data.success !== 'undefined') {
          return data;
        }
      } catch (jsonErr) {
        console.warn('Risposta GET non JSON, provo fallback POST:', responseText, jsonErr);
      }
    }
  } catch (getErr: any) {
    console.warn('Tentativo GET non riuscito, provo POST:', getErr?.message || getErr);
  }

  // 2. TENTATIVO DI FALLBACK: POST con text/plain (nel caso in cui lo script sia stato aggiornato con doPost)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const payload = JSON.stringify({
      username: cleanUsername,
      password: cleanPassword,
      deviceId: deviceId,
      action: 'verify',
    });

    const postResponse = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: payload,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (postResponse.ok) {
      const responseText = await postResponse.text();
      try {
        const data = JSON.parse(responseText);
        if (data && typeof data.success !== 'undefined') {
          return data;
        }
      } catch (jsonErr) {
        console.error('Risposta POST non valida:', responseText, jsonErr);
      }
    }
  } catch (postErr: any) {
    console.error('Anche il tentativo POST è fallito:', postErr?.message || postErr);
  }

  // Se entrambi i metodi non hanno risposto
  return {
    success: false,
    status: 'NETWORK_ERROR',
    message: 'Impossibile connettersi al server. Verifica la connessione a Internet del dispositivo.',
  };
}
