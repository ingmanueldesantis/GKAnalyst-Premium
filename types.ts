
export type EventType = 'Shot' | 'Free Kick' | 'Penalty' | 'Rush out' | 'Intervention' | 'Short hand pass' | 'Long hand pass' | 'Short foot pass' | 'Long foot pass' | 'Drop Kick' | 'Clearence';
export type EventOutcome = 'Deflected' | 'Goal' | 'Out' | 'Blocked' | 'Post' | 'Saved' | 'Defense' | 'Completed' | 'Failed';
export type TrackingMode = 'Saves' | 'Corner' | 'Cross' | 'Distribution';
export type Language = 'en' | 'it' | 'es';

export interface MatchDetails {
    date: string;
    matchName: string;
    competition: string;
    duration?: string;
    starter?: string;
    subIn?: boolean;
    subInMinute?: string;
    subOut?: boolean;
    subOutMinute?: string;
    notes: string;
}

export interface MatchSummary {
    key: string;
    date: string;
    matchName: string;
    competition?: string;
    notes?: string;
    eventCount: number;
}

export interface SoccerEvent {
  id: string;
  playerId: string;
  type: EventType;
  outcome: EventOutcome;
  x: number; // percentage from left in goal frame (0 - 100)
  y: number; // percentage from top in goal frame (0 - 100)
  pitchX?: number; // percentage on half pitch width (0=left touchline, 50=center, 100=right touchline)
  pitchY?: number; // percentage on half pitch length (0=goal line, 100=midfield line)
  shotDistance?: number; // meters from goal center (e.g. 18.2)
  shotAngle?: number; // angle in degrees
  xG?: number; // pre-shot Expected Goals (0.00 - 1.00)
  xGOT?: number; // post-shot Expected Goals on Target (0.00 - 1.00)
  shotBodyPart?: 'foot' | 'header';
  shotSituation?: 'open_play' | 'free_kick' | 'penalty' | 'fast_break';
  shotPressure?: 'open' | 'pressured' | 'obstructed';
  isDeflected?: boolean;
  shotPower?: 'placed' | 'power';
  timestamp: number;
  notes?: string;
  mode: TrackingMode;
  eventSide?: 'left' | 'right';
  matchDate?: string;
  matchName?: string;
  competition?: string;
}

export interface ShotXgotInput {
  pitchX: number; // 0 - 100
  pitchY: number; // 0 - 100
  goalX: number; // 0 - 100
  goalY: number; // 0 - 100
  bodyPart: 'foot' | 'header';
  situation: 'open_play' | 'free_kick' | 'penalty' | 'fast_break';
  pressure: 'open' | 'pressured' | 'obstructed';
  power: 'placed' | 'power';
  isDeflected: boolean;
  outcome: EventOutcome;
  type: EventType;
}

export interface XgotCalculationResult {
  distanceMeters: number;
  angleDegrees: number;
  zoneName: string;
  xG: number;
  xGOT: number;
  targetDifficulty: 'Low' | 'Medium' | 'High' | 'Extreme' | 'Off-Target';
  differential: number; // xGOT - xG
  explanation: string;
  optaBreakdown?: {
    flightTimeSeconds: number;
    distanceFactor: number;
    angleFactor: number;
    actionType: string;
    actionMultiplier: number;
    bodyPart: 'foot' | 'header';
    bodyPartMultiplier: number;
    placementScore: number;
    isDeflected: boolean;
    deflectionBonus: number;
  };
}

export interface SessionXgotSummary {
  totalShots: number;
  shotsOnTarget: number;
  goalsConceded: number;
  savesOnTarget: number;
  totalXGConceded: number;
  totalXgConceded?: number;
  totalXgotConceded: number;
  goalsPrevented: number; // xGOT - goalsConceded
  avgXgotPerShotOnTarget: number;
  performanceRating: 'exceptional' | 'good' | 'average' | 'below_average';
}

export interface Player {
    id: string;
    name: string;
    team?: string;
    spreadsheetId?: string;
    fileId?: string;
    webViewLink?: string;
    lastModified?: string;
}

export interface GoogleDriveConfig {
    folderInput: string;
    folderId: string;
    email: string;
    connected?: boolean;
}
