export interface DriveSheetFile {
  id: string;
  name: string;
  webViewLink?: string;
  createdTime?: string;
  modifiedTime?: string;
}

export const SHEET_HEADERS = [
  'Data',
  'Partita',
  'Competizione',
  'Note Partita',
  'Portiere',
  'Squadra',
  'ID Evento',
  'Modalità',
  'Tipo',
  'Esito',
  'Coord Specchio Porta X (%)',
  'Coord Specchio Porta Y (%)',
  'Coord Metà Campo X (%)',
  'Coord Metà Campo Y (%)',
  'Distanza Tiro (m)',
  'xG',
  'xGOT',
  'Lato',
  'Timestamp',
  'Note Evento',
];

export interface ParsedDriveTarget {
  id: string;
  resourceKey?: string;
  isSpreadsheetUrl: boolean;
}

/**
 * Extracts Google Drive Folder ID, Spreadsheet ID, or Resource Key from full URL or returns trimmed raw ID
 */
export function extractFolderId(input: string): string {
  return parseDriveTarget(input).id;
}

export function parseDriveTarget(input: string): ParsedDriveTarget {
  if (!input) return { id: '', isSpreadsheetUrl: false };
  const trimmed = input.trim();

  // Resource key if present
  let resourceKey: string | undefined;
  const rkMatch = trimmed.match(/[?&]resourcekey=([a-zA-Z0-9_-]+)/);
  if (rkMatch && rkMatch[1]) {
    resourceKey = rkMatch[1];
  }

  // Direct Google Sheets link: /spreadsheets/d/([a-zA-Z0-9_-]+)
  const sheetMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (sheetMatch && sheetMatch[1]) {
    return { id: sheetMatch[1], resourceKey, isSpreadsheetUrl: true };
  }

  // Direct File link: /file/d/([a-zA-Z0-9_-]+)
  const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch && fileMatch[1]) {
    return { id: fileMatch[1], resourceKey, isSpreadsheetUrl: false };
  }

  // Folder link: /drive/(u/0/)?folders/([a-zA-Z0-9_-]+)
  const folderMatch = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) {
    return { id: folderMatch[1], resourceKey, isSpreadsheetUrl: false };
  }

  // Query parameter: ?id=([a-zA-Z0-9_-]+)
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return { id: idMatch[1], resourceKey, isSpreadsheetUrl: false };
  }

  // Clean trailing query params or slashes
  const clean = trimmed.split('?')[0].replace(/\/+$/, '');
  const segments = clean.split('/');
  const lastSeg = segments[segments.length - 1] || trimmed;
  return { id: lastSeg, resourceKey, isSpreadsheetUrl: false };
}

/**
 * Parses Goalkeeper name and optional team from spreadsheet filename.
 * Examples:
 * "Gianluigi Buffon (Juventus)" -> name: "Gianluigi Buffon", team: "Juventus"
 * "Manuel Neuer - Bayern" -> name: "Manuel Neuer", team: "Bayern"
 * "Courtois_stats" -> name: "Courtois", team: ""
 */
export function parsePlayerFromFileName(fileName: string): { name: string; team?: string } {
  let cleanName = fileName.replace(/\.xlsx?$/i, '').replace(/_stats$/i, '').trim();

  // Check for (Team)
  const parenMatch = cleanName.match(/^(.*?)\s*\((.*?)\)$/);
  if (parenMatch) {
    return {
      name: parenMatch[1].trim(),
      team: parenMatch[2].trim(),
    };
  }

  // Check for "Name - Team"
  const dashMatch = cleanName.match(/^(.*?)\s*[-–]\s*(.*?)$/);
  if (dashMatch) {
    return {
      name: dashMatch[1].trim(),
      team: dashMatch[2].trim(),
    };
  }

  return { name: cleanName };
}

/**
 * Scans a Google Drive folder for Google Sheets files, or retrieves a direct spreadsheet if linked
 */
export async function scanDriveFolder(
  folderIdOrUrl: string,
  accessToken: string
): Promise<DriveSheetFile[]> {
  const parsed = parseDriveTarget(folderIdOrUrl);
  const cleanId = parsed.id;
  if (!cleanId) {
    throw new Error('Link o ID cartella Google Drive non valido.');
  }

  const reqHeaders: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (parsed.resourceKey) {
    reqHeaders['X-Goog-Drive-Resource-Keys'] = `${cleanId}/${parsed.resourceKey}`;
  }

  // Case 1: If user provided a direct Google Sheets spreadsheet link
  if (parsed.isSpreadsheetUrl) {
    const singleFileUrl = `https://www.googleapis.com/drive/v3/files/${cleanId}?supportsAllDrives=true&fields=id,name,mimeType,createdTime,modifiedTime,webViewLink`;
    const singleResp = await fetch(singleFileUrl, { headers: reqHeaders });

    if (!singleResp.ok) {
      const errText = await singleResp.text();
      handleDriveApiError(singleResp.status, errText, cleanId);
    }

    const singleData = await singleResp.json();
    return [
      {
        id: singleData.id,
        name: singleData.name || 'Foglio Portiere',
        webViewLink: singleData.webViewLink,
        createdTime: singleData.createdTime,
        modifiedTime: singleData.modifiedTime,
      },
    ];
  }

  // Case 2: Scan files inside folder (supports Shared Drives, Shared Folders, and Resource Keys)
  const query = `'${cleanId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,createdTime,modifiedTime,webViewLink)&pageSize=100&orderBy=name`;

  const response = await fetch(url, { headers: reqHeaders });

  if (!response.ok) {
    const errorBody = await response.text();
    handleDriveApiError(response.status, errorBody, cleanId);
  }

  const data = await response.json();
  return (data.files || []) as DriveSheetFile[];
}

function handleDriveApiError(status: number, errorBody: string, targetId: string): never {
  console.error('Google Drive API error:', status, errorBody);
  let errorMsg = '';

  try {
    const errJson = JSON.parse(errorBody);
    const errDetails = errJson?.error?.details || [];
    const hasScopeInsufficient =
      errDetails.some((d: any) => d.reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT') ||
      (errJson?.error?.message && errJson.error.message.includes('insufficient authentication scopes'));

    if (hasScopeInsufficient) {
      errorMsg =
        'Permessi Google non concessi: è necessario abilitare l\'accesso a Google Drive e Google Sheets nella finestra di autorizzazione Google. Clicca su "Salva Impostazioni" e accetta i permessi.';
      throw new Error(errorMsg);
    }

    const rawMessage = errJson?.error?.message || '';

    if (status === 401) {
      errorMsg = 'Sessione Google scaduta o non valida. Clicca su "Salva Impostazioni" per effettuare nuovamente l\'accesso.';
    } else if (status === 403) {
      errorMsg = `Permesso negato per la cartella Google Drive (${targetId}). Verifica che la cartella sia condivisa con l'indirizzo email del tuo account Google (impostata su "Editor" oppure "Chiunque abbia il link").`;
    } else if (status === 404) {
      errorMsg = `Cartella Google Drive non trovata (${targetId}). Verifica che l'ID o il link inserito sia corretto e accessibile dal tuo account Google.`;
    } else {
      errorMsg = rawMessage ? `Errore Google Drive (${status}): ${rawMessage}` : `Errore Google Drive (${status})`;
    }
  } catch (parseErr: any) {
    if (parseErr.message && parseErr.message.includes('Permessi Google')) {
      throw parseErr;
    }
    if (status === 401 || status === 403) {
      errorMsg = `Permesso negato per la cartella Google Drive (${targetId}). Assicurati di aver concesso i permessi di lettura/scrittura a Google Drive e che la cartella sia condivisa con il tuo account.`;
    } else if (status === 404) {
      errorMsg = `Cartella Google Drive non trovata (${targetId}).`;
    } else {
      errorMsg = `Errore di connessione a Google Drive (${status}).`;
    }
  }

  throw new Error(errorMsg);
}

/**
 * Creates a new Goalkeeper Google Sheet inside the specified Google Drive folder
 * and initializes it with standard table headers.
 */
export async function createGoalkeeperSheetInDrive(
  folderId: string,
  playerName: string,
  team: string | undefined,
  accessToken: string
): Promise<{ id: string; name: string; webViewLink?: string }> {
  const cleanFolderId = extractFolderId(folderId);
  if (!cleanFolderId) {
    throw new Error('Google Drive folder ID is missing.');
  }

  const title = `${playerName.trim()}${team && team.trim() ? ` (${team.trim()})` : ''}`;

  // 1. Create file directly with parents via Google Drive API v3
  const driveCreateUrl = 'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink&supportsAllDrives=true';
  const createResp = await fetch(driveCreateUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: title,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [cleanFolderId],
    }),
  });

  if (!createResp.ok) {
    const errText = await createResp.text();
    console.error('Error creating Google Sheet:', errText);
    throw new Error(`Failed to create Google Sheet in Drive folder (${createResp.status}): ${createResp.statusText}`);
  }

  const fileData = await createResp.json();
  const spreadsheetId = fileData.id;

  // 2. Initialize Headers row in the newly created spreadsheet
  const sheetsHeaderUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:T1?valueInputOption=USER_ENTERED`;
  const headerResp = await fetch(sheetsHeaderUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range: 'A1:T1',
      majorDimension: 'ROWS',
      values: [SHEET_HEADERS],
    }),
  });

  if (!headerResp.ok) {
    console.warn('Headers initialization warning:', await headerResp.text());
  }

  return {
    id: spreadsheetId,
    name: fileData.name,
    webViewLink: fileData.webViewLink,
  };
}

/**
 * Creates an online Google Spreadsheet containing the full statistical report in Google Drive.
 */
export async function createStatsReportSheetInDrive(
  folderId: string,
  title: string,
  summaryAoa: any[][],
  eventsAoa: any[][],
  accessToken: string
): Promise<{ id: string; name: string; webViewLink?: string }> {
  const cleanFolderId = extractFolderId(folderId);
  if (!cleanFolderId) {
    throw new Error('Google Drive folder ID is missing.');
  }

  // 1. Create file directly in Google Drive folder
  const driveCreateUrl = 'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink&supportsAllDrives=true';
  const createResp = await fetch(driveCreateUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: title,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [cleanFolderId],
    }),
  });

  if (!createResp.ok) {
    const errText = await createResp.text();
    throw new Error(`Failed to create Google Sheet in Drive folder (${createResp.status}): ${errText}`);
  }

  const fileData = await createResp.json();
  const spreadsheetId = fileData.id;

  // 2. Populate Sheet 1 with Summary Data
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range: 'A1',
      majorDimension: 'ROWS',
      values: summaryAoa,
    }),
  });

  // 3. Rename first sheet and add Events sheet
  try {
    const batchResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: 0,
                title: 'Riepilogo Statistiche',
              },
              fields: 'title',
            },
          },
          {
            addSheet: {
              properties: {
                title: 'Dettaglio Eventi',
              },
            },
          },
        ],
      }),
    });

    if (batchResp.ok) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Dettaglio Eventi'!A1?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: "'Dettaglio Eventi'!A1",
          majorDimension: 'ROWS',
          values: eventsAoa,
        }),
      });
    }
  } catch (e) {
    console.warn('Could not add events sheet in Drive, summary is preserved:', e);
  }

  return {
    id: spreadsheetId,
    name: fileData.name,
    webViewLink: fileData.webViewLink,
  };
}

