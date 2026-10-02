import { useMemo } from 'react';
import { SoccerEvent, EventType, MatchDetails } from '../types';

const shotEventTypesForStats: EventType[] = ['Shot', 'Free Kick', 'Rush out', 'Penalty'];

export interface DistributionCategoryStats {
  completed: number;
  failed: number;
  total: number;
  percentage: string;
  shortCompleted: number;
  shortFailed: number;
  longCompleted: number;
  longFailed: number;
  shortTotal: number;
  longTotal: number;
}

export interface DistributionStats {
  completed: number;
  failed: number;
  total: number;
  percentage: string;
  hand: DistributionCategoryStats;
  foot: DistributionCategoryStats;
}

function calculateMatchMinutesFromDetails(details?: Partial<MatchDetails>): number {
  const rawDuration = parseInt(details?.duration || '90', 10);
  const duration = isNaN(rawDuration) || rawDuration <= 0 ? 90 : rawDuration;
  const isStarter = details?.starter !== 'no'; // default yes

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

export interface MatchGroupData {
  key: string;
  date: string;
  matchName: string;
  competition: string;
  events: SoccerEvent[];
}

export interface PlayerStatsSummary {
  totalEvents: number;
  matchesCount: number;
  minutesPlayed: number;
  goalsConceded: number;
  cleanSheets: number;
  shotsFaced: number;
  savesMade: number;
  savePercentage: string;
  goalsPerMinutesDisplay: string;
  goalsPer90Display: string;
  minPerGoal: number | null;
}

export interface CalculatedPlayerStats {
  stats: PlayerStatsSummary;
  distributionStats: DistributionStats;
  parataEvents: SoccerEvent[];
  cornerLeftEvents: SoccerEvent[];
  cornerRightEvents: SoccerEvent[];
  crossLeftEvents: SoccerEvent[];
  crossRightEvents: SoccerEvent[];
  hasVisualizableData: boolean;
  matchGroups: MatchGroupData[];
}

export function calculatePlayerStats(
  events: SoccerEvent[],
  currentMatchDetails?: MatchDetails
): CalculatedPlayerStats {
  // Group events by match to compute match-level statistics
  const map = new Map<string, MatchGroupData>();

  for (const e of events) {
    const date = (e.matchDate || '').trim();
    const matchName = (e.matchName || '').trim();
    const competition = (e.competition || '').trim();
    const displayDate = date || (e.timestamp ? new Date(e.timestamp).toISOString().split('T')[0] : '');
    const key = `${displayDate}___${matchName}___${competition}`;

    if (!map.has(key)) {
      map.set(key, {
        key,
        date: displayDate,
        matchName,
        competition,
        events: [],
      });
    }
    map.get(key)!.events.push(e);
  }

  const matchGroups = Array.from(map.values());

  const shotsFaced = events.filter((e) => shotEventTypesForStats.includes(e.type)).length;
  const goalsConceded = events.filter((e) => shotEventTypesForStats.includes(e.type) && e.outcome === 'Goal').length;
  const posts = events.filter((e) => shotEventTypesForStats.includes(e.type) && e.outcome === 'Post').length;
  const savesMade = Math.max(0, shotsFaced - goalsConceded - posts);
  const savePercentage = shotsFaced > 0 ? (((shotsFaced - goalsConceded) / shotsFaced) * 100).toFixed(1) : '0.0';

  // 1. Numero Partite
  const matchesCount = matchGroups.length > 0 ? matchGroups.length : events.length > 0 ? 1 : 0;

  // 2. Minuti giocati
  let totalMinutesPlayed = 0;
  if (matchGroups.length === 0) {
    if (events.length > 0) {
      totalMinutesPlayed = calculateMatchMinutesFromDetails(currentMatchDetails);
    }
  } else {
    for (const group of matchGroups) {
      const isCurrent =
        currentMatchDetails &&
        (currentMatchDetails.date || '').trim() === group.date.trim() &&
        (currentMatchDetails.matchName || '').trim() === group.matchName.trim();

      if (isCurrent) {
        totalMinutesPlayed += calculateMatchMinutesFromDetails(currentMatchDetails);
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

  // 3. Clean Sheets
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

  // 4. Gol/minuti
  let goalsPerMinutesDisplay = '0';
  let goalsPer90Display = '0.00';
  let minPerGoal: number | null = null;

  if (goalsConceded === 0) {
    goalsPerMinutesDisplay = '0';
    goalsPer90Display = totalMinutesPlayed > 0 ? '0.00' : '-';
  } else if (totalMinutesPlayed > 0) {
    minPerGoal = Math.round(totalMinutesPlayed / goalsConceded);
    goalsPerMinutesDisplay = `1 / ${minPerGoal}'`;
    goalsPer90Display = ((goalsConceded / totalMinutesPlayed) * 90).toFixed(2);
  } else {
    goalsPerMinutesDisplay = '-';
    goalsPer90Display = '-';
  }

  const stats: PlayerStatsSummary = {
    totalEvents: events.length,
    matchesCount,
    minutesPlayed: totalMinutesPlayed,
    goalsConceded,
    cleanSheets,
    shotsFaced,
    savesMade,
    savePercentage,
    goalsPerMinutesDisplay,
    goalsPer90Display,
    minPerGoal,
  };

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

  const distributionEvents = events.filter(isDist);

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

  const isCompleted = (e: SoccerEvent) =>
    e.outcome === 'Completed' || String(e.outcome).toLowerCase().includes('complet');

  const isFailed = (e: SoccerEvent) =>
    e.outcome === 'Failed' ||
    String(e.outcome).toLowerCase().includes('fail') ||
    String(e.outcome).toLowerCase().includes('fallit') ||
    String(e.outcome).toLowerCase().includes('sbagli');

  // Hand events
  const handEvents = distributionEvents.filter(isHand);
  const handCompletedEvents = handEvents.filter(isCompleted);
  const handFailedEvents = handEvents.filter(isFailed);
  const handCompleted = handCompletedEvents.length;
  const handFailed = handFailedEvents.length;
  const handTotal = handCompleted + handFailed;
  const handPercentage = handTotal > 0 ? ((handCompleted / handTotal) * 100).toFixed(1) : '0.0';

  const handShortCompleted = handCompletedEvents.filter(isShort).length;
  const handShortFailed = handFailedEvents.filter(isShort).length;
  const handLongCompleted = handCompletedEvents.filter(isLong).length;
  const handLongFailed = handFailedEvents.filter(isLong).length;

  // Foot events
  const footEvents = distributionEvents.filter((e) => !isHand(e));
  const footCompletedEvents = footEvents.filter(isCompleted);
  const footFailedEvents = footEvents.filter(isFailed);
  const footCompleted = footCompletedEvents.length;
  const footFailed = footFailedEvents.length;
  const footTotal = footCompleted + footFailed;
  const footPercentage = footTotal > 0 ? ((footCompleted / footTotal) * 100).toFixed(1) : '0.0';

  const footShortCompleted = footCompletedEvents.filter(isShort).length;
  const footShortFailed = footFailedEvents.filter(isShort).length;
  const footLongCompleted = footCompletedEvents.filter(isLong).length;
  const footLongFailed = footFailedEvents.filter(isLong).length;

  // Total distribution events
  const completed = handCompleted + footCompleted;
  const failed = handFailed + footFailed;
  const total = completed + failed;
  const percentage = total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';

  const distributionStats: DistributionStats = {
    completed,
    failed,
    total,
    percentage,
    hand: {
      completed: handCompleted,
      failed: handFailed,
      total: handTotal,
      percentage: handPercentage,
      shortCompleted: handShortCompleted,
      shortFailed: handShortFailed,
      longCompleted: handLongCompleted,
      longFailed: handLongFailed,
      shortTotal: handShortCompleted + handShortFailed,
      longTotal: handLongCompleted + handLongFailed,
    },
    foot: {
      completed: footCompleted,
      failed: footFailed,
      total: footTotal,
      percentage: footPercentage,
      shortCompleted: footShortCompleted,
      shortFailed: footShortFailed,
      longCompleted: footLongCompleted,
      longFailed: footLongFailed,
      shortTotal: footShortCompleted + footShortFailed,
      longTotal: footLongCompleted + footLongFailed,
    },
  };

  const parataEvents = events.filter((e) => e.mode === 'Saves' && e.x !== -1 && e.y !== -1);
  const cornerLeftEvents = events.filter((e) => e.mode === 'Corner' && e.eventSide === 'left' && e.x !== -1 && e.y !== -1);
  const cornerRightEvents = events.filter((e) => e.mode === 'Corner' && e.eventSide === 'right' && e.x !== -1 && e.y !== -1);
  const crossLeftEvents = events.filter((e) => e.mode === 'Cross' && e.eventSide === 'left' && e.x !== -1 && e.y !== -1);
  const crossRightEvents = events.filter((e) => e.mode === 'Cross' && e.eventSide === 'right' && e.x !== -1 && e.y !== -1);
  const hasVisualizableData =
    parataEvents.length > 0 ||
    cornerLeftEvents.length > 0 ||
    cornerRightEvents.length > 0 ||
    crossLeftEvents.length > 0 ||
    crossRightEvents.length > 0;

  return {
    stats,
    distributionStats,
    parataEvents,
    cornerLeftEvents,
    cornerRightEvents,
    crossLeftEvents,
    crossRightEvents,
    hasVisualizableData,
    matchGroups,
  };
}

export const usePlayerStats = (events: SoccerEvent[], currentMatchDetails?: MatchDetails) => {
  return useMemo(() => calculatePlayerStats(events, currentMatchDetails), [events, currentMatchDetails]);
};
