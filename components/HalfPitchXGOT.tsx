import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SoccerEvent, ShotXgotInput, Language, MatchDetails, EventOutcome, EventType } from '../types';
import { translations } from '../utils/translations';
import {
  pitchCoordsToMeters,
  getPitchZoneName,
  calculateXgot,
  calculateSessionXgotSummary,
} from '../utils/xgotCalculator';
import {
  GoalkeeperGloveIcon,
  ChartBarIcon,
  CheckIcon,
  InformationCircleIcon,
  XMarkIcon,
} from './icons';

interface HalfPitchXGOTProps {
  events: SoccerEvent[];
  selectedPlayerName: string;
  language: Language;
  lastGoalClickCoords: { x: number; y: number } | null;
  onRecordShotWithXgot: (eventData: Partial<SoccerEvent>) => void;
  activeMatchDetails?: MatchDetails;
  selectedEventId?: string | null;
  onSelectEvent?: (id: string | null) => void;
}

// 9 goal zones for quick mobile target selection
const GOAL_ZONES = [
  { id: 'top_left', labelIt: 'Incrocio Sx', labelEn: 'Top Left', labelEs: 'Escuadra Izq', x: 18, y: 32 },
  { id: 'top_center', labelIt: 'Alto Centro', labelEn: 'Top Center', labelEs: 'Alto Centro', x: 50, y: 32 },
  { id: 'top_right', labelIt: 'Incrocio Dx', labelEn: 'Top Right', labelEs: 'Escuadra Der', x: 82, y: 32 },
  { id: 'mid_left', labelIt: 'Medio Sx', labelEn: 'Mid Left', labelEs: 'Medio Izq', x: 18, y: 52 },
  { id: 'center', labelIt: 'Centrale', labelEn: 'Center', labelEs: 'Centro', x: 50, y: 52 },
  { id: 'mid_right', labelIt: 'Medio Dx', labelEn: 'Mid Right', labelEs: 'Medio Der', x: 82, y: 52 },
  { id: 'bot_left', labelIt: 'Angolo Basso Sx', labelEn: 'Bottom Left', labelEs: 'Bajo Izq', x: 18, y: 68 },
  { id: 'bot_center', labelIt: 'Basso Centro', labelEn: 'Bottom Center', labelEs: 'Bajo Centro', x: 50, y: 68 },
  { id: 'bot_right', labelIt: 'Angolo Basso Dx', labelEn: 'Bottom Right', labelEs: 'Bajo Der', x: 82, y: 68 },
];

const OUTCOME_STYLES: Record<string, string> = {
  Goal: 'bg-red-500/20 text-red-300 border-red-500',
  Saved: 'bg-yellow-500/20 text-yellow-300 border-yellow-500',
  Blocked: 'bg-green-500/20 text-green-300 border-green-500',
  Deflected: 'bg-orange-500/20 text-orange-300 border-orange-500',
  Post: 'bg-emerald-500/20 text-emerald-300 border-emerald-500',
  Out: 'bg-gray-500/20 text-gray-300 border-gray-500',
};

const HalfPitchXGOT: React.FC<HalfPitchXGOTProps> = ({
  events,
  selectedPlayerName,
  language,
  lastGoalClickCoords,
  onRecordShotWithXgot,
  activeMatchDetails,
  selectedEventId: propSelectedEventId,
  onSelectEvent,
}) => {
  const isIt = language === 'it';
  const isEs = language === 'es';

  // Selected / Active event from Parate tracking
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const selectedEventId = propSelectedEventId !== undefined ? propSelectedEventId : internalSelectedId;
  const setSelectedEventId = (id: string | null) => {
    setInternalSelectedId(id);
    if (onSelectEvent) onSelectEvent(id);
  };

  // Default to the latest save event if no selection
  const activeEvent = useMemo(() => {
    if (selectedEventId) {
      const found = events.find((e) => e.id === selectedEventId);
      if (found) return found;
    }
    return events.length > 0 ? events[events.length - 1] : null;
  }, [events, selectedEventId]);

  // Keep track of previous events length to auto-select newly added event
  const prevEventsLengthRef = useRef(events.length);
  useEffect(() => {
    if (events.length > prevEventsLengthRef.current) {
      const newest = events[events.length - 1];
      if (newest) {
        setSelectedEventId(newest.id);
      }
    }
    prevEventsLengthRef.current = events.length;
  }, [events.length]);

  // Pitch coordinates (0 - 100), default or loaded from active event
  const [pitchX, setPitchX] = useState<number>(50);
  const [pitchY, setPitchY] = useState<number>(31.4);

  // Shot execution factors (maintained as requested)
  const [bodyPart, setBodyPart] = useState<ShotXgotInput['bodyPart']>('foot');
  const [pressure, setPressure] = useState<ShotXgotInput['pressure']>('open');
  const [isDeflected, setIsDeflected] = useState<boolean>(false);
  const [shotNotes, setShotNotes] = useState<string>('');

  // UI helpers
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [recordSuccessBadge, setRecordSuccessBadge] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'calculator' | 'pitch_map'>('calculator');
  const [inspectedEvent, setInspectedEvent] = useState<SoccerEvent | null>(null);
  const [isDraggingPitch, setIsDraggingPitch] = useState<boolean>(false);
  const [showLockAlert, setShowLockAlert] = useState<boolean>(false);

  const pitchSvgRef = useRef<SVGSVGElement | null>(null);

  // 1. Goal coordinates: derived from activeEvent or lastGoalClickCoords
  const effectiveGoalX = activeEvent && activeEvent.x >= 0
    ? activeEvent.x
    : (lastGoalClickCoords ? lastGoalClickCoords.x : 50);

  const effectiveGoalY = activeEvent && activeEvent.y >= 0
    ? activeEvent.y
    : (lastGoalClickCoords ? lastGoalClickCoords.y : 52);

  // Requirement: Shot placement on half-pitch is ONLY allowed after a shot target was inserted on the goal AND saved in 'Registra evento'
  const hasSavedGoalEvent = useMemo(() => {
    return !!activeEvent && activeEvent.x >= 0 && activeEvent.y >= 0;
  }, [activeEvent]);

  // 2. Game Situation: derived from activeEvent.type chosen in 'Registra Evento'
  const effectiveSituation: ShotXgotInput['situation'] = useMemo(() => {
    if (!activeEvent) return 'open_play';
    if (activeEvent.type === 'Penalty') return 'penalty';
    if (activeEvent.type === 'Free Kick') return 'free_kick';
    if (activeEvent.type === 'Rush out') return 'fast_break';
    return 'open_play';
  }, [activeEvent]);

  // 3. Shot Outcome: derived from activeEvent.outcome chosen in 'Registra Evento'
  const effectiveOutcome: EventOutcome = useMemo(() => {
    if (!activeEvent) return 'Saved';
    return activeEvent.outcome;
  }, [activeEvent]);

  // 4. Power / Trajectory: 'placed' (Piazzato) ONLY when 'Punizione' (Free Kick) is selected in Registra Evento, otherwise 'power'
  const effectivePower: ShotXgotInput['power'] = useMemo(() => {
    return activeEvent?.type === 'Free Kick' || effectiveSituation === 'free_kick'
      ? 'placed'
      : 'power';
  }, [activeEvent, effectiveSituation]);

  // Synchronize state when activeEvent changes
  useEffect(() => {
    if (activeEvent) {
      if (activeEvent.pitchX !== undefined && activeEvent.pitchY !== undefined) {
        setPitchX(activeEvent.pitchX);
        setPitchY(activeEvent.pitchY);
      } else if (activeEvent.type === 'Penalty') {
        setPitchX(50);
        setPitchY(20.95);
      } else if (activeEvent.shotDistance) {
        // Initialize pitchY from shotDistance if available (distance / 52.5m * 100)
        const py = Math.min(100, Math.max(1, (activeEvent.shotDistance / 52.5) * 100));
        setPitchX(50);
        setPitchY(Number(py.toFixed(1)));
      }
      if (activeEvent.shotBodyPart) {
        setBodyPart(activeEvent.shotBodyPart);
      }
      // Mantieni di base disabilitato il flag di Tiro Deviato (false) finché l'utente non lo seleziona
      setIsDeflected(activeEvent.isDeflected === true);

      if (activeEvent.notes) {
        setShotNotes(activeEvent.notes);
      } else {
        setShotNotes('');
      }
    } else {
      setIsDeflected(false);
      setShotNotes('');
    }
  }, [activeEvent]);

  // Calculate goal target zone name
  const goalZoneName = useMemo(() => {
    let closestZone = GOAL_ZONES[0];
    let minDistance = 99999;
    for (const zone of GOAL_ZONES) {
      const d = Math.hypot(zone.x - effectiveGoalX, zone.y - effectiveGoalY);
      if (d < minDistance) {
        minDistance = d;
        closestZone = zone;
      }
    }
    return isIt ? closestZone.labelIt : isEs ? closestZone.labelEs : closestZone.labelEn;
  }, [effectiveGoalX, effectiveGoalY, isIt, isEs]);

  // Pitch click/touch/drag handling: calculates exact pitch percentage and distance from point of insertion
  // ONLY active if hasSavedGoalEvent is true
  const handlePitchInteraction = (clientX: number, clientY: number) => {
    if (!hasSavedGoalEvent) return;
    if (!pitchSvgRef.current) return;
    const rect = pitchSvgRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // Convert client position to SVG viewBox space (viewBox="0 0 340 265")
    const svgX = ((clientX - rect.left) / rect.width) * 340;
    const svgY = ((clientY - rect.top) / rect.height) * 265;

    // Pitch touchline boundaries inside SVG:
    // Left touchline at x = 15, right touchline at x = 325 -> pitch width = 310
    // Goal line at y = 10, halfway line at y = 255 -> pitch depth = 245
    const pitchXPercent = ((svgX - 15) / 310) * 100;
    const pitchYPercent = ((svgY - 10) / 245) * 100;

    // Clamp within field boundaries
    const clampedX = Math.max(0, Math.min(100, pitchXPercent));
    const clampedY = Math.max(0.5, Math.min(100, pitchYPercent));

    setPitchX(Number(clampedX.toFixed(1)));
    setPitchY(Number(clampedY.toFixed(1)));
  };

  const handlePitchMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!hasSavedGoalEvent) {
      setShowLockAlert(true);
      setTimeout(() => setShowLockAlert(false), 4000);
      return;
    }
    setIsDraggingPitch(true);
    handlePitchInteraction(e.clientX, e.clientY);
  };

  const handlePitchMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!hasSavedGoalEvent) return;
    if (isDraggingPitch) {
      handlePitchInteraction(e.clientX, e.clientY);
    }
  };

  const handlePitchMouseUp = () => {
    setIsDraggingPitch(false);
  };

  const handlePitchTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!hasSavedGoalEvent) {
      setShowLockAlert(true);
      setTimeout(() => setShowLockAlert(false), 4000);
      return;
    }
    if (e.touches && e.touches[0]) {
      setIsDraggingPitch(true);
      handlePitchInteraction(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handlePitchTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!hasSavedGoalEvent) return;
    if (isDraggingPitch && e.touches && e.touches[0]) {
      handlePitchInteraction(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handlePitchTouchEnd = () => {
    setIsDraggingPitch(false);
  };

  // Calculate live xGOT and pre-shot xG using synchronized data
  const xgotResult = useMemo(() => {
    const input: ShotXgotInput = {
      pitchX,
      pitchY,
      goalX: effectiveGoalX,
      goalY: effectiveGoalY,
      bodyPart,
      situation: effectiveSituation,
      pressure,
      power: effectivePower,
      isDeflected,
      outcome: effectiveOutcome,
      type: effectiveSituation === 'penalty' ? 'Penalty' : effectiveSituation === 'free_kick' ? 'Free Kick' : 'Shot',
    };
    return calculateXgot(input, language);
  }, [pitchX, pitchY, effectiveGoalX, effectiveGoalY, bodyPart, effectiveSituation, pressure, effectivePower, isDeflected, effectiveOutcome, language]);

  // Aggregate Session xGOT
  const sessionSummary = useMemo(() => {
    return calculateSessionXgotSummary(events);
  }, [events]);

  // Handle Record Shot with xGOT (updates active event or records new)
  const handleRecordShot = () => {
    if (!hasSavedGoalEvent) {
      setShowLockAlert(true);
      setTimeout(() => setShowLockAlert(false), 4000);
      return;
    }
    const eventType: EventType =
      effectiveSituation === 'penalty' ? 'Penalty' : effectiveSituation === 'free_kick' ? 'Free Kick' : 'Shot';

    const eventPayload: Partial<SoccerEvent> = {
      id: activeEvent?.id,
      type: activeEvent?.type || eventType,
      outcome: effectiveOutcome,
      x: effectiveGoalX,
      y: effectiveGoalY,
      pitchX,
      pitchY,
      shotDistance: xgotResult.distanceMeters,
      shotAngle: xgotResult.angleDegrees,
      xG: xgotResult.xG,
      xGOT: xgotResult.xGOT,
      shotBodyPart: bodyPart,
      shotSituation: effectiveSituation,
      shotPressure: pressure,
      shotPower: effectivePower,
      isDeflected,
      notes: shotNotes.trim(),
      mode: 'Saves',
    };

    onRecordShotWithXgot(eventPayload);
    setRecordSuccessBadge(true);
    setTimeout(() => setRecordSuccessBadge(false), 3000);
  };

  // Filter session shots that have pitch positions for pitch rendering
  const mappedShots = useMemo(() => {
    return events
      .filter((e) => e.mode === 'Saves')
      .map((e, idx) => {
        // If pitchX is not set, synthesize approximate pitch position based on distance or index
        const px = e.pitchX !== undefined ? e.pitchX : 40 + ((idx * 17) % 25);
        const py = e.pitchY !== undefined ? e.pitchY : 20 + ((idx * 13) % 40);
        return {
          ...e,
          resolvedPitchX: px,
          resolvedPitchY: py,
        };
      });
  }, [events]);

  return (
    <div className="bg-gray-800 rounded-2xl shadow-lg border border-gray-700 p-4 sm:p-5 flex flex-col space-y-4">
      {/* CARD HEADER */}
      <div className="flex items-center justify-between border-b border-gray-700/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-500/15 text-emerald-400 rounded-xl border border-emerald-500/30">
            <ChartBarIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base sm:text-lg text-white flex items-center gap-2">
              <span>{isIt ? 'Metà Campo & Calcolo xGOT Concessi' : isEs ? 'Medio Campo & xGOT Concedidos' : 'Half Pitch & xGOT Conceded'}</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 hidden sm:inline-block">
                Opta / StatsBomb
              </span>
            </h3>
            <p className="text-xs text-gray-400">
              {isIt
                ? 'Analisi geometrica del tiro e Post-Shot Expected Goals sul portiere'
                : isEs
                ? 'Análisis geométrico del tiro y Post-Shot Expected Goals en portería'
                : 'Shot pitch geometry and Post-Shot Expected Goals faced by goalkeeper'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowInfoModal(true)}
          className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-gray-700/60 rounded-xl transition-colors"
          title={isIt ? 'Cos\'è l\'xGOT Conceded?' : 'What is xGOT Conceded?'}
          aria-label="Info"
        >
          <InformationCircleIcon className="w-5 h-5" />
        </button>
      </div>

      {/* SESSION SUMMARY STATS DASHBOARD (Opta-style Headline metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-gray-900/60 rounded-xl border border-gray-700/80 text-center">
        {/* Metric 1: xGOT Concessi Totali */}
        <div className="p-2 bg-gray-800/80 rounded-lg border border-gray-700/60 flex flex-col items-center justify-center">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            {isIt ? 'xGOT Concessi' : isEs ? 'xGOT Concedidos' : 'xGOT Conceded'}
          </span>
          <span className="text-xl sm:text-2xl font-black text-cyan-400 mt-0.5">
            {sessionSummary.totalXgotConceded.toFixed(2)}
          </span>
          <span className="text-[10px] text-gray-400">
            {sessionSummary.shotsOnTarget} {isIt ? 'nello specchio' : isEs ? 'a puerta' : 'on target'}
          </span>
        </div>

        {/* Metric 2: Gol Subiti */}
        <div className="p-2 bg-gray-800/80 rounded-lg border border-gray-700/60 flex flex-col items-center justify-center">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            {isIt ? 'Gol Subiti' : isEs ? 'Goles Encajados' : 'Goals Conceded'}
          </span>
          <span className="text-xl sm:text-2xl font-black text-red-400 mt-0.5">
            {sessionSummary.goalsConceded}
          </span>
          <span className="text-[10px] text-gray-400">
            {sessionSummary.totalShots} {isIt ? 'tiri totali' : isEs ? 'tiros totales' : 'total shots'}
          </span>
        </div>

        {/* Metric 3: Gol Evitati (Goals Prevented) - Key Opta metric! */}
        <div className="p-2 bg-gray-800/80 rounded-lg border border-gray-700/60 flex flex-col items-center justify-center">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            {isIt ? 'Gol Evitati' : isEs ? 'Goles Salvados' : 'Goals Prevented'}
          </span>
          <span
            className={`text-xl sm:text-2xl font-black mt-0.5 ${
              sessionSummary.goalsPrevented >= 0.5
                ? 'text-emerald-400'
                : sessionSummary.goalsPrevented >= 0
                ? 'text-yellow-400'
                : 'text-rose-400'
            }`}
          >
            {sessionSummary.goalsPrevented > 0 ? `+${sessionSummary.goalsPrevented.toFixed(2)}` : sessionSummary.goalsPrevented.toFixed(2)}
          </span>
          <span className="text-[10px] text-gray-400 font-medium">
            {sessionSummary.goalsPrevented > 0
              ? isIt ? 'Parate decisive' : isEs ? 'Paradas clave' : 'Goals saved'
              : isIt ? 'Bilancio xGOT' : 'xGOT balance'}
          </span>
        </div>

        {/* Metric 4: xGOT Medio / Tiro */}
        <div className="p-2 bg-gray-800/80 rounded-lg border border-gray-700/60 flex flex-col items-center justify-center">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            {isIt ? 'Difficoltà Media' : isEs ? 'Dificultad Media' : 'Avg Shot xGOT'}
          </span>
          <span className="text-xl sm:text-2xl font-black text-amber-300 mt-0.5">
            {sessionSummary.avgXgotPerShotOnTarget > 0 ? sessionSummary.avgXgotPerShotOnTarget.toFixed(2) : '-'}
          </span>
          <span className="text-[10px] text-gray-400">
            {isIt ? 'per tiro a porta' : isEs ? 'por tiro a puerta' : 'per on-target shot'}
          </span>
        </div>
      </div>

      {/* TAB SELECTOR: Calcolatore vs Mappa Tiri Sessione */}
      <div className="flex items-center gap-2 border-b border-gray-700 pb-2">
        <button
          onClick={() => setActiveTab('calculator')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'calculator'
              ? 'bg-cyan-600 text-white shadow'
              : 'bg-gray-700/60 text-gray-300 hover:bg-gray-700'
          }`}
        >
          {isIt ? '🎯 Calcolatore xGOT del Tiro' : isEs ? '🎯 Calculadora xGOT' : '🎯 Shot xGOT Calculator'}
        </button>
        <button
          onClick={() => setActiveTab('pitch_map')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
            activeTab === 'pitch_map'
              ? 'bg-cyan-600 text-white shadow'
              : 'bg-gray-700/60 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <span>{isIt ? '🗺️ Mappa Tiri Sessione' : isEs ? '🗺️ Mapa Tiros Sesión' : '🗺️ Session Pitch Map'}</span>
          <span className="px-1.5 py-0.2 rounded-full bg-gray-900 text-[10px] font-bold text-cyan-300">
            {mappedShots.length}
          </span>
        </button>
      </div>

      {/* MAIN INTERACTIVE SECTION: SOCCER HALF-PITCH */}
      <div className="flex flex-col items-center">
        {/* Prompt line */}
        <div className="w-full flex items-center justify-between text-xs text-gray-300 mb-2 px-1">
          <span className="font-semibold flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${hasSavedGoalEvent ? 'bg-cyan-400 animate-ping' : 'bg-amber-400 animate-pulse'}`}></span>
            {activeTab === 'calculator'
              ? hasSavedGoalEvent
                ? isIt
                  ? `Tocca o trascina sulla metà campo per posizionare il punto del tiro (Evento #${events.findIndex((e) => e.id === activeEvent?.id) + 1}):`
                  : isEs
                  ? `Toca o arrastra en el medio campo para colocar el tiro (Evento #${events.findIndex((e) => e.id === activeEvent?.id) + 1}):`
                  : `Tap or drag on half-pitch to place shot location (Event #${events.findIndex((e) => e.id === activeEvent?.id) + 1}):`
                : isIt
                ? '🔒 Inserimento bloccato: inserisci prima il punto nello specchio della porta sopra e salva l\'evento.'
                : isEs
                ? '🔒 Inserción bloqueada: primero toca la portería arriba y guarda el evento.'
                : '🔒 Placement locked: first tap the goal above and save the event.'
              : isIt
              ? 'Tutti i tiri registrati posizionati sulla metà campo:'
              : 'All recorded shots mapped on half pitch:'}
          </span>
          {hasSavedGoalEvent && (
            <span className="text-[11px] font-bold text-cyan-400 bg-gray-900 px-2 py-0.5 rounded border border-gray-700 flex-shrink-0">
              {xgotResult.distanceMeters}m • {xgotResult.angleDegrees}° ({xgotResult.zoneName})
            </span>
          )}
        </div>

        {/* Lock alert banner */}
        {showLockAlert && (
          <div className="w-full max-w-md mb-2 p-2.5 bg-amber-950/90 border border-amber-500/60 rounded-xl text-amber-200 text-xs flex items-center gap-2 shadow-lg animate-pulse">
            <span className="text-base">⚠️</span>
            <span className="font-semibold">
              {isIt
                ? 'Devi prima cliccare sullo specchio della porta in alto e salvare l\'evento in "Registra Evento" per abilitare il punto sulla metà campo!'
                : 'You must first tap on the goal above and save the event in "Register Event" to enable half-pitch shot placement!'}
            </span>
          </div>
        )}

        {/* MOBILE-OPTIMIZED HALF-PITCH SVG */}
        <div
          className={`w-full max-w-md aspect-[340/265] relative select-none rounded-xl overflow-hidden border-2 shadow-inner ${
            hasSavedGoalEvent
              ? 'cursor-crosshair bg-emerald-950/40 border-emerald-800/80'
              : 'cursor-not-allowed bg-emerald-950/20 border-gray-700/80'
          }`}
          onClick={() => {
            if (!hasSavedGoalEvent) {
              setShowLockAlert(true);
              setTimeout(() => setShowLockAlert(false), 4000);
            }
          }}
        >
          {/* LOCK OVERLAY IF NO SAVED EVENT */}
          {!hasSavedGoalEvent && activeTab === 'calculator' && (
            <div className="absolute inset-0 bg-gray-950/85 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center z-10 select-none">
              <div className="w-12 h-12 rounded-2xl bg-cyan-950/90 border border-cyan-500/50 flex items-center justify-center text-cyan-400 mb-2 shadow-lg shadow-cyan-950/50">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <span className="text-[11px] uppercase font-extrabold tracking-wider text-cyan-400">
                {isIt ? 'Inserimento Metà Campo Bloccato' : 'Half-Pitch Placement Locked'}
              </span>
              <p className="text-sm font-bold text-white mt-1 max-w-[280px]">
                {isIt
                  ? 'Inserisci prima il punto di tiro nello specchio della porta'
                  : 'First place the shot target on the goal above'}
              </p>
              <p className="text-xs text-gray-300 mt-1 max-w-[270px] leading-relaxed">
                {isIt
                  ? 'Tocca lo specchio della porta sopra e salva l\'evento in "Registra Evento" per abilitare il punto sulla metà campo.'
                  : 'Tap the goal frame above and save the event in "Register Event" to enable half-pitch shot placement.'}
              </p>
            </div>
          )}

          <svg
            ref={pitchSvgRef}
            viewBox="0 0 340 265"
            className="w-full h-full touch-none select-none"
            onMouseDown={handlePitchMouseDown}
            onMouseMove={handlePitchMouseMove}
            onMouseUp={handlePitchMouseUp}
            onMouseLeave={handlePitchMouseUp}
            onTouchStart={handlePitchTouchStart}
            onTouchMove={handlePitchTouchMove}
            onTouchEnd={handlePitchTouchEnd}
            onTouchCancel={handlePitchTouchEnd}
          >
            <defs>
              {/* Pitch turf horizontal stripes */}
              <pattern id="turfStripes" width="340" height="26.25" patternUnits="userSpaceOnUse">
                <rect width="340" height="13.125" fill="#0f341f" />
                <rect y="13.125" width="340" height="13.125" fill="#0b2b19" />
              </pattern>

              {/* Trajectory gradient */}
              <linearGradient id="shotLineGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.9" />
              </linearGradient>

              {/* Ball shadow filter */}
              <filter id="ballGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#38bdf8" floodOpacity="0.8" />
              </filter>
            </defs>

            {/* Grass background */}
            <rect width="340" height="265" fill="url(#turfStripes)" />

            {/* Perimeter touchlines */}
            <rect x="15" y="10" width="310" height="245" fill="none" stroke="#e2e8f0" strokeWidth="1.5" strokeOpacity="0.75" />

            {/* Halfway line (at the bottom) */}
            <line x1="15" y1="255" x2="325" y2="255" stroke="#e2e8f0" strokeWidth="1.5" strokeOpacity="0.75" />

            {/* Center circle arc (centered at 170, 255 with radius 45.75) */}
            <path
              d="M 124.25 255 A 45.75 45.75 0 0 1 215.75 255"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="1.5"
              strokeOpacity="0.75"
            />
            {/* Center spot */}
            <circle cx="170" cy="255" r="2.5" fill="#e2e8f0" fillOpacity="0.85" />

            {/* Subtle distance arc guidelines (15m, 20m, 25m, 30m from goal center 170, 10) */}
            <circle cx="170" cy="10" r="70" fill="none" stroke="#4ade80" strokeWidth="0.7" strokeDasharray="3 3" strokeOpacity="0.2" />
            <circle cx="170" cy="10" r="93.3" fill="none" stroke="#4ade80" strokeWidth="0.8" strokeDasharray="3 3" strokeOpacity="0.25" />
            <circle cx="170" cy="10" r="116.7" fill="none" stroke="#4ade80" strokeWidth="0.8" strokeDasharray="3 3" strokeOpacity="0.25" />
            <circle cx="170" cy="10" r="140" fill="none" stroke="#4ade80" strokeWidth="0.8" strokeDasharray="3 3" strokeOpacity="0.2" />

            {/* Distance labels on pitch aligned with concentric meter guidelines */}
            <text x="282" y="81" fill="#4ade80" fillOpacity="0.4" fontSize="7.5" fontWeight="bold">15m</text>
            <text x="282" y="104" fill="#4ade80" fillOpacity="0.45" fontSize="7.5" fontWeight="bold">20m</text>
            <text x="282" y="127" fill="#4ade80" fillOpacity="0.45" fontSize="7.5" fontWeight="bold">25m</text>
            <text x="282" y="151" fill="#4ade80" fillOpacity="0.4" fontSize="7.5" fontWeight="bold">30m</text>

            {/* Penalty box (Area di rigore: 16.5m from goal line -> y: 10 to 87, width 183.8 = x: 78.1 to 261.9) */}
            <rect x="78.1" y="10" width="183.8" height="77" fill="none" stroke="#e2e8f0" strokeWidth="1.5" strokeOpacity="0.75" />

            {/* 6-yard box (Area piccola: 5.5m from goal line -> y: 10 to 35.7, width 83.6 = x: 128.2 to 211.8) */}
            <rect x="128.2" y="10" width="83.6" height="25.7" fill="none" stroke="#e2e8f0" strokeWidth="1.5" strokeOpacity="0.75" />

            {/* Penalty spot at 11m (y = 10 + 51.33 = 61.3) */}
            <circle cx="170" cy="61.3" r="2.5" fill="#e2e8f0" fillOpacity="0.9" />

            {/* Penalty Arc / Lunetta (radius 42.7m centered at 170, 61.3, visible for y > 87) */}
            <path
              d="M 135.9 87 A 42.7 42.7 0 0 0 204.1 87"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="1.5"
              strokeOpacity="0.75"
            />

            {/* Goal Posts & Net on top goal line (width 36.6 = x: 151.7 to 188.3, extends outward to y=3) */}
            <rect x="151.7" y="3" width="36.6" height="7" fill="none" stroke="#ffffff" strokeWidth="2" />
            <line x1="151.7" y1="10" x2="188.3" y2="10" stroke="#22c55e" strokeWidth="2.5" />
            {/* Goal net mesh */}
            <line x1="160" y1="3" x2="160" y2="10" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.6" />
            <line x1="170" y1="3" x2="170" y2="10" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.6" />
            <line x1="180" y1="3" x2="180" y2="10" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.6" />

            {/* Corner arcs */}
            <path d="M 15 15 A 5 5 0 0 0 20 10" fill="none" stroke="#e2e8f0" strokeWidth="1.2" strokeOpacity="0.7" />
            <path d="M 320 10 A 5 5 0 0 0 325 15" fill="none" stroke="#e2e8f0" strokeWidth="1.2" strokeOpacity="0.7" />

            {/* IN 'pitch_map' TAB: Render all recorded session shots with outcomes */}
            {activeTab === 'pitch_map' && (
              <>
                {mappedShots.map((shot, sIdx) => {
                  const svgX = 15 + (shot.resolvedPitchX / 100) * 310;
                  const svgY = 10 + (shot.resolvedPitchY / 100) * 245;

                  let color = '#eab308'; // saved
                  if (shot.outcome === 'Goal') color = '#ef4444';
                  else if (shot.outcome === 'Post') color = '#10b981';
                  else if (shot.outcome === 'Deflected') color = '#f97316';
                  else if (shot.outcome === 'Blocked') color = '#22c55e';
                  else if (shot.outcome === 'Out') color = '#9ca3af';

                  const isInspected = inspectedEvent?.id === shot.id;

                  return (
                    <g
                      key={`${shot.id}_${sIdx}`}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectedEvent(shot);
                      }}
                    >
                      <circle
                        cx={svgX}
                        cy={svgY}
                        r={isInspected ? 7 : 5}
                        fill={color}
                        stroke="#ffffff"
                        strokeWidth={isInspected ? 2.5 : 1.2}
                        className="transition-all"
                      />
                      <text
                        x={svgX}
                        y={svgY - 7}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="7.5"
                        fontWeight="bold"
                        className="pointer-events-none drop-shadow"
                      >
                        #{sIdx + 1}
                      </text>
                    </g>
                  );
                })}
              </>
            )}

            {/* ACTIVE SHOT LOCATOR (always visible in calculator tab, or syncs) */}
            {(() => {
              const markerSvgX = 15 + (pitchX / 100) * 310;
              const markerSvgY = 10 + (pitchY / 100) * 245;

              // Goal target X mapped to top goal line
              const targetGoalSvgX = 151.7 + (effectiveGoalX / 100) * 36.6;
              const targetGoalSvgY = 10;

              return (
                <g>
                  {/* Trajectory vector to goal */}
                  <line
                    x1={markerSvgX}
                    y1={markerSvgY}
                    x2={targetGoalSvgX}
                    y2={targetGoalSvgY}
                    stroke="url(#shotLineGrad)"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                    strokeOpacity="0.85"
                  />

                  {/* Pulsing circle under ball */}
                  <circle cx={markerSvgX} cy={markerSvgY} r="10" fill="#38bdf8" fillOpacity="0.25">
                    <animate attributeName="r" values="8;14;8" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
                  </circle>

                  {/* Soccer ball marker */}
                  <circle
                    cx={markerSvgX}
                    cy={markerSvgY}
                    r="6"
                    fill="#ffffff"
                    stroke="#0284c7"
                    strokeWidth="2"
                    filter="url(#ballGlow)"
                  />
                  {/* Ball pentagon center */}
                  <circle cx={markerSvgX} cy={markerSvgY} r="2" fill="#0f172a" />

                  {/* Goal impact point indicator on goal line */}
                  <circle cx={targetGoalSvgX} cy={targetGoalSvgY} r="3.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
                </g>
              );
            })()}
          </svg>
        </div>

        {/* DISTANCE & PITCH INSERTION READOUT (Calculated dynamically from point of insertion on half-pitch) */}
        <div className="w-full max-w-md mt-2.5 p-3 bg-gray-900/90 rounded-xl border border-cyan-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg border border-cyan-500/40 flex-shrink-0 flex items-center justify-center">
              <span className="text-lg">📍</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                  {isIt ? 'Distanza Punto di Tiro:' : isEs ? 'Distancia del Tiro:' : 'Shot Point Distance:'}
                </span>
                <span className="text-base font-black text-cyan-400 bg-cyan-950/90 px-2.5 py-0.5 rounded-lg border border-cyan-600/60 shadow-sm">
                  {hasSavedGoalEvent ? `${xgotResult.distanceMeters} m` : '-- m'}
                </span>
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-700/60">
                  {hasSavedGoalEvent ? xgotResult.zoneName : (isIt ? 'In attesa evento porta' : 'Awaiting goal event')}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {hasSavedGoalEvent
                  ? isIt
                    ? 'Distanza calcolata dinamicamente dal punto di inserimento nel grafico di metà campo'
                    : isEs
                    ? 'Distancia calculada dinámicamente desde el punto de inserción en el medio campo'
                    : 'Distance dynamically calculated from insertion point on the half-pitch'
                  : isIt
                  ? 'Salva prima l\'evento cliccando sulla porta in alto per abilitare la misurazione'
                  : 'Save the event on the goal above first to enable half-pitch measurement'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end text-xs text-gray-300 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-800 flex-shrink-0">
            <div className="text-right">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-semibold">
                {isIt ? 'Angolo Tiro' : 'Angle'}:
              </span>
              <span className="font-bold text-white text-xs">
                {hasSavedGoalEvent ? `${xgotResult.angleDegrees}°` : '--°'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* INSPECTED EVENT CARD (If user tapped a past shot in map view) */}
      {activeTab === 'pitch_map' && inspectedEvent && (
        <div className="p-3 bg-gray-900/80 rounded-xl border border-cyan-500/40 flex items-center justify-between text-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">
                {isIt ? 'Tiro Selezionato' : 'Selected Shot'}: {inspectedEvent.type}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-cyan-300 border border-gray-700">
                {inspectedEvent.outcome}
              </span>
            </div>
            <p className="text-gray-300 mt-1">
              {inspectedEvent.shotDistance ? `Distanza: ${inspectedEvent.shotDistance}m • ` : ''}
              {inspectedEvent.xGOT !== undefined ? (
                <strong className="text-cyan-400 font-bold">xGOT: {inspectedEvent.xGOT.toFixed(2)}</strong>
              ) : (
                'xGOT non calcolato'
              )}
              {inspectedEvent.notes ? ` • ${inspectedEvent.notes}` : ''}
            </p>
          </div>
          <button
            onClick={() => setInspectedEvent(null)}
            className="p-1 text-gray-400 hover:text-white rounded"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* DATA INPUT PANEL: Synchronized data from Event & Goal + Execution controls */}
      <div className="space-y-3.5 bg-gray-900/40 p-3.5 sm:p-4 rounded-xl border border-gray-700/70">
        {/* SYNCHRONIZED EVENT DATA (Rilevati da registrazione evento Parate, porta e specchietto Registra Evento) */}
        <div className="p-3 bg-gray-900/90 rounded-xl border border-cyan-500/30 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800 pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                {isIt ? 'Dati Registrati da Porta & Specchietto Evento:' : 'Synced Event & Goal Data:'}
              </span>
              {activeEvent ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-700/60">
                  {isIt ? 'Evento' : 'Event'} #{events.findIndex((e) => e.id === activeEvent.id) + 1}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[11px] text-amber-300 bg-amber-950/60 border border-amber-700/60">
                  {isIt ? 'In attesa di evento' : 'Awaiting event'}
                </span>
              )}
            </div>

            {/* Event switcher if more than 1 event exists */}
            {events.length > 1 && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-400 text-[11px]">{isIt ? 'Seleziona:' : 'Select:'}</span>
                <select
                  value={activeEvent?.id || ''}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-cyan-300 font-semibold rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer max-w-[190px] truncate"
                >
                  {events.map((evt, idx) => (
                    <option key={`${evt.id}_${idx}`} value={evt.id}>
                      #{idx + 1} - {evt.type} ({evt.outcome})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 3 Synchronized Cards: Situazione, Bersaglio in Porta, Esito */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {/* 1. Situazione di Gioco (da tipo evento nello specchietto Registra Evento) */}
            <div className="p-2.5 bg-gray-800/90 rounded-lg border border-gray-700/70">
              <span className="text-[10px] text-gray-400 uppercase font-semibold block">
                {isIt ? 'Situazione di Gioco' : 'Game Situation'}
              </span>
              <span className="font-bold text-white text-xs mt-0.5 block truncate">
                {effectiveSituation === 'penalty'
                  ? isIt ? 'Rigore (11m)' : 'Penalty'
                  : effectiveSituation === 'free_kick'
                  ? isIt ? 'Punizione' : 'Free Kick'
                  : effectiveSituation === 'fast_break'
                  ? isIt ? 'Contropiede 1v1' : 'Fast Break'
                  : isIt ? 'Azione Aperta' : 'Open Play'}
              </span>
              <span className="text-[10px] text-gray-400 mt-0.5 block">
                {isIt ? 'Dal tipo: ' : 'From: '}<strong className="text-gray-300">{activeEvent?.type || 'Shot'}</strong>
              </span>
            </div>

            {/* 2. Bersaglio in Porta (dal punto inserito nell'area di porta) */}
            <div className="p-2.5 bg-gray-800/90 rounded-lg border border-gray-700/70">
              <span className="text-[10px] text-gray-400 uppercase font-semibold block">
                {isIt ? 'Bersaglio nello Specchio' : 'Goal Target'}
              </span>
              <span className="font-bold text-cyan-300 text-xs mt-0.5 block truncate">
                {goalZoneName}
              </span>
              <span className="text-[10px] text-gray-400 mt-0.5 block">
                {isIt ? 'Punto porta: ' : 'Coords: '}X: {effectiveGoalX.toFixed(0)}%, Y: {effectiveGoalY.toFixed(0)}%
              </span>
            </div>

            {/* 3. Esito del Tiro (dallo specchietto Registra Evento) */}
            <div className="p-2.5 bg-gray-800/90 rounded-lg border border-gray-700/70">
              <span className="text-[10px] text-gray-400 uppercase font-semibold block">
                {isIt ? 'Esito del Tiro' : 'Shot Outcome'}
              </span>
              <span className={`inline-block font-bold text-xs mt-0.5 px-2 py-0.5 rounded border ${OUTCOME_STYLES[effectiveOutcome] || 'bg-gray-700 text-white border-gray-600'}`}>
                {effectiveOutcome}
              </span>
              <span className="text-[10px] text-gray-400 mt-0.5 block">
                {isIt ? 'Da Registra Evento' : 'From Event Record'}
              </span>
            </div>
          </div>
        </div>

        {/* TIPO CONCLUSIONE + TIRO DEVIATO */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-300 mb-1">
            {isIt ? 'Tipo Conclusione' : 'Shot Execution'}
          </label>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <button
              onClick={() => setBodyPart('foot')}
              className={`py-1.5 px-2 rounded-lg font-semibold text-[11px] transition-colors ${
                bodyPart === 'foot'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
              }`}
            >
              {isIt ? 'Piede' : 'Foot'}
            </button>
            <button
              onClick={() => setBodyPart('header')}
              className={`py-1.5 px-2 rounded-lg font-semibold text-[11px] transition-colors ${
                bodyPart === 'header'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
              }`}
            >
              {isIt ? 'Colpo di Testa' : 'Header'}
            </button>
          </div>
          {effectivePower === 'placed' && (
            <p className="text-[11px] text-cyan-300 mt-1.5 flex items-center gap-1.5 font-medium bg-cyan-950/50 px-2.5 py-1 rounded-lg border border-cyan-800/50">
              <span>🎯</span>
              <span>
                {isIt
                  ? 'Punizione: tiro piazzato applicato automaticamente al calcolo xGOT'
                  : 'Free Kick: placed shot automatically applied to xGOT calculation'}
              </span>
            </p>
          )}

          {/* Checkbox deviazione */}
          <div className="mt-2.5 flex items-center gap-2">
            <label className={`flex items-center gap-2 select-none text-xs ${hasSavedGoalEvent ? 'cursor-pointer text-gray-300' : 'cursor-not-allowed text-gray-500'}`}>
              <input
                type="checkbox"
                disabled={!hasSavedGoalEvent}
                checked={hasSavedGoalEvent && isDeflected}
                onChange={(e) => setIsDeflected(e.target.checked)}
                className="rounded text-cyan-500 focus:ring-cyan-500 bg-gray-800 border-gray-600 w-4 h-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              />
              <span className={isDeflected && hasSavedGoalEvent ? 'text-orange-400 font-semibold' : ''}>
                {isIt ? 'Tiro Deviato (riduce tempo reazione portiere)' : 'Deflected Shot (boosts xGOT)'}
              </span>
            </label>
          </div>
        </div>

        {/* Note opzionali */}
        <div>
          <input
            type="text"
            value={shotNotes}
            onChange={(e) => setShotNotes(e.target.value)}
            placeholder={isIt ? 'Note tiro opzionali (es. deviazione, rimbalzo)...' : 'Optional shot notes...'}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
      </div>

      {/* LIVE CALCULATION RESULT CARD (Opta Analyst Model) */}
      <div className="p-4 bg-gradient-to-r from-gray-900 via-gray-850 to-gray-900 rounded-xl border-2 border-cyan-500/40 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase font-bold tracking-wider text-cyan-400">
                {isIt ? 'Risultato Calcolo xGOT Conceduto' : 'Calculated xGOT Conceded'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-950/90 text-cyan-300 border border-cyan-700/60">
                Opta Analyst
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {xgotResult.xGOT.toFixed(2)}{' '}
                <span className="text-sm font-semibold text-gray-400">xGOT</span>
              </span>
              <span className="text-xs text-gray-400">
                (xG Pre-Tiro: <strong className="text-gray-200">{xgotResult.xG.toFixed(2)}</strong>,{' '}
                Diff:{' '}
                <strong className={xgotResult.differential >= 0 ? 'text-amber-400' : 'text-gray-400'}>
                  {xgotResult.differential > 0 ? `+${xgotResult.differential.toFixed(2)}` : xgotResult.differential.toFixed(2)}
                </strong>
                )
              </span>
            </div>
          </div>

          {/* Action button: Record Shot with xGOT */}
          <div className="w-full sm:w-auto flex flex-col items-end gap-1.5 flex-shrink-0">
            <button
              onClick={handleRecordShot}
              disabled={!hasSavedGoalEvent}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all ${
                hasSavedGoalEvent
                  ? 'bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white cursor-pointer shadow-cyan-900/30'
                  : 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed opacity-60'
              }`}
            >
              <CheckIcon className="w-4 h-4" />
              <span>
                {!hasSavedGoalEvent
                  ? (isIt ? '🔒 In attesa di evento dalla porta' : '🔒 Awaiting goal event')
                  : isIt
                  ? `Salva xGOT su Evento #${events.findIndex((e) => e.id === activeEvent?.id) + 1}`
                  : `Save xGOT on Event #${events.findIndex((e) => e.id === activeEvent?.id) + 1}`}
              </span>
            </button>
            {recordSuccessBadge && (
              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 animate-pulse">
                ✓ {isIt ? 'xGOT salvato sull\'evento!' : 'xGOT saved on event!'}
              </span>
            )}
          </div>
        </div>

        {/* OPTA ANALYST FACTOR BREAKDOWN MATRIX */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-800 text-[11px]">
          {/* 1. Distanza & Tempo di Volo */}
          <div className="p-2 bg-gray-800/80 rounded-lg border border-gray-700/60">
            <span className="text-[10px] text-gray-400 font-semibold uppercase block">
              📏 {isIt ? 'Distanza' : 'Distance'}
            </span>
            <span className="font-bold text-cyan-300 text-xs mt-0.5 block">
              {xgotResult.distanceMeters} m
            </span>
            <span className="text-[10px] text-gray-400">
              {isIt ? 'volo' : 'flight'} ~{xgotResult.optaBreakdown?.flightTimeSeconds}s ({xgotResult.optaBreakdown?.distanceFactor}x)
            </span>
          </div>

          {/* 2. Angolo di Tiro */}
          <div className="p-2 bg-gray-800/80 rounded-lg border border-gray-700/60">
            <span className="text-[10px] text-gray-400 font-semibold uppercase block">
              📐 {isIt ? 'Angolo Specchio' : 'Shot Angle'}
            </span>
            <span className="font-bold text-cyan-300 text-xs mt-0.5 block">
              {xgotResult.angleDegrees}°
            </span>
            <span className="text-[10px] text-gray-400">
              {isIt ? 'ampiezza' : 'coverage'} {xgotResult.optaBreakdown?.angleFactor}x
            </span>
          </div>

          {/* 3. Tipo di Azione */}
          <div className="p-2 bg-gray-800/80 rounded-lg border border-gray-700/60">
            <span className="text-[10px] text-gray-400 font-semibold uppercase block">
              ⚡ {isIt ? 'Tipo Azione' : 'Action Type'}
            </span>
            <span className="font-bold text-white text-xs mt-0.5 block truncate">
              {effectiveSituation === 'penalty'
                ? isIt ? 'Rigore' : 'Penalty'
                : effectiveSituation === 'fast_break'
                ? isIt ? 'Contropiede 1v1' : 'Fast Break'
                : effectiveSituation === 'free_kick'
                ? isIt ? 'Punizione' : 'Free Kick'
                : isIt ? 'Azione Aperta' : 'Open Play'}
            </span>
            <span className="text-[10px] text-gray-400">
              {isIt ? 'moltiplicatore' : 'multiplier'} {xgotResult.optaBreakdown?.actionMultiplier}x
            </span>
          </div>

          {/* 4. Parte del Corpo (Piede vs Testa) */}
          <div className="p-2 bg-gray-800/80 rounded-lg border border-gray-700/60">
            <span className="text-[10px] text-gray-400 font-semibold uppercase block">
              ⚽ {isIt ? 'Parte Corpo' : 'Body Part'}
            </span>
            <span className={`font-bold text-xs mt-0.5 block ${bodyPart === 'header' ? 'text-amber-300' : 'text-emerald-300'}`}>
              {bodyPart === 'header'
                ? isIt ? 'Colpo di Testa' : 'Header'
                : isIt ? 'Tiro di Piede' : 'Foot Strike'}
            </span>
            <span className="text-[10px] text-gray-400">
              {bodyPart === 'header'
                ? isIt ? '~45 km/h (lento, 0.70x)' : '~45 km/h (0.70x)'
                : isIt ? '~90-105 km/h (1.0x)' : '~90-105 km/h (1.0x)'}
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-300 italic pt-1">{xgotResult.explanation}</p>
      </div>

      {/* EXPLANATORY MODAL (Opta / StatsBomb Methodology) */}
      {showInfoModal && (
        <div
          className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4"
          onClick={() => setShowInfoModal(false)}
        >
          <div
            className="bg-gray-800 border border-gray-700 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-700 pb-3">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <InformationCircleIcon className="w-5 h-5 text-cyan-400" />
                <span>{isIt ? 'Modello xGOT (Expected Goals on Target)' : 'xGOT Conceded Model'}</span>
              </h3>
              <button
                onClick={() => setShowInfoModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs sm:text-sm text-gray-300 space-y-3 leading-relaxed max-h-[70vh] overflow-y-auto pr-1">
              <p>
                <strong>{isIt ? 'Cos\'è l\'xGOT Conceded?' : 'What is xGOT Conceded?'}</strong>
                <br />
                {isIt
                  ? 'Mentre il classico xG valuta la pericolosità al momento del tiro in base a distanza e angolo, l\'xGOT (Expected Goals on Target, o Post-Shot xG nei modelli Opta e StatsBomb) misura la reale probabilità che la conclusione diventi gol DOPO che il pallone è stato scagliato verso la porta.'
                  : 'While standard xG evaluates chance quality before the strike, xGOT evaluates the probability of a shot becoming a goal AFTER it has been struck, based on trajectory and placement inside the goal frame.'}
              </p>

              <div className="bg-gray-900/60 p-3 rounded-lg border border-gray-700 text-xs space-y-1.5">
                <p className="font-semibold text-cyan-300">{isIt ? 'I 5 Fattori Chiave del Modello Opta Analyst:' : 'Core Opta Analyst Principles:'}</p>
                <ul className="list-disc pl-4 space-y-1.5 text-gray-300">
                  <li>
                    <strong>{isIt ? '1. Distanza dalla Porta & Tempo di Volo:' : '1. Distance & Flight Time:'}</strong>{' '}
                    {isIt
                      ? 'Il tempo a disposizione del portiere per reagire e tuffarsi dipende dalla distanza. Da 5m il tempo di volo è inferiore al tempo di reazione umano (0.22s); da 25m+ il portiere ha tempo sufficiente per compiere un tuffo completo.'
                      : 'Goalkeeper reaction window depends directly on flight time. At 5m, flight time is below human reaction delay; at 25m+, the keeper has time to read and dive.'}
                  </li>
                  <li>
                    <strong>{isIt ? '2. Angolo di Tiro:' : '2. Shot Angle:'}</strong>{' '}
                    {isIt
                      ? 'I tiri centrali consentono all\'attaccante di mirare indifferentemente a entrambi i pali, costringendo il portiere a coprire l\'intera larghezza (7.32m). I tiri defilati (angolo stretto) riducono la porzione di porta scoperta.'
                      : 'Central shots force the goalkeeper to cover the entire 7.32m width. Acute angles narrow the unblocked goal area.'}
                  </li>
                  <li>
                    <strong>{isIt ? '3. Parte del Corpo (Piede vs Testa):' : '3. Body Part (Foot vs Header):' }</strong>{' '}
                    {isIt
                      ? 'I colpi di testa viaggiano mediamente a ~45 km/h rispetto ai ~90-105 km/h dei tiri di piede, raddoppiando il tempo di reazione del portiere. Nei modelli Opta, i colpi di testa da fuori area piccola hanno una conversione e un xGOT notevolmente inferiori.'
                      : 'Headers travel at ~45 km/h vs ~90-105 km/h for foot strikes, doubling reaction time. Headers outside the 6-yard box have significantly lower xGOT.'}
                  </li>
                  <li>
                    <strong>{isIt ? '4. Tipo di Azione:' : '4. Action Type:'}</strong>{' '}
                    {isIt
                      ? 'Nei contropiedi 1v1 l\'attaccante ha tempo e spazio (+20% xGOT), nei rigori (11m) i tiri negli angoli superano 0.90 xGOT, mentre nelle punizioni la barriera influenza la traiettoria e la visuale.'
                      : '1v1 fast breaks give attackers time (+20% xGOT), penalties into side thirds exceed 0.90 xGOT, and free kicks interact with the defensive wall.'}
                  </li>
                  <li>
                    <strong>{isIt ? '5. Piazzamento nello Specchio & Deviazioni:' : '5. Goalmouth Placement & Deflections:'}</strong>{' '}
                    {isIt
                      ? 'Incrocio dei pali e angoli bassi hanno massima difficoltà. Tiri fuori o sui legni hanno xGOT = 0.00. Una deviazione spiazza il portiere aumentando nettamente la probabilità di gol.'
                      : 'Corners have highest difficulty. Off-target/woodwork shots have xGOT = 0.00. Deflections sharply boost xGOT.'}
                  </li>
                </ul>
              </div>

              <div className="bg-emerald-950/40 p-3 rounded-lg border border-emerald-700/60 text-xs">
                <p className="font-semibold text-emerald-300">{isIt ? 'Metrica Gol Evitati (Goals Prevented):' : 'Goals Prevented:'}</p>
                <p className="mt-1 text-emerald-100">
                  <code>Gol Evitati = xGOT Concessi - Gol Subiti</code>
                  <br />
                  {isIt
                    ? 'Un valore positivo indica che il portiere ha parato tiri più difficili della media attesa (rendimento da fuoriclasse).'
                    : 'A positive value indicates the goalkeeper saved more goals than expected from shot quality.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-700">
              <button
                onClick={() => setShowInfoModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-lg transition-colors"
              >
                {isIt ? 'Chiudi' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HalfPitchXGOT;
