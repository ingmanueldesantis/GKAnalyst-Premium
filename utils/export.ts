import * as XLSX from 'xlsx';
import { SoccerEvent, Player, MatchDetails, Language, EventType } from '../types';
import { calculateSessionXgotSummary, pitchCoordsToMeters, getPitchZoneName } from './xgotCalculator';

export function exportToCsv(data: SoccerEvent[], filename: string): void {
  if (data.length === 0) {
    alert("No data to export.");
    return;
  }

  const headers = [
    'id',
    'playerId',
    'matchDate',
    'matchName',
    'competition',
    'type',
    'outcome',
    'goalX',
    'goalY',
    'pitchX',
    'pitchY',
    'shotDistance',
    'shotAngle',
    'xG',
    'xGOT',
    'timestamp',
    'notes',
    'mode',
    'eventSide',
  ];
  const csvRows = [
    headers.join(','),
    ...data.map(row => 
      headers.map(fieldName => {
        let value: any;
        if (fieldName === 'goalX') value = row.x >= 0 ? row.x : '';
        else if (fieldName === 'goalY') value = row.y >= 0 ? row.y : '';
        else value = (row as any)[fieldName];

        if (typeof value === 'string') {
          const escapedValue = value.replace(/"/g, '""');
          return `"${escapedValue}"`;
        }
        return value === undefined || value === null ? '' : value;
      }).join(',')
    )
  ];

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8' });

  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

const shotEventTypesForStats: EventType[] = ['Shot', 'Free Kick', 'Rush out', 'Penalty'];

function calculateMatchMinutes(details?: Partial<MatchDetails>): number {
  const rawDuration = parseInt(details?.duration || '90', 10);
  const duration = isNaN(rawDuration) || rawDuration <= 0 ? 90 : rawDuration;
  const isStarter = details?.starter !== 'no';

  const subInMin = details?.subIn && details?.subInMinute ? parseInt(details.subInMinute, 10) : undefined;
  const subOutMin = details?.subOut && details?.subOutMinute ? parseInt(details.subOutMinute, 10) : undefined;

  if (isStarter) {
    if (subOutMin !== undefined && !isNaN(subOutMin)) {
      return Math.min(duration, Math.max(0, subOutMin));
    }
    return duration;
  } else {
    if (subInMin !== undefined && !isNaN(subInMin)) {
      if (subOutMin !== undefined && !isNaN(subOutMin)) {
        return Math.max(0, Math.min(duration, subOutMin) - Math.min(duration, subInMin));
      }
      return Math.max(0, duration - Math.min(duration, subInMin));
    }
    return 0;
  }
}

export interface ExportStatsToXlsxOptions {
  events: SoccerEvent[];
  player: Player;
  filterLabel: string;
  currentMatchDetails?: MatchDetails;
  language?: Language;
  filename: string;
}

export function exportStatsToXlsx({
  events,
  player,
  filterLabel,
  currentMatchDetails,
  language = 'it',
  filename,
}: ExportStatsToXlsxOptions): void {
  const isIt = language === 'it';
  const isEs = language === 'es';

  // Group events by match
  const matchMap = new Map<string, {
    key: string;
    date: string;
    matchName: string;
    competition: string;
    events: SoccerEvent[];
  }>();

  for (const e of events) {
    const date = (e.matchDate || '').trim();
    const matchName = (e.matchName || '').trim();
    const competition = (e.competition || '').trim();
    const displayDate = date || (e.timestamp ? new Date(e.timestamp).toISOString().split('T')[0] : '');
    const key = `${displayDate}___${matchName}___${competition}`;

    if (!matchMap.has(key)) {
      matchMap.set(key, {
        key,
        date: displayDate,
        matchName,
        competition,
        events: [],
      });
    }
    matchMap.get(key)!.events.push(e);
  }

  const matchGroups = Array.from(matchMap.values());

  // General KPIs
  const shotsFaced = events.filter((e) => shotEventTypesForStats.includes(e.type)).length;
  const goalsConceded = events.filter((e) => shotEventTypesForStats.includes(e.type) && e.outcome === 'Goal').length;
  const posts = events.filter((e) => shotEventTypesForStats.includes(e.type) && e.outcome === 'Post').length;
  const savesMade = Math.max(0, shotsFaced - goalsConceded - posts);
  const savePercentage = shotsFaced > 0 ? (((shotsFaced - goalsConceded) / shotsFaced) * 100).toFixed(1) : '0.0';

  const matchesCount = matchGroups.length > 0 ? matchGroups.length : (events.length > 0 ? 1 : 0);

  let totalMinutesPlayed = 0;
  if (matchGroups.length === 0) {
    if (events.length > 0) {
      totalMinutesPlayed = calculateMatchMinutes(currentMatchDetails);
    }
  } else {
    for (const group of matchGroups) {
      const isCurrent =
        currentMatchDetails &&
        (currentMatchDetails.date || '').trim() === group.date.trim() &&
        (currentMatchDetails.matchName || '').trim() === group.matchName.trim();

      if (isCurrent) {
        totalMinutesPlayed += calculateMatchMinutes(currentMatchDetails);
      } else {
        let duration = 90;
        const anyNote = group.events.find((e) => e.notes)?.notes || '';
        if (anyNote.includes('80 min') || anyNote.includes("80'")) {
          duration = 80;
        }
        totalMinutesPlayed += duration;
      }
    }
  }

  let cleanSheets = 0;
  if (matchGroups.length === 0) {
    if (events.length > 0 && goalsConceded === 0) {
      cleanSheets = 1;
    }
  } else {
    for (const group of matchGroups) {
      const matchGoals = group.events.filter(
        (e) => shotEventTypesForStats.includes(e.type) && e.outcome === 'Goal'
      ).length;
      if (matchGoals === 0) {
        cleanSheets++;
      }
    }
  }

  let goalsPerMinutesDisplay = '-';
  let goalsPer90Display = '-';
  if (goalsConceded === 0) {
    goalsPerMinutesDisplay = '0';
    goalsPer90Display = totalMinutesPlayed > 0 ? '0.00' : '-';
  } else if (totalMinutesPlayed > 0) {
    const minPerGoal = Math.round(totalMinutesPlayed / goalsConceded);
    goalsPerMinutesDisplay = `1 gol / ${minPerGoal}'`;
    goalsPer90Display = ((goalsConceded / totalMinutesPlayed) * 90).toFixed(2);
  }

  // xGOT Summary
  const xgotSummary = calculateSessionXgotSummary(events);

  // Distribution calculations
  const isDist = (e: SoccerEvent) => {
    if (e.mode === 'Distribution') return true;
    const t = (e.type || '').toLowerCase();
    return (
      t.includes('pass') ||
      t.includes('hand') ||
      t.includes('foot') ||
      t.includes('drop') ||
      t.includes('clear') ||
      t.includes('rinvio') ||
      t.includes('spazz')
    );
  };
  const distEvents = events.filter(isDist);
  const isHand = (e: SoccerEvent) => {
    const t = (e.type || '').toLowerCase();
    return (
      e.type === 'Short hand pass' ||
      e.type === 'Long hand pass' ||
      t.includes('hand') ||
      t.includes('mano') ||
      t.includes('mani')
    );
  };
  const isShort = (e: SoccerEvent) => {
    const t = (e.type || '').toLowerCase();
    return t.includes('short') || t.includes('cort');
  };
  const isLong = (e: SoccerEvent) => {
    const t = (e.type || '').toLowerCase();
    return t.includes('long') || t.includes('lung') || t.includes('drop') || t.includes('clear') || t.includes('spazz');
  };
  const isComp = (e: SoccerEvent) =>
    e.outcome === 'Completed' || String(e.outcome).toLowerCase().includes('complet');
  const isFail = (e: SoccerEvent) =>
    e.outcome === 'Failed' ||
    String(e.outcome).toLowerCase().includes('fail') ||
    String(e.outcome).toLowerCase().includes('fallit') ||
    String(e.outcome).toLowerCase().includes('sbagli');

  const handEvents = distEvents.filter(isHand);
  const handComp = handEvents.filter(isComp).length;
  const handFail = handEvents.filter(isFail).length;
  const handTot = handComp + handFail;
  const handPerc = handTot > 0 ? ((handComp / handTot) * 100).toFixed(1) : '0.0';
  const handShortComp = handEvents.filter(isComp).filter(isShort).length;
  const handShortFail = handEvents.filter(isFail).filter(isShort).length;
  const handLongComp = handEvents.filter(isComp).filter(isLong).length;
  const handLongFail = handEvents.filter(isFail).filter(isLong).length;

  const footEvents = distEvents.filter(e => !isHand(e));
  const footComp = footEvents.filter(isComp).length;
  const footFail = footEvents.filter(isFail).length;
  const footTot = footComp + footFail;
  const footPerc = footTot > 0 ? ((footComp / footTot) * 100).toFixed(1) : '0.0';
  const footShortComp = footEvents.filter(isComp).filter(isShort).length;
  const footShortFail = footEvents.filter(isFail).filter(isShort).length;
  const footLongComp = footEvents.filter(isComp).filter(isLong).length;
  const footLongFail = footEvents.filter(isFail).filter(isLong).length;

  const distComp = handComp + footComp;
  const distFail = handFail + footFail;
  const distTot = distComp + distFail;
  const distPerc = distTot > 0 ? ((distComp / distTot) * 100).toFixed(1) : '0.0';

  // --- SHEET 1: Performance Summary ---
  const summaryRows: any[][] = [
    [isIt ? "GKANALYTICS - RAPPORTO PRESTAZIONI PORTIERE" : isEs ? "GKANALYTICS - INFORME DE RENDIMIENTO" : "GKANALYTICS - GOALKEEPER PERFORMANCE REPORT"],
    [],
    [isIt ? "INFORMAZIONI GENERALI" : "GENERAL INFORMATION"],
    [isIt ? "Portiere" : "Goalkeeper", player.name],
    [isIt ? "Squadra" : "Team", player.team || '-'],
    [isIt ? "Filtro Applicato" : "Applied Filter", filterLabel],
    [isIt ? "Data Esportazione" : "Export Date", new Date().toLocaleString()],
    [isIt ? "Totale Eventi Analizzati" : "Total Events Analyzed", events.length],
    [],
    [isIt ? "1. INDICATORI CHIAVE (KPI)" : "1. KEY PERFORMANCE INDICATORS (KPI)"],
    [isIt ? "Numero Partite" : "Number of Matches", matchesCount],
    [isIt ? "Minuti Giocati" : "Minutes Played", `${totalMinutesPlayed}'`],
    [isIt ? "Gol Subiti" : "Goals Conceded", goalsConceded],
    [isIt ? "Clean Sheets (Porta Inviolata)" : "Clean Sheets", cleanSheets],
    [isIt ? "Tiri Subiti Nello Specchio" : "Shots Faced on Target", shotsFaced],
    [isIt ? "Parate Effettuate" : "Saves Made", savesMade],
    [isIt ? "% Parate Effettuate" : "% Saves Made", `${savePercentage}%`],
    [isIt ? "Frequenza Gol Subiti" : "Goals / Minutes", goalsPerMinutesDisplay],
    [isIt ? "Media Gol Subiti per 90'" : "Goals Conceded per 90'", goalsPer90Display],
    [],
    [isIt ? "2. ANALISI xGOT (POST-SHOT xG) & GOL EVITATI (MODELLO OPTA / STATSBOMB)" : "2. xGOT & GOALS PREVENTED ANALYSIS (OPTA / STATSBOMB MODEL)"],
    [isIt ? "xGOT Concessi Totali" : "Total xGOT Conceded", Number(xgotSummary.totalXgotConceded.toFixed(2))],
    [isIt ? "xG Pre-Tiro Totale (Pericolosità base)" : "Pre-Shot xG Total", Number(xgotSummary.totalXGConceded.toFixed(2))],
    [isIt ? "Gol Evitati / Salvati (xGOT - Gol Subiti)" : "Goals Prevented (xGOT - Goals)", Number(xgotSummary.goalsPrevented.toFixed(2))],
    [isIt ? "Tiri Nello Specchio Analizzati" : "Shots on Target Analyzed", xgotSummary.shotsOnTarget],
    [isIt ? "Parate su Tiri Nello Specchio" : "Saves on Target", xgotSummary.savesOnTarget],
    [isIt ? "xGOT Medio per Tiro Nello Specchio (Difficoltà media)" : "Avg xGOT per Shot on Target", xgotSummary.avgXgotPerShotOnTarget > 0 ? Number(xgotSummary.avgXgotPerShotOnTarget.toFixed(2)) : '-'],
    [],
    [isIt ? "3. ANALISI DISTRIBUZIONE & GESTIONE DEL POSSESSO" : "3. DISTRIBUTION & POSSESSION MANAGEMENT"],
    [isIt ? "Totale Distribuzioni" : "Total Distributions", distTot],
    [isIt ? "Distribuzioni Completate (a segno)" : "Completed Distributions", distComp],
    [isIt ? "Distribuzioni Fallite (perse)" : "Failed Distributions", distFail],
    [isIt ? "% Successo Generale" : "Overall Completion %", `${distPerc}%`],
    [],
    [isIt ? "3.1 Distribuzione con le Mani" : "3.1 Hand Distribution"],
    [isIt ? "Totale con le Mani" : "Total Hand", handTot],
    [isIt ? "Completati con le Mani" : "Completed Hand", handComp],
    [isIt ? "Falliti con le Mani" : "Failed Hand", handFail],
    [isIt ? "% Successo Mani" : "Hand Success %", `${handPerc}%`],
    [isIt ? "Passaggi Corti Mani (Completati / Falliti)" : "Short Hand Throws (Comp / Fail)", `${handShortComp} comp. / ${handShortFail} fall.`],
    [isIt ? "Rinvii Lunghi Mani (Completati / Falliti)" : "Long Hand Throws (Comp / Fail)", `${handLongComp} comp. / ${handLongFail} fall.`],
    [],
    [isIt ? "3.2 Distribuzione con i Piedi" : "3.2 Foot Distribution"],
    [isIt ? "Totale con i Piedi" : "Total Foot", footTot],
    [isIt ? "Completati con i Piedi" : "Completed Foot", footComp],
    [isIt ? "Falliti con i Piedi" : "Failed Foot", footFail],
    [isIt ? "% Successo Piedi" : "Foot Success %", `${footPerc}%`],
    [isIt ? "Passaggi Corti Piedi (Completati / Falliti)" : "Short Foot Passes (Comp / Fail)", `${footShortComp} comp. / ${footShortFail} fall.`],
    [isIt ? "Rinvii Lunghi Piedi / Drop (Completati / Falliti)" : "Long Foot Passes / Drop (Comp / Fail)", `${footLongComp} comp. / ${footLongFail} fall.`],
  ];

  // If there are multiple match groups, append match list summary
  if (matchGroups.length > 0) {
    summaryRows.push([]);
    summaryRows.push([isIt ? "4. RIEPILOGO DELLE PARTITE INCLUSE" : "4. MATCHES INCLUDED SUMMARY"]);
    summaryRows.push([
      isIt ? "Data" : "Date",
      isIt ? "Partita / Avversario" : "Match / Opponent",
      isIt ? "Competizione" : "Competition",
      isIt ? "Gol Subiti" : "Goals Conceded",
      isIt ? "Clean Sheet" : "Clean Sheet",
      isIt ? "Eventi Registrati" : "Recorded Events",
    ]);

    for (const g of matchGroups) {
      const gGoals = g.events.filter((e) => shotEventTypesForStats.includes(e.type) && e.outcome === 'Goal').length;
      summaryRows.push([
        g.date || '-',
        g.matchName || (isIt ? 'Partita senza titolo' : 'Untitled match'),
        g.competition || '-',
        gGoals,
        gGoals === 0 ? (isIt ? 'Sì' : 'Yes') : 'No',
        g.events.length,
      ]);
    }
  }

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [
    { wch: 38 },
    { wch: 32 },
    { wch: 22 },
    { wch: 16 },
    { wch: 14 },
    { wch: 18 },
  ];

  // --- SHEET 2: Event Details ---
  const eventsTableData = events.map((event, idx) => {
    const coords = event.pitchX !== undefined && event.pitchY !== undefined 
      ? pitchCoordsToMeters(event.pitchX, event.pitchY) 
      : null;
    const zoneName = coords ? getPitchZoneName(coords.xMeters, coords.yMeters, language) : '';

    return {
      "#": idx + 1,
      ID: event.id,
      [isIt ? "Data Partita" : "Match Date"]: event.matchDate || (event.timestamp ? new Date(event.timestamp).toISOString().split('T')[0] : ''),
      [isIt ? "Partita" : "Match"]: event.matchName || '',
      [isIt ? "Competizione" : "Competition"]: event.competition || '',
      [isIt ? "Tipo Evento" : "Event Type"]: event.type,
      [isIt ? "Esito" : "Outcome"]: event.outcome,
      [isIt ? "Modalità" : "Mode"]: event.mode,
      [isIt ? "Lato" : "Side"]: event.eventSide || '',
      [isIt ? "Porta X (%)" : "Goal X (%)"]: event.x >= 0 ? event.x : '',
      [isIt ? "Porta Y (%)" : "Goal Y (%)"]: event.y >= 0 ? event.y : '',
      [isIt ? "Campo X (%)" : "Pitch X (%)"]: event.pitchX !== undefined ? event.pitchX : '',
      [isIt ? "Campo Y (%)" : "Pitch Y (%)"]: event.pitchY !== undefined ? event.pitchY : '',
      [isIt ? "Distanza (m)" : "Distance (m)"]: event.shotDistance !== undefined ? event.shotDistance : (coords ? coords.distance : ''),
      [isIt ? "Angolo Tiro (°)" : "Angle (°)"]: event.shotAngle !== undefined ? event.shotAngle : (coords ? coords.angleDegrees : ''),
      [isIt ? "Zona Campo" : "Pitch Zone"]: zoneName,
      "xG": event.xG !== undefined ? event.xG : '',
      "xGOT": event.xGOT !== undefined ? event.xGOT : '',
      [isIt ? "Parte Corpo" : "Body Part"]: event.shotBodyPart || '',
      [isIt ? "Situazione" : "Situation"]: event.shotSituation || '',
      [isIt ? "Pressione" : "Pressure"]: event.shotPressure || '',
      [isIt ? "Deviato" : "Deflected"]: event.isDeflected ? (isIt ? 'Sì' : 'Yes') : 'No',
      [isIt ? "Data/Ora" : "Timestamp"]: new Date(event.timestamp).toLocaleString(),
      [isIt ? "Note" : "Notes"]: event.notes || '',
    };
  });

  const eventsSheet = XLSX.utils.json_to_sheet(eventsTableData);
  eventsSheet['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 14 },
    { wch: 22 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 22 },
    { wch: 8 },
    { wch: 8 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 10 },
    { wch: 20 },
    { wch: 28 },
  ];

  // Create workbook and append sheets
  const workbook = XLSX.utils.book_new();
  const summarySheetTitle = isIt ? "Riepilogo Statistiche" : isEs ? "Resumen Estadísticas" : "Stats Summary";
  const eventsSheetTitle = isIt ? "Dettaglio Eventi" : isEs ? "Detalle Eventos" : "Events Detail";

  XLSX.utils.book_append_sheet(workbook, summarySheet, summarySheetTitle);
  XLSX.utils.book_append_sheet(workbook, eventsSheet, eventsSheetTitle);

  // Write file
  XLSX.writeFile(workbook, filename);
}

// Retain exportToXlsx for backward compatibility
export function exportToXlsx(
  events: SoccerEvent[],
  player: Player,
  matchDetails: MatchDetails,
  filename: string
): void {
  exportStatsToXlsx({
    events,
    player,
    filterLabel: matchDetails.matchName || matchDetails.date || 'Match',
    currentMatchDetails: matchDetails,
    filename,
  });
}
