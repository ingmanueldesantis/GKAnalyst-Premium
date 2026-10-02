/**
 * Google Drive Synchronization Service for GKAnalytics
 * Communicates with the Google Apps Script Web App Backend via POST requests.
 * Uses 'Content-Type: text/plain;charset=utf-8' to prevent CORS preflight issues
 * and avoid popup blocks in Android WebView / Capacitor APK.
 */

import { APPS_SCRIPT_URL } from './authService';
import { Player, SoccerEvent, MatchDetails } from '../types';

export interface DriveDatabasePayload {
  version?: string;
  lastUpdated?: string;
  folderId?: string;
  email?: string;
  players: Player[];
  events: SoccerEvent[];
  matchDetails?: MatchDetails;
}

export interface DriveSaveResult {
  success: boolean;
  status: string;
  message: string;
  fileId?: string;
  fileName?: string;
  folderName?: string;
  lastUpdated?: string;
}

export interface DriveLoadResult {
  success: boolean;
  status: string;
  data: DriveDatabasePayload | null;
  folderName?: string;
  fileId?: string;
  fileName?: string;
  lastUpdated?: string;
  message?: string;
}

export interface DriveCheckResult {
  success: boolean;
  status: string;
  folderId?: string;
  folderName?: string;
  message?: string;
}

/**
 * Extracts Google Drive Folder ID from full URL (e.g. https://drive.google.com/drive/folders/ID_CARTELLA)
 * or returns clean ID.
 */
export function extractFolderId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();

  // Pattern: /folders/([a-zA-Z0-9_-]+)
  const folderMatch = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) {
    return folderMatch[1];
  }

  // Pattern: ?id=([a-zA-Z0-9_-]+)
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }

  // Clean trailing query params or slashes
  const clean = trimmed.split('?')[0].replace(/\/+$/, '');
  const segments = clean.split('/');
  return segments[segments.length - 1] || trimmed;
}

/**
 * Checks if a Google Drive folder is accessible via Google Apps Script
 */
export async function checkDriveFolder(
  folderInput: string,
  email?: string
): Promise<DriveCheckResult> {
  const folderId = extractFolderId(folderInput);
  if (!folderId) {
    return {
      success: false,
      status: 'INVALID_FOLDER_ID',
      message: 'Link o ID della cartella Google Drive non valido.',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const payload = JSON.stringify({
      action: 'drive_check',
      folderId,
      email: email || '',
    });

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: payload,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        status: 'HTTP_ERROR',
        message: `Errore server Google Apps Script (${response.status})`,
      };
    }

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return data;
    } catch {
      return {
        success: false,
        status: 'PARSE_ERROR',
        message: 'Risposta del server non valida.',
      };
    }
  } catch (err: any) {
    console.error('checkDriveFolder error:', err);
    return {
      success: false,
      status: 'NETWORK_ERROR',
      message: err.name === 'AbortError'
        ? 'Tempo scaduto durante la connessione alla cartella Google Drive.'
        : 'Impossibile connettersi a Google Apps Script. Verifica la connessione a Internet.',
    };
  }
}

/**
 * Saves the database JSON (players, events, matchDetails) directly into the Google Drive folder
 * via Google Apps Script.
 */
export async function saveDatabaseToDrive(
  folderInput: string,
  payload: {
    players: Player[];
    events: SoccerEvent[];
    matchDetails?: MatchDetails;
    email?: string;
  }
): Promise<DriveSaveResult> {
  const folderId = extractFolderId(folderInput);
  if (!folderId) {
    return {
      success: false,
      status: 'INVALID_FOLDER_ID',
      message: 'Link o ID della cartella Google Drive non valido.',
    };
  }

  const databasePayload: DriveDatabasePayload = {
    version: '5.2',
    lastUpdated: new Date().toISOString(),
    folderId,
    email: payload.email || '',
    players: payload.players,
    events: payload.events,
    matchDetails: payload.matchDetails,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const requestBody = JSON.stringify({
      action: 'drive_save',
      folderId,
      email: payload.email || '',
      data: databasePayload,
    });

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: requestBody,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        status: 'HTTP_ERROR',
        message: `Errore salvataggio Google Apps Script (${response.status})`,
      };
    }

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return data;
    } catch {
      return {
        success: false,
        status: 'PARSE_ERROR',
        message: 'Risposta di salvataggio non valida dal server.',
      };
    }
  } catch (err: any) {
    console.error('saveDatabaseToDrive error:', err);
    return {
      success: false,
      status: 'NETWORK_ERROR',
      message: err.name === 'AbortError'
        ? 'Tempo scaduto durante il salvataggio su Google Drive.'
        : 'Errore di rete durante il salvataggio su Google Drive.',
    };
  }
}

/**
 * Loads the database JSON from the Google Drive folder via Google Apps Script.
 */
export async function loadDatabaseFromDrive(
  folderInput: string,
  email?: string
): Promise<DriveLoadResult> {
  const folderId = extractFolderId(folderInput);
  if (!folderId) {
    return {
      success: false,
      status: 'INVALID_FOLDER_ID',
      data: null,
      message: 'Link o ID cartella Google Drive non valido.',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const requestBody = JSON.stringify({
      action: 'drive_load',
      folderId,
      email: email || '',
    });

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: requestBody,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        status: 'HTTP_ERROR',
        data: null,
        message: `Errore caricamento da Google Apps Script (${response.status})`,
      };
    }

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return data;
    } catch {
      return {
        success: false,
        status: 'PARSE_ERROR',
        data: null,
        message: 'Risposta di caricamento non valida dal server.',
      };
    }
  } catch (err: any) {
    console.error('loadDatabaseFromDrive error:', err);
    return {
      success: false,
      status: 'NETWORK_ERROR',
      data: null,
      message: err.name === 'AbortError'
        ? 'Tempo scaduto durante il caricamento da Google Drive.'
        : 'Errore di rete durante il caricamento da Google Drive.',
    };
  }
}
