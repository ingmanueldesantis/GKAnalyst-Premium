import { SoccerEvent, MatchDetails, Player, EventType, EventOutcome, TrackingMode, MatchSummary } from '../types';
import { SHEET_HEADERS } from './googleDriveService';

export interface SheetMatchInfo {
  key: string;
  date: string;
  matchName: string;
  competition?: string;
  notes?: string;
  eventCount: number;
}

export interface SheetParseResult {
  events: SoccerEvent[];
  matches: SheetMatchInfo[];
  lastMatchDetails?: MatchDetails;
  totalRows: number;
}

const VALID_MODES: TrackingMode[] = ['Saves', 'Corner', 'Cross', 'Distribution'];

function normalizeMode(val: string): TrackingMode {
  if (!val) return 'Saves';
  const lower = val.trim().toLowerCase();
  if (lower.includes('corner') || lower.includes('calcio d\'angolo')) return 'Corner';
  if (lower.includes('cross')) return 'Cross';
  if (lower.includes('distrib') || lower.includes('rinvio') || lower.includes('passaggio')) return 'Distribution';
  return 'Saves';
}

function normalizeOutcome(val: string): EventOutcome {
  if (!val) return 'Saved';
  const clean = val.trim();
  const lower = clean.toLowerCase();
  if (lower.includes('goal') || lower.includes('gol')) return 'Goal';
  if (lower.includes('parata') || lower.includes('salv') || lower.includes('parato')) return 'Saved';
  if (lower.includes('deflect') || lower.includes('deviat')) return 'Deflected';
  if (lower.includes('palo') || lower.includes('traversa') || lower.includes('post')) return 'Post';
  if (lower.includes('block') || lower.includes('blocc')) return 'Blocked';
  if (lower.includes('out') || lower.includes('fuori')) return 'Out';
  if (lower.includes('difesa') || lower.includes('defense')) return 'Defense';
  if (lower.includes('complet') || lower.includes('riusc')) return 'Completed';
  if (lower.includes('fail') || lower.includes('sbagli') || lower.includes('fallit')) return 'Failed';
  return 'Saved';
}

function normalizeType(val: string): EventType {
  if (!val) return 'Shot';
  const clean = val.trim();
  const lower = clean.toLowerCase();
  if (lower.includes('rigore') || lower.includes('penalty')) return 'Penalty';
  if (lower.includes('punizione') || lower.includes('free kick')) return 'Free Kick';
  if (lower.includes('uscita') || lower.includes('rush')) return 'Rush out';
  if (lower.includes('interven')) return 'Intervention';
  if (lower.includes('drop')) return 'Drop Kick';
  if (lower.includes('clear') || lower.includes('spazz')) return 'Clearence';
  if (lower.includes('short hand') || (lower.includes('corto') && lower.includes('mano'))) return 'Short hand pass';
  if (lower.includes('long hand') || (lower.includes('lungo') && lower.includes('mano'))) return 'Long hand pass';
  if (lower.includes('short foot') || (lower.includes('corto') && lower.includes('piede'))) return 'Short foot pass';
  if (lower.includes('long foot') || (lower.includes('lungo') && lower.includes('piede'))) return 'Long foot pass';
  return 'Shot';
}

/**
 * Reads all rows from a goalkeeper's Google Sheet and reconstructs past events & match details
 */
export async function readGoalkeeperSheet(
  spreadsheetId: string,
  accessToken: string,
  playerId?: string
): Promise<SheetParseResult> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A:Z`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Error reading sheet:', errorBody);
    throw new Error(`Failed to read Google Sheet (${response.status}): ${response.statusText}`);
  }

  const data = await response.json();
  const rows: any[][] = data.values || [];

  if (rows.length <= 1) {
    // Empty or only header row
    return { events: [], matches: [], totalRows: rows.length };
  }

  const headerRow = rows[0].map((h: any) => String(h || '').trim().toLowerCase());

  // Find column indices with multilingual synonyms
  const findCol = (terms: string[]) => {
    return headerRow.findIndex((h: string) =>
      terms.some(t => h.includes(t.toLowerCase()))
    );
  };

  // Find column with inclusion terms and exclusion terms (avoids confusion between Goal X and Pitch X)
  const findColExcluding = (terms: string[], exclude: string[]) => {
    return headerRow.findIndex((h: string) => {
      const hasExclude = exclude.some(ex => h.includes(ex.toLowerCase()));
      if (hasExclude) return false;
      return terms.some(t => h.includes(t.toLowerCase()));
    });
  };

  const colDate = findCol(['data', 'date', 'giorno']);
  const colMatch = findCol(['partita', 'match', 'avversario', 'incontro']);
  const colComp = findCol(['competizione', 'competition', 'torneo', 'campionato']);
  const colMatchNotes = findCol(['note partita', 'match note', 'note match']);
  const colEventId = findCol(['id evento', 'event id', 'event_id', 'id']);
  const colMode = findCol(['modalità', 'modalita', 'mode']);
  const colType = findCol(['tipo', 'type']);
  const colOutcome = findCol(['esito', 'outcome', 'result']);

  // Specchio Porta / Goal Frame coordinates (excludes 'metà', 'meta', 'campo', 'pitch')
  const colGoalX = findColExcluding(
    ['coord specchio porta x', 'coord porta x', 'specchio porta x', 'porta x', 'goal x', 'coord x', 'x_coord', 'x'],
    ['metà', 'meta', 'campo', 'pitch']
  );
  const colGoalY = findColExcluding(
    ['coord specchio porta y', 'coord porta y', 'specchio porta y', 'porta y', 'goal y', 'coord y', 'y_coord', 'y'],
    ['metà', 'meta', 'campo', 'pitch']
  );

  // Metà Campo / Half Pitch coordinates
  const colPitchX = findCol(['coord metà campo x', 'coord meta campo x', 'metà campo x', 'meta campo x', 'pitch x', 'coord campo x', 'campo x']);
  const colPitchY = findCol(['coord metà campo y', 'coord meta campo y', 'metà campo y', 'meta campo y', 'pitch y', 'coord campo y', 'campo y']);

  // Metrics
  const colDist = findCol(['distanza tiro', 'distanza (m)', 'distanza', 'distance']);
  const colXG = findCol(['xg', 'exg']);
  const colXGOT = findCol(['xgot']);

  const colSide = findCol(['lato', 'side', 'eventside']);
  const colTime = findCol(['timestamp', 'data e ora', 'orario', 'time']);
  const colEventNotes = findCol(['note evento', 'event notes', 'note', 'notes']);

  const parsedEvents: SoccerEvent[] = [];
  const matchesMap = new Map<string, SheetMatchInfo>();
  const seenEventIds = new Set<string>();
  const seenEventSignatures = new Set<string>();
  let lastMatch: MatchDetails | undefined = undefined;

  let currentMatchDate = '';
  let currentMatchName = '';
  let currentComp = '';
  let currentMatchNotes = '';

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every(cell => !cell || String(cell).trim() === '')) {
      continue;
    }

    const rowDate = colDate >= 0 && row[colDate] ? String(row[colDate]).trim() : '';
    const rowMatch = colMatch >= 0 && row[colMatch] ? String(row[colMatch]).trim() : '';
    const rowComp = colComp >= 0 && row[colComp] ? String(row[colComp]).trim() : '';
    const rowMatchNotes = colMatchNotes >= 0 && row[colMatchNotes] ? String(row[colMatchNotes]).trim() : '';

    if (rowDate) currentMatchDate = rowDate;
    if (rowMatch) currentMatchName = rowMatch;
    if (rowComp) currentComp = rowComp;
    if (rowMatchNotes) currentMatchNotes = rowMatchNotes;

    const activeDate = rowDate || currentMatchDate;
    const activeMatch = rowMatch || currentMatchName;
    const activeComp = rowComp || currentComp;
    const activeMatchNotes = rowMatchNotes || currentMatchNotes;

    if (activeDate || activeMatch) {
      lastMatch = {
        date: activeDate,
        matchName: activeMatch,
        competition: activeComp,
        notes: activeMatchNotes,
      };

      const matchKey = `${activeDate}___${activeMatch}___${activeComp}`.trim();
      if (matchKey && !matchesMap.has(matchKey)) {
        matchesMap.set(matchKey, {
          key: matchKey,
          date: activeDate,
          matchName: activeMatch,
          competition: activeComp,
          notes: activeMatchNotes,
          eventCount: 0,
        });
      }
    }

    const rawType = colType >= 0 ? String(row[colType] || '').trim() : '';
    const rawOutcome = colOutcome >= 0 ? String(row[colOutcome] || '').trim() : '';
    const rawMode = colMode >= 0 ? String(row[colMode] || '').trim() : '';
    const rawId = colEventId >= 0 && row[colEventId] ? String(row[colEventId]).trim() : `evt_${i}_${Date.now()}`;

    const isMatchSummaryOnly = rawMode.toLowerCase() === 'matchsummary' || rawType === '-';

    // If there is an event in this row (exclude placeholder summary rows)
    if (!isMatchSummaryOnly && (rawType || rawOutcome || rawMode || colGoalX >= 0 || colPitchX >= 0)) {
      const rawGoalX = colGoalX >= 0 && row[colGoalX] !== undefined && String(row[colGoalX]).trim() !== ''
        ? parseFloat(row[colGoalX])
        : -1;
      const rawGoalY = colGoalY >= 0 && row[colGoalY] !== undefined && String(row[colGoalY]).trim() !== ''
        ? parseFloat(row[colGoalY])
        : -1;

      const rawPitchX = colPitchX >= 0 && row[colPitchX] !== undefined && String(row[colPitchX]).trim() !== ''
        ? parseFloat(row[colPitchX])
        : undefined;
      const rawPitchY = colPitchY >= 0 && row[colPitchY] !== undefined && String(row[colPitchY]).trim() !== ''
        ? parseFloat(row[colPitchY])
        : undefined;

      const rawDist = colDist >= 0 && row[colDist] !== undefined && String(row[colDist]).trim() !== ''
        ? parseFloat(row[colDist])
        : undefined;
      const rawXG = colXG >= 0 && row[colXG] !== undefined && String(row[colXG]).trim() !== ''
        ? parseFloat(row[colXG])
        : undefined;
      const rawXGOT = colXGOT >= 0 && row[colXGOT] !== undefined && String(row[colXGOT]).trim() !== ''
        ? parseFloat(row[colXGOT])
        : undefined;

      const rawSide = colSide >= 0 ? String(row[colSide] || '').toLowerCase() : '';
      const side: 'left' | 'right' | undefined =
        rawSide.includes('left') || rawSide.includes('sinist')
          ? 'left'
          : rawSide.includes('right') || rawSide.includes('destr')
          ? 'right'
          : undefined;

      let timestamp = Date.now();
      if (colTime >= 0 && row[colTime]) {
        const parsedT = Date.parse(row[colTime]);
        if (!isNaN(parsedT)) {
          timestamp = parsedT;
        }
      }

      // Check if this row is an exact duplicate row
      const eventSig = `${activeDate}|${activeMatch}|${rawType}|${rawOutcome}|${rawGoalX}|${rawGoalY}|${rawPitchX}|${rawPitchY}|${rawDist}|${timestamp}|${rawId}`;
      if (seenEventSignatures.has(eventSig)) {
        continue; // Skip exact duplicate row
      }
      seenEventSignatures.add(eventSig);

      // Ensure unique event ID to prevent duplicate React keys
      let finalId = rawId;
      if (!finalId || seenEventIds.has(finalId)) {
        finalId = `${rawId || 'evt'}_r${i}_${Math.random().toString(36).substring(2, 7)}`;
      }
      seenEventIds.add(finalId);

      parsedEvents.push({
        id: finalId,
        playerId: playerId || spreadsheetId,
        type: normalizeType(rawType),
        outcome: normalizeOutcome(rawOutcome),
        mode: normalizeMode(rawMode),
        x: isNaN(rawGoalX) ? -1 : rawGoalX,
        y: isNaN(rawGoalY) ? -1 : rawGoalY,
        pitchX: rawPitchX !== undefined && !isNaN(rawPitchX) ? rawPitchX : undefined,
        pitchY: rawPitchY !== undefined && !isNaN(rawPitchY) ? rawPitchY : undefined,
        shotDistance: rawDist !== undefined && !isNaN(rawDist) ? rawDist : undefined,
        xG: rawXG !== undefined && !isNaN(rawXG) ? rawXG : undefined,
        xGOT: rawXGOT !== undefined && !isNaN(rawXGOT) ? rawXGOT : undefined,
        eventSide: side,
        timestamp,
        notes: colEventNotes >= 0 && row[colEventNotes] ? String(row[colEventNotes]).trim() : undefined,
        matchDate: activeDate,
        matchName: activeMatch,
        competition: activeComp,
      });

      const matchKey = `${activeDate}___${activeMatch}___${activeComp}`.trim();
      if (matchKey && matchesMap.has(matchKey)) {
        matchesMap.get(matchKey)!.eventCount++;
      }
    }
  }

  // Sort matches reverse chronologically (newest first)
  const matchesList = Array.from(matchesMap.values()).sort((a, b) => {
    if (a.date && b.date) {
      return b.date.localeCompare(a.date);
    }
    return (b.date ? 1 : 0) - (a.date ? 1 : 0);
  });

  return {
    events: parsedEvents,
    matches: matchesList,
    lastMatchDetails: lastMatch,
    totalRows: rows.length,
  };
}

/**
 * Appends new match and event data to the bottom of the goalkeeper's Google Sheet
 */
export async function appendMatchToSheet(
  spreadsheetId: string,
  player: Player,
  matchDetails: MatchDetails,
  eventsToAppend: SoccerEvent[],
  accessToken: string
): Promise<{ appendedRows: number }> {
  // First check what headers exist in row 1
  const checkUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:Z1`;
  const checkResp = await fetch(checkUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  let activeHeaders: string[] = [...SHEET_HEADERS];

  if (checkResp.ok) {
    const checkData = await checkResp.json();
    if (!checkData.values || checkData.values.length === 0) {
      // Row 1 is empty, write standard SHEET_HEADERS
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:T1?valueInputOption=USER_ENTERED`, {
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
      activeHeaders = [...SHEET_HEADERS];
    } else {
      const existingHeaders = (checkData.values[0] as string[]).map(h => String(h || '').trim());
      // Check if existing headers has Metà Campo / Pitch coordinates
      const lowerExisting = existingHeaders.map(h => h.toLowerCase());
      const hasPitchCoord = lowerExisting.some(h => h.includes('metà campo') || h.includes('meta campo') || h.includes('pitch'));

      if (!hasPitchCoord) {
        // Check if there are data rows or if only row 1 exists
        const countUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:A3`;
        const countResp = await fetch(countUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const countData = countResp.ok ? await countResp.json() : null;
        const totalSampleRows = countData?.values?.length || 0;

        if (totalSampleRows <= 1) {
          // Only header row exists with no data, safe to replace row 1 with full SHEET_HEADERS
          await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:T1?valueInputOption=USER_ENTERED`, {
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
          activeHeaders = [...SHEET_HEADERS];
        } else {
          // Data already exists in older format. Append missing columns to row 1 so existing data is not misaligned!
          const missingCols = [
            'Coord Metà Campo X (%)',
            'Coord Metà Campo Y (%)',
            'Distanza Tiro (m)',
            'xG',
            'xGOT',
          ];
          const updatedHeaders = [...existingHeaders, ...missingCols];

          await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:Z1?valueInputOption=USER_ENTERED`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              range: 'A1:Z1',
              majorDimension: 'ROWS',
              values: [updatedHeaders],
            }),
          });
          activeHeaders = updatedHeaders;
        }
      } else {
        activeHeaders = existingHeaders;
      }
    }
  }

  // Helper to build a row conforming to activeHeaders
  const buildRow = (evt: SoccerEvent | null): any[] => {
    return activeHeaders.map((header) => {
      const h = header.toLowerCase();

      // Date
      if (h.includes('data') || h.includes('date') || h.includes('giorno')) {
        return matchDetails.date || '';
      }
      // Match name
      if (h.includes('partita') || h.includes('match') || h.includes('avversario') || h.includes('incontro')) {
        return matchDetails.matchName || '';
      }
      // Competition
      if (h.includes('competizione') || h.includes('competition') || h.includes('torneo') || h.includes('campionato')) {
        return matchDetails.competition || '';
      }
      // Match notes
      if (h.includes('note partita') || h.includes('match note')) {
        return matchDetails.notes || '';
      }
      // Goalkeeper / Portiere
      if (h.includes('portiere') || h.includes('goalkeeper') || h.includes('player')) {
        return player.name;
      }
      // Team / Squadra
      if (h.includes('squadra') || h.includes('team')) {
        return player.team || '';
      }
      // Event ID
      if (h.includes('id evento') || h.includes('event id') || h === 'id') {
        return evt ? evt.id : `match_${Date.now()}`;
      }
      // Mode / Modalità
      if (h.includes('modalità') || h.includes('modalita') || h.includes('mode')) {
        return evt ? evt.mode : 'MatchSummary';
      }
      // Type / Tipo
      if (h.includes('tipo') || h.includes('type')) {
        return evt ? evt.type : '-';
      }
      // Outcome / Esito
      if (h.includes('esito') || h.includes('outcome') || h.includes('risultato')) {
        return evt ? evt.outcome : '-';
      }
      // Half Pitch X (Metà Campo X - Metà Campo & Calcolo xGOT Concessi)
      if (h.includes('metà campo x') || h.includes('meta campo x') || h.includes('pitch x') || h.includes('campo x')) {
        return evt && evt.pitchX !== undefined && typeof evt.pitchX === 'number' && !isNaN(evt.pitchX) && evt.pitchX >= 0 ? Number(evt.pitchX.toFixed(1)) : '';
      }
      // Half Pitch Y (Metà Campo Y - Metà Campo & Calcolo xGOT Concessi)
      if (h.includes('metà campo y') || h.includes('meta campo y') || h.includes('pitch y') || h.includes('campo y')) {
        return evt && evt.pitchY !== undefined && typeof evt.pitchY === 'number' && !isNaN(evt.pitchY) && evt.pitchY >= 0 ? Number(evt.pitchY.toFixed(1)) : '';
      }
      // Goal Frame X (Specchio Porta X - Tocca per registrare evento)
      if (
        (h.includes('specchio') && h.includes('x')) ||
        (h.includes('porta') && h.includes('x')) ||
        h.includes('goal x') ||
        h === 'coord x' ||
        h === 'x'
      ) {
        return evt && evt.x !== undefined && typeof evt.x === 'number' && !isNaN(evt.x) && evt.x >= 0 ? Number(evt.x.toFixed(1)) : '';
      }
      // Goal Frame Y (Specchio Porta Y - Tocca per registrare evento)
      if (
        (h.includes('specchio') && h.includes('y')) ||
        (h.includes('porta') && h.includes('y')) ||
        h.includes('goal y') ||
        h === 'coord y' ||
        h === 'y'
      ) {
        return evt && evt.y !== undefined && typeof evt.y === 'number' && !isNaN(evt.y) && evt.y >= 0 ? Number(evt.y.toFixed(1)) : '';
      }
      // Distance (m)
      if (h.includes('distanza') || h.includes('distance')) {
        return evt && evt.shotDistance !== undefined && typeof evt.shotDistance === 'number' && !isNaN(evt.shotDistance) && evt.shotDistance > 0 ? Number(evt.shotDistance.toFixed(1)) : '';
      }
      // xG
      if (h === 'xg' || h.includes('xg (')) {
        return evt && evt.xG !== undefined && typeof evt.xG === 'number' && !isNaN(evt.xG) ? Number(evt.xG.toFixed(2)) : '';
      }
      // xGOT
      if (h === 'xgot' || h.includes('xgot (')) {
        return evt && evt.xGOT !== undefined && typeof evt.xGOT === 'number' && !isNaN(evt.xGOT) ? Number(evt.xGOT.toFixed(2)) : '';
      }
      // Side / Lato
      if (h.includes('lato') || h.includes('side')) {
        return evt?.eventSide || '';
      }
      // Timestamp
      if (h.includes('timestamp') || h.includes('orario') || h.includes('ora') || h.includes('time')) {
        return evt ? new Date(evt.timestamp).toLocaleString() : new Date().toLocaleString();
      }
      // Event notes
      if (h.includes('note evento') || h.includes('note') || h.includes('notes')) {
        return evt ? (evt.notes || '') : 'Nessun evento registrato nella partita';
      }

      return '';
    });
  };

  const rowsToInsert: any[][] = [];

  if (eventsToAppend.length === 0) {
    // Append at least one row representing the match session
    rowsToInsert.push(buildRow(null));
  } else {
    for (const evt of eventsToAppend) {
      rowsToInsert.push(buildRow(evt));
    }
  }

  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const appendResp = await fetch(appendUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range: 'A1',
      majorDimension: 'ROWS',
      values: rowsToInsert,
    }),
  });

  if (!appendResp.ok) {
    const errorBody = await appendResp.text();
    console.error('Append error:', errorBody);
    throw new Error(`Failed to append match data to Google Sheet (${appendResp.status}): ${appendResp.statusText}`);
  }

  return { appendedRows: rowsToInsert.length };
}
