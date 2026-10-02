
import React, { useMemo, useState, useEffect } from 'react';
import { SoccerEvent, EventType, Language, Player, MatchDetails } from '../types';
import Heatmap from './Heatmap';
import StatCard from './StatCard';
import { usePlayerStats } from '../hooks/usePlayerStats';
import { calculateSessionXgotSummary } from '../utils/xgotCalculator';
import { translations } from '../utils/translations';
import {
  GoogleSheetsIcon,
  ArrowPathIcon,
  ExternalLinkIcon,
  ChevronDownIcon,
  ChartBarIcon,
  GoalkeeperGloveIcon,
  FootprintIcon,
  ArrowsRightLeftIcon,
  CalendarIcon,
  XMarkIcon,
  CheckIcon,
  MagnifyingGlassIcon,
} from './icons';

const parataEventTypesForFilter: EventType[] = ['Shot', 'Free Kick', 'Rush out', 'Penalty'];
const sideViewEventTypesForFilter: EventType[] = ['Intervention']; 

const HeatmapSection: React.FC<{
    title: string;
    events: SoccerEvent[];
    view: 'parata' | 'side';
    allowedEventTypes: EventType[];
    language: Language;
    side?: 'left' | 'right';
}> = ({ title, events, view, allowedEventTypes, language, side }) => {
    const t = useMemo(() => translations[language], [language]);

    const availableTypes = useMemo(() => {
        const typesInEvents = [...new Set(events.map(e => e.type))];
        return allowedEventTypes.filter(type => typesInEvents.includes(type));
    }, [events, allowedEventTypes]);

    const availableOutcomes = useMemo(() => 
        [...new Set(events.map(e => e.outcome))].sort(),
        [events]
    );

    const [selectedTypes, setSelectedTypes] = useState<EventType[]>([]);
    const [selectedOutcome, setSelectedOutcome] = useState<string>('all');
    
    useEffect(() => {
        setSelectedTypes(availableTypes);
    }, [availableTypes]);

    const handleTypeToggle = (type: EventType) => {
        setSelectedTypes(prev =>
            prev.includes(type)
                ? prev.filter(t => t !== type)
                : [...prev, type]
        );
    };

    const handleSelectAllTypes = () => {
        if (selectedTypes.length === availableTypes.length) {
            setSelectedTypes([]);
        } else {
            setSelectedTypes(availableTypes);
        }
    };

    const filteredEvents = useMemo(() => {
        if (selectedTypes.length === 0) return [];
        return events.filter(event => {
            const typeMatch = selectedTypes.includes(event.type);
            const outcomeMatch = selectedOutcome === 'all' || event.outcome === selectedOutcome;
            return typeMatch && outcomeMatch;
        });
    }, [events, selectedTypes, selectedOutcome]);

    const aspectRatio = view === 'parata' ? 'aspect-[2/1]' : 'aspect-[3/2]';

    return (
        <div className="bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-700">
            <h3 className="text-xl font-bold mb-4">{title}</h3>

            <div className="grid md:grid-cols-2 gap-x-6 gap-y-4 mb-4 p-3 bg-gray-900/40 rounded-lg border border-gray-700">
                {availableTypes.length > 0 && (
                     <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-gray-300">{t.stats.filterType}</label>
                            {availableTypes.length > 1 && (
                                <button onClick={handleSelectAllTypes} className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors">
                                    {selectedTypes.length === availableTypes.length ? t.stats.clearAll : t.stats.selectAll}
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {availableTypes.map(type => (
                                <button
                                    key={type}
                                    onClick={() => handleTypeToggle(type)}
                                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                                        selectedTypes.includes(type)
                                            ? 'bg-cyan-600 text-white shadow'
                                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                    }`}
                                >
                                    {t.eventTypes[type]}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div>
                    <label htmlFor={`outcome-filter-${title.replace(/\s/g, '')}`} className="block text-sm font-medium text-gray-300 mb-2">{t.stats.filterOutcome}</label>
                    <div className="relative">
                        <select
                            id={`outcome-filter-${title.replace(/\s/g, '')}`}
                            value={selectedOutcome}
                            onChange={e => setSelectedOutcome(e.target.value)}
                            className="w-full appearance-none bg-gray-800 text-white rounded-xl px-3.5 py-2.5 pr-10 text-base sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-600 hover:border-gray-500 transition-colors cursor-pointer min-h-[44px] shadow-inner"
                            aria-label={`Filter ${title} events by outcome`}
                        >
                            <option value="all" className="bg-gray-800 text-white font-medium">{t.stats.allOutcomes}</option>
                            {availableOutcomes.map(outcome => (
                                <option key={outcome} value={outcome} className="bg-gray-800 text-gray-100">{t.outcomes[outcome as any] || outcome}</option>
                            ))}
                        </select>
                        <ChevronDownIcon className="w-4 h-4 text-cyan-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                </div>
            </div>

            <div className="w-full max-w-2xl mx-auto">
                {filteredEvents.length > 0 ? (
                    <Heatmap
                        events={filteredEvents}
                        view={view}
                        side={side}
                        language={language}
                        showControls={true}
                    />
                ) : (
                    <div className={`flex items-center justify-center ${aspectRatio} text-gray-500 rounded-lg bg-gray-900/30 border border-gray-700/50`}>
                       <p className="text-center px-4">
                        {t.stats.noMatchFilter}
                       </p>
                    </div>
                )}
            </div>
        </div>
    );
};


interface StatsViewProps {
    events: SoccerEvent[];
    language: Language;
    selectedPlayer?: Player | null;
    matchDetails?: MatchDetails;
    onRefreshFromSheet?: () => void;
    isLoadingSheet?: boolean;
    isConnectedGoogle?: boolean;
    hasGoogleSheet?: boolean;
    selectedMatchKey?: string;
    onSelectMatchKey?: (key: string) => void;
}

const StatsView: React.FC<StatsViewProps> = ({
    events,
    language,
    selectedPlayer,
    matchDetails,
    onRefreshFromSheet,
    isLoadingSheet = false,
    isConnectedGoogle = false,
    hasGoogleSheet = false,
    selectedMatchKey,
    onSelectMatchKey,
}) => {
    const t = useMemo(() => translations[language], [language]);
    const [internalMatchKey, setInternalMatchKey] = useState<string>('ALL');
    const [isMatchFilterOpen, setIsMatchFilterOpen] = useState<boolean>(false);
    const [matchSearchQuery, setMatchSearchQuery] = useState<string>('');
    const isItalian = language === 'it';
    const isSpanish = language === 'es';

    // Lock body scroll and handle Escape key when match filter sheet is open
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isMatchFilterOpen) {
                setIsMatchFilterOpen(false);
            }
        };
        if (isMatchFilterOpen) {
            window.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isMatchFilterOpen]);

    // Controlled or uncontrolled match key
    const activeMatchKey = selectedMatchKey !== undefined ? selectedMatchKey : internalMatchKey;

    const handleMatchChange = (newKey: string) => {
        if (onSelectMatchKey) {
            onSelectMatchKey(newKey);
        } else {
            setInternalMatchKey(newKey);
        }
    };

    // Extract all unique matches from the events
    const availableMatches = useMemo(() => {
        const map = new Map<string, {
            key: string;
            date: string;
            matchName: string;
            competition: string;
            eventCount: number;
        }>();

        for (const event of events) {
            const date = (event.matchDate || '').trim();
            const matchName = (event.matchName || '').trim();
            const competition = (event.competition || '').trim();
            const displayDate = date || (event.timestamp ? new Date(event.timestamp).toISOString().split('T')[0] : '');
            const displayMatch = matchName;
            const key = `${displayDate}___${displayMatch}___${competition}`;

            if (!map.has(key)) {
                map.set(key, {
                    key,
                    date: displayDate,
                    matchName: displayMatch,
                    competition,
                    eventCount: 0,
                });
            }
            map.get(key)!.eventCount++;
        }

        return Array.from(map.values()).sort((a, b) => {
            if (a.date && b.date) {
                return b.date.localeCompare(a.date);
            }
            return (b.date ? 1 : 0) - (a.date ? 1 : 0);
        });
    }, [events]);

    // Active single match details if one is selected
    const selectedMatchInfo = useMemo(() => {
        if (activeMatchKey === 'ALL') return null;
        return availableMatches.find(m => m.key === activeMatchKey) || null;
    }, [activeMatchKey, availableMatches]);

    // Filter events based on activeMatchKey
    const displayedEvents = useMemo(() => {
        if (activeMatchKey === 'ALL') {
            return events;
        }
        return events.filter(e => {
            const date = (e.matchDate || '').trim();
            const matchName = (e.matchName || '').trim();
            const competition = (e.competition || '').trim();
            const displayDate = date || (e.timestamp ? new Date(e.timestamp).toISOString().split('T')[0] : '');
            const key = `${displayDate}___${matchName}___${competition}`;
            return key === activeMatchKey;
        });
    }, [events, activeMatchKey]);

    // Filter matches for the search box inside the selection modal
    const filteredMatches = useMemo(() => {
        if (!matchSearchQuery.trim()) {
            return availableMatches;
        }
        const query = matchSearchQuery.toLowerCase().trim();
        return availableMatches.filter((m) => {
            const matchName = (m.matchName || '').toLowerCase();
            const date = (m.date || '').toLowerCase();
            const competition = (m.competition || '').toLowerCase();
            return matchName.includes(query) || date.includes(query) || competition.includes(query);
        });
    }, [availableMatches, matchSearchQuery]);

    const {
        stats,
        distributionStats,
        parataEvents,
        cornerLeftEvents,
        cornerRightEvents,
        crossLeftEvents,
        crossRightEvents,
        hasVisualizableData,
    } = usePlayerStats(displayedEvents, matchDetails);

    const xgotSummary = useMemo(() => {
        return calculateSessionXgotSummary(displayedEvents);
    }, [displayedEvents]);

    return (
        <div className="space-y-6">
            {/* MATCH SELECTION TOOLBAR */}
            <div className="bg-gray-800 p-4 sm:p-5 rounded-2xl shadow-lg border border-gray-700 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-700/80">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 rounded-xl">
                            <ChartBarIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base sm:text-lg font-bold text-white">
                                    {t.stats.selectMatch}
                                </h3>
                                {selectedPlayer && (
                                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-700/50">
                                        {selectedPlayer.name}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {activeMatchKey === 'ALL'
                                    ? t.stats.showingTotalSubtitle
                                    : `${t.stats.showingSingleSubtitle} "${selectedMatchInfo?.matchName || selectedMatchInfo?.date || t.stats.singleMatch}"`}
                            </p>
                        </div>
                    </div>

                    {/* Google Sheets Actions */}
                    <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
                        {hasGoogleSheet && onRefreshFromSheet && (
                            <button
                                type="button"
                                id="refresh-stats-sheet-btn"
                                onClick={onRefreshFromSheet}
                                disabled={isLoadingSheet}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-700/70 text-emerald-300 rounded-xl font-semibold text-xs transition-colors disabled:opacity-50"
                                title="Ricarica i dati dal foglio Google Sheet"
                            >
                                {isLoadingSheet ? (
                                    <ArrowPathIcon className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                                ) : (
                                    <GoogleSheetsIcon className="w-3.5 h-3.5" />
                                )}
                                <span>{isLoadingSheet ? t.stats.refreshingSheet : t.stats.refreshFromSheet}</span>
                            </button>
                        )}

                        {selectedPlayer?.webViewLink && (
                            <a
                                href={selectedPlayer.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-700/60 hover:bg-gray-700 border border-gray-600 text-gray-300 rounded-xl text-xs font-medium transition-colors"
                                title={t.stats.viewGoogleSheet}
                            >
                                <ExternalLinkIcon className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Google Sheet</span>
                            </a>
                        )}
                    </div>
                </div>

                {/* Dropdown / Drawer Selector: Optimized for Mobile, Tablet & Desktop */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 whitespace-nowrap">
                        <CalendarIcon className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        <span>{t.stats.matchFilterLabel}:</span>
                    </span>

                    <div className="relative flex-grow">
                        <button
                            type="button"
                            id="stats-match-filter-trigger"
                            onClick={() => {
                                setMatchSearchQuery('');
                                setIsMatchFilterOpen(true);
                            }}
                            className={`w-full text-left rounded-xl px-3.5 sm:px-4 py-2.5 sm:py-3 transition-all flex items-center justify-between gap-3 shadow-sm min-h-[50px] active:scale-[0.99] border cursor-pointer ${
                                activeMatchKey !== 'ALL'
                                    ? 'bg-gray-900 border-cyan-500/80 text-white shadow-md shadow-cyan-950/40 hover:border-cyan-400'
                                    : 'bg-gray-900/90 border-gray-600 hover:border-gray-500 text-white'
                            }`}
                            aria-haspopup="dialog"
                            aria-expanded={isMatchFilterOpen}
                        >
                            <div className="flex items-center gap-2.5 min-w-0 flex-grow">
                                <div className={`p-2 rounded-lg flex-shrink-0 ${
                                    activeMatchKey !== 'ALL'
                                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                                        : 'bg-gray-800 text-gray-300 border border-gray-700'
                                }`}>
                                    {activeMatchKey === 'ALL' ? (
                                        <ChartBarIcon className="w-4 h-4" />
                                    ) : (
                                        <CalendarIcon className="w-4 h-4" />
                                    )}
                                </div>
                                <div className="min-w-0 flex-grow">
                                    {activeMatchKey === 'ALL' ? (
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm sm:text-base text-white tracking-tight truncate">
                                                    {t.stats.totalMatches}
                                                </span>
                                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/80 font-semibold flex-shrink-0">
                                                    {events.length} {t.stats.eventsTotal}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-gray-400 truncate mt-0.5">
                                                {availableMatches.length} {availableMatches.length === 1 ? 'partita registrata' : 'partite registrate'} • {isItalian ? 'Tocca per scegliere una singola partita' : 'Tap to filter single match'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                <span className="font-bold text-sm sm:text-base text-cyan-300 truncate">
                                                    {selectedMatchInfo?.matchName || t.stats.untitledMatch}
                                                </span>
                                                {selectedMatchInfo?.competition && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-medium truncate max-w-[150px]">
                                                        {selectedMatchInfo.competition}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] text-gray-300 mt-0.5">
                                                <span className="text-gray-400">{selectedMatchInfo?.date || (isItalian ? 'Data n/d' : 'No date')}</span>
                                                <span>•</span>
                                                <span className="text-emerald-400 font-semibold">{displayedEvents.length} eventi</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0 text-cyan-400">
                                <span className="text-xs font-semibold hidden md:inline text-gray-400">
                                    {isItalian ? 'Cambia' : 'Change'}
                                </span>
                                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isMatchFilterOpen ? 'rotate-180 text-cyan-300' : 'text-cyan-400'}`} />
                            </div>
                        </button>
                    </div>

                    {/* Quick reset button if a single match is filtered */}
                    {activeMatchKey !== 'ALL' && (
                        <button
                            type="button"
                            id="reset-match-filter-btn"
                            onClick={() => handleMatchChange('ALL')}
                            className="px-4 py-2.5 min-h-[50px] text-xs font-bold text-cyan-300 hover:text-white bg-cyan-950/70 hover:bg-cyan-900 active:scale-[0.98] rounded-xl border border-cyan-700/70 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm flex-shrink-0"
                            title={isItalian ? 'Ritorna alla vista di tutte le partite' : 'Reset to all matches'}
                        >
                            <ArrowPathIcon className="w-3.5 h-3.5" />
                            <span>{t.stats.totalMatches}</span>
                        </button>
                    )}
                </div>

                {/* Responsive Mobile / Tablet / Desktop Match Filter Modal & Bottom Sheet Drawer */}
                {isMatchFilterOpen && (
                    <div className="fixed inset-0 z-50 overflow-hidden flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4">
                        {/* Backdrop with blur */}
                        <div
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-fade-in"
                            onClick={() => setIsMatchFilterOpen(false)}
                            aria-hidden="true"
                        />

                        {/* Modal Box / Bottom Drawer */}
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-label={t.stats.selectMatch}
                            className="relative z-10 w-full sm:max-w-xl bg-gray-900 border-t sm:border border-gray-700/90 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[88vh] sm:max-h-[82vh] overflow-hidden animate-in slide-in-from-bottom duration-200"
                        >
                            {/* Drag Indicator for Mobile Touch */}
                            <div className="w-12 h-1.5 bg-gray-600 rounded-full mx-auto my-2.5 sm:hidden flex-shrink-0" />

                            {/* Header */}
                            <div className="px-4 py-3 sm:px-6 sm:py-4 bg-gray-850/90 border-b border-gray-800 flex items-center justify-between gap-3 flex-shrink-0">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex-shrink-0">
                                        <CalendarIcon className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base sm:text-lg font-bold text-white truncate">
                                                {t.stats.selectMatch}
                                            </h3>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 border border-gray-700 font-semibold flex-shrink-0">
                                                {availableMatches.length} {availableMatches.length === 1 ? 'partita' : 'partite'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400 truncate mt-0.5">
                                            {isItalian
                                                ? 'Seleziona una partita specifica o visualizza il riepilogo complessivo'
                                                : isSpanish
                                                ? 'Selecciona un partido o el resumen general'
                                                : 'Choose a specific match or view overall total'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsMatchFilterOpen(false)}
                                    className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-colors flex-shrink-0 active:scale-95"
                                    aria-label="Chiudi"
                                >
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Search bar (when matches >= 3) */}
                            {availableMatches.length >= 3 && (
                                <div className="p-3 sm:px-6 sm:pt-3.5 sm:pb-2 border-b border-gray-800/80 bg-gray-900/90 flex-shrink-0">
                                    <div className="relative">
                                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                            <MagnifyingGlassIcon className="w-4 h-4" />
                                        </div>
                                        <input
                                            type="text"
                                            value={matchSearchQuery}
                                            onChange={(e) => setMatchSearchQuery(e.target.value)}
                                            placeholder={
                                                isItalian
                                                    ? 'Cerca per avversario, data o competizione...'
                                                    : isSpanish
                                                    ? 'Buscar por rival, fecha o torneo...'
                                                    : 'Search opponent, date or competition...'
                                            }
                                            className="w-full bg-gray-800/90 text-white rounded-xl pl-10 pr-9 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-700 shadow-inner"
                                            autoFocus={false}
                                        />
                                        {matchSearchQuery && (
                                            <button
                                                type="button"
                                                onClick={() => setMatchSearchQuery('')}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white"
                                            >
                                                <XMarkIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Scrollable list of match options */}
                            <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2.5 overscroll-contain">
                                {/* Option 1: ALL MATCHES / TOTAL */}
                                {!matchSearchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleMatchChange('ALL');
                                            setIsMatchFilterOpen(false);
                                        }}
                                        className={`w-full text-left p-3.5 sm:p-4 rounded-xl transition-all border flex items-center justify-between gap-3 min-h-[58px] active:scale-[0.99] ${
                                            activeMatchKey === 'ALL'
                                                ? 'bg-cyan-950/60 border-2 border-cyan-400 shadow-lg shadow-cyan-950/50'
                                                : 'bg-gray-800/90 hover:bg-gray-800 border-gray-700/80 active:bg-gray-750'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0 flex-grow">
                                            <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                                                activeMatchKey === 'ALL'
                                                    ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40'
                                                    : 'bg-gray-700/60 text-gray-300 border border-gray-600/60'
                                            }`}>
                                                <ChartBarIcon className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-bold text-sm sm:text-base ${
                                                        activeMatchKey === 'ALL' ? 'text-cyan-300' : 'text-white'
                                                    }`}>
                                                        {t.stats.allMatchesTotal || 'Tutte le partite (Totale complessivo)'}
                                                    </span>
                                                    {activeMatchKey === 'ALL' && (
                                                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-cyan-500 text-gray-950 flex-shrink-0">
                                                            {isItalian ? 'Attivo' : 'Active'}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-400 mt-0.5 truncate">
                                                    {isItalian
                                                        ? 'Statistiche aggregate di tutte le partite giocate'
                                                        : 'Combined stats across all played matches'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2.5 flex-shrink-0">
                                            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-900/80 text-gray-300 border border-gray-700">
                                                {events.length} {t.stats.eventsTotal}
                                            </span>
                                            {activeMatchKey === 'ALL' && (
                                                <div className="w-6 h-6 rounded-full bg-cyan-500 text-gray-950 flex items-center justify-center flex-shrink-0 shadow-sm">
                                                    <CheckIcon className="w-4 h-4 stroke-[2.5]" />
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                )}

                                {/* Divider & Count */}
                                <div className="pt-2 pb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-gray-400 px-1">
                                    <span>
                                        {isItalian ? 'Partite registrate' : isSpanish ? 'Partidos registrados' : 'Recorded Matches'} ({filteredMatches.length})
                                    </span>
                                    {matchSearchQuery && (
                                        <span className="text-cyan-400 lowercase font-normal">
                                            {isItalian ? 'risultati filtro' : 'filter results'}
                                        </span>
                                    )}
                                </div>

                                {/* Match items */}
                                {filteredMatches.map((m) => {
                                    const isSelected = activeMatchKey === m.key;
                                    const dateLabel = (m.date || '').trim();
                                    const nameLabel = (m.matchName || '').trim();
                                    const compLabel = (m.competition || '').trim();

                                    return (
                                        <button
                                            key={m.key}
                                            type="button"
                                            onClick={() => {
                                                handleMatchChange(m.key);
                                                setIsMatchFilterOpen(false);
                                            }}
                                            className={`w-full text-left p-3.5 sm:p-4 rounded-xl transition-all border flex items-center justify-between gap-3 min-h-[58px] active:scale-[0.99] ${
                                                isSelected
                                                    ? 'bg-cyan-950/60 border-2 border-cyan-400 shadow-lg shadow-cyan-950/50'
                                                    : 'bg-gray-800/80 hover:bg-gray-800 border-gray-700/80 active:bg-gray-750'
                                            }`}
                                        >
                                            <div className="min-w-0 flex-grow space-y-1">
                                                {/* Date & Competition tags */}
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <div className="inline-flex items-center gap-1.5 text-xs text-gray-300 font-medium px-2 py-0.5 rounded-md bg-gray-900/80 border border-gray-700/80">
                                                        <CalendarIcon className="w-3.5 h-3.5 text-cyan-400" />
                                                        <span>{dateLabel || (isItalian ? 'Data non specificata' : 'No date')}</span>
                                                    </div>
                                                    {compLabel && (
                                                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-cyan-950/80 text-cyan-300 border border-cyan-800/70 truncate max-w-[200px]">
                                                            {compLabel}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Match Name / Opponent */}
                                                <div className="pt-0.5">
                                                    <h4 className={`text-sm sm:text-base font-bold truncate ${
                                                        isSelected ? 'text-white' : 'text-gray-100'
                                                    }`}>
                                                        ⚽ {nameLabel || (isItalian ? 'Amichevole / Allenamento' : t.stats.untitledMatch)}
                                                    </h4>
                                                </div>
                                            </div>

                                            {/* Right side: Event Count & Selection Check */}
                                            <div className="flex items-center gap-2.5 flex-shrink-0">
                                                <div className="text-right">
                                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border block ${
                                                        isSelected
                                                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80'
                                                            : 'bg-gray-900/80 text-gray-300 border-gray-700'
                                                    }`}>
                                                        {m.eventCount} {m.eventCount === 1 ? 'evento' : 'eventi'}
                                                    </span>
                                                </div>

                                                {isSelected ? (
                                                    <div className="w-6 h-6 rounded-full bg-cyan-500 text-gray-950 flex items-center justify-center flex-shrink-0 shadow-sm">
                                                        <CheckIcon className="w-4 h-4 stroke-[2.5]" />
                                                    </div>
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full border border-gray-600 flex-shrink-0 sm:opacity-0 group-hover:opacity-100" />
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}

                                {/* Empty Search Results State */}
                                {filteredMatches.length === 0 && (
                                    <div className="p-8 text-center bg-gray-800/50 rounded-xl border border-gray-700/60 space-y-2">
                                        <p className="text-sm text-gray-300 font-medium">
                                            {isItalian
                                                ? `Nessuna partita corrisponde a "${matchSearchQuery}"`
                                                : `No matches found matching "${matchSearchQuery}"`}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setMatchSearchQuery('')}
                                            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 underline"
                                        >
                                            {isItalian ? 'Cancella filtro di ricerca' : 'Clear search query'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Footer for Mobile & Tablet */}
                            <div className="p-3 sm:p-4 bg-gray-850/95 border-t border-gray-800 flex items-center justify-between gap-3 flex-shrink-0">
                                <div className="text-xs text-gray-400 truncate hidden sm:block">
                                    {activeMatchKey !== 'ALL' ? (
                                        <span>{isItalian ? 'Filtro attivo:' : 'Active filter:'} <strong className="text-cyan-300">{selectedMatchInfo?.matchName || selectedMatchInfo?.date}</strong></span>
                                    ) : (
                                        <span>{isItalian ? 'Visualizzazione di tutte le partite' : 'Viewing all matches'}</span>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setIsMatchFilterOpen(false)}
                                    className="w-full sm:w-auto px-6 py-2.5 bg-gray-800 hover:bg-gray-700 active:bg-gray-650 text-gray-200 font-bold text-sm rounded-xl border border-gray-700 transition-colors text-center shadow-sm"
                                >
                                    {isItalian ? 'Chiudi' : isSpanish ? 'Cerrar' : 'Close'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Context badge info for active selection */}
                {activeMatchKey === 'ALL' ? (
                    <div className="flex flex-wrap items-center gap-2.5 text-xs text-gray-300 bg-gray-900/40 px-3.5 py-2.5 rounded-xl border border-gray-700/60">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-cyan-950/80 text-cyan-300 font-semibold border border-cyan-800/60 text-[11px]">
                            {t.stats.totalMatches}
                        </span>
                        <span className="text-gray-400">
                            {availableMatches.length} {availableMatches.length === 1 ? 'partita trovata' : 'partite trovate'} •{' '}
                            <strong className="text-white">{events.length}</strong> {t.stats.eventsTotal}
                        </span>
                    </div>
                ) : selectedMatchInfo ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs bg-gray-900/50 p-2.5 rounded-xl border border-gray-700/80">
                        <div className="bg-gray-800/90 px-3 py-2 rounded-lg border border-gray-700/60">
                            <span className="text-[10px] text-gray-400 block font-medium uppercase tracking-wider">{t.stats.matchDate}</span>
                            <span className="font-semibold text-white truncate block mt-0.5">{selectedMatchInfo.date || '-'}</span>
                        </div>
                        <div className="bg-gray-800/90 px-3 py-2 rounded-lg border border-gray-700/60">
                            <span className="text-[10px] text-gray-400 block font-medium uppercase tracking-wider">{t.stats.matchName}</span>
                            <span className="font-semibold text-cyan-300 truncate block mt-0.5">{selectedMatchInfo.matchName || t.stats.untitledMatch}</span>
                        </div>
                        <div className="bg-gray-800/90 px-3 py-2 rounded-lg border border-gray-700/60">
                            <span className="text-[10px] text-gray-400 block font-medium uppercase tracking-wider">{t.stats.competition}</span>
                            <span className="font-semibold text-gray-200 truncate block mt-0.5">{selectedMatchInfo.competition || '-'}</span>
                        </div>
                        <div className="bg-gray-800/90 px-3 py-2 rounded-lg border border-gray-700/60">
                            <span className="text-[10px] text-gray-400 block font-medium uppercase tracking-wider">{t.stats.eventsInMatch}</span>
                            <span className="font-bold text-emerald-400 block mt-0.5">{displayedEvents.length}</span>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Empty state when selected single match has no events */}
            {displayedEvents.length === 0 && (
                <div className="bg-gray-800/80 p-8 rounded-2xl border border-gray-700 text-center">
                    <p className="text-gray-300 font-medium">
                        {activeMatchKey !== 'ALL'
                            ? `Nessun evento registrato per la partita selezionata.`
                            : `Nessun dato registrato per questo portiere.`}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                        {hasGoogleSheet
                            ? 'Usa il pulsante "Aggiorna da Google Sheet" sopra per risincronizzare gli eventi dal foglio del portiere.'
                            : 'Puoi registrare nuovi eventi nella sezione Tracciamento o sincronizzare con Google Sheets.'}
                    </p>
                </div>
            )}

            {/* STATS OVERVIEW CARDS (8 riquadri: Numero Partite, Minuti giocati, Gol Subiti, Clean Sheets, Tiri Subiti, Parate effettuate, % Parate effettuate, Gol/minuti) */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                {/* 1. Numero Partite */}
                <StatCard
                    label={t.stats.matchesCount}
                    value={stats.matchesCount.toString()}
                    colorClass="text-cyan-400"
                />

                {/* 2. Minuti giocati */}
                <StatCard
                    label={t.stats.minutesPlayed}
                    value={`${stats.minutesPlayed}'`}
                    colorClass="text-cyan-300"
                />

                {/* 3. Gol Subiti */}
                <StatCard
                    label={t.stats.goalsConceded}
                    value={stats.goalsConceded.toString()}
                    colorClass="text-rose-400"
                />

                {/* 4. Clean Sheets */}
                <StatCard
                    label={t.stats.cleanSheets}
                    value={stats.cleanSheets.toString()}
                    colorClass="text-emerald-400"
                />

                {/* 5. Tiri Subiti */}
                <StatCard
                    label={t.stats.shotsFaced}
                    value={stats.shotsFaced.toString()}
                    colorClass="text-purple-300"
                />

                {/* 6. Parate effettuate */}
                <StatCard
                    label={t.stats.savesMade}
                    value={stats.savesMade.toString()}
                    colorClass="text-teal-300"
                />

                {/* 7. % Parate effettuate */}
                <StatCard
                    label={t.stats.savePerc}
                    value={`${stats.savePercentage}%`}
                    colorClass="text-cyan-400"
                />

                {/* 8. Gol/minuti */}
                <StatCard
                    label={t.stats.goalsPerMinutes}
                    value={stats.goalsPerMinutesDisplay}
                    colorClass="text-amber-400"
                />
            </div>

            {/* xGOT CONCEDED & GOALS PREVENTED (Opta / StatsBomb model) */}
            {xgotSummary.totalShots > 0 && (
                <div className="bg-gray-800 p-4 sm:p-5 rounded-2xl shadow-lg border border-gray-700 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-700/80">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-xl">
                                <GoalkeeperGloveIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-base sm:text-lg font-bold text-white">
                                        {language === 'it' ? 'Analisi xGOT Concessi & Gol Evitati' : language === 'es' ? 'Análisis xGOT Concedidos & Goles Salvados' : 'xGOT Conceded & Goals Prevented'}
                                    </h3>
                                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-700/60">
                                        Opta / StatsBomb
                                    </span>
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {language === 'it'
                                        ? 'Expected Goals on Target concessi e bilancio gol salvati sopra la media attesa'
                                        : 'Post-shot expected goals conceded and goals saved above expected quality'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-gray-900/60 p-3 rounded-xl border border-gray-700 text-center">
                            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                                {language === 'it' ? 'xGOT Concessi' : 'xGOT Conceded'}
                            </span>
                            <span className="text-2xl font-black text-cyan-400 mt-1 block">
                                {xgotSummary.totalXgotConceded.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-gray-400">
                                {xgotSummary.shotsOnTarget} {language === 'it' ? 'tiri nello specchio' : 'shots on target'}
                            </span>
                        </div>

                        <div className="bg-gray-900/60 p-3 rounded-xl border border-gray-700 text-center">
                            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                                {language === 'it' ? 'xG Pre-Tiro' : 'Pre-Shot xG'}
                            </span>
                            <span className="text-2xl font-black text-purple-300 mt-1 block">
                                {xgotSummary.totalXGConceded.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-gray-400">
                                {language === 'it' ? 'pericolosità di base' : 'baseline chance'}
                            </span>
                        </div>

                        <div className="bg-gray-900/60 p-3 rounded-xl border border-gray-700 text-center">
                            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                                {language === 'it' ? 'Gol Evitati' : 'Goals Prevented'}
                            </span>
                            <span className={`text-2xl font-black mt-1 block ${
                                xgotSummary.goalsPrevented >= 0.5 ? 'text-emerald-400' : xgotSummary.goalsPrevented >= 0 ? 'text-yellow-400' : 'text-rose-400'
                            }`}>
                                {xgotSummary.goalsPrevented > 0 ? `+${xgotSummary.goalsPrevented.toFixed(2)}` : xgotSummary.goalsPrevented.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-gray-400">
                                {language === 'it' ? 'xGOT - Gol Subiti' : 'xGOT - Goals Conceded'}
                            </span>
                        </div>

                        <div className="bg-gray-900/60 p-3 rounded-xl border border-gray-700 text-center">
                            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                                {language === 'it' ? 'xGOT / Tiro Porta' : 'Avg Shot xGOT'}
                            </span>
                            <span className="text-2xl font-black text-amber-300 mt-1 block">
                                {xgotSummary.avgXgotPerShotOnTarget > 0 ? xgotSummary.avgXgotPerShotOnTarget.toFixed(2) : '-'}
                            </span>
                            <span className="text-[10px] text-gray-400">
                                {language === 'it' ? 'difficoltà media' : 'shot difficulty'}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* DISTRIBUTION STATS */}
            {(distributionStats.total > 0 || displayedEvents.length > 0) && (() => {
                const renderPassBreakdown = (shortVal: number, longVal: number) => {
                    const isIt = language === 'it';
                    const isEs = language === 'es';
                    const shortText = isIt ? 'corti' : isEs ? 'cortos' : 'short';
                    const longText = isIt ? 'lunghi' : isEs ? 'largos' : 'long';

                    return (
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 text-[10px] sm:text-[11px] leading-tight text-gray-300">
                            <span className="whitespace-nowrap">{shortVal} {shortText}</span>
                            <span className="hidden sm:inline text-gray-500">•</span>
                            <span className="whitespace-nowrap">{longVal} {longText}</span>
                        </div>
                    );
                };

                const renderRatioSubValue = (numerator: number, denominator: number) => {
                    return (
                        <span className="text-[10px] sm:text-[11px] text-gray-300 font-medium whitespace-nowrap">
                            {numerator}/{denominator} {language === 'it' ? 'tot.' : 'tot'}
                        </span>
                    );
                };

                return (
                 <div className="bg-gray-800 p-3.5 sm:p-5 rounded-2xl shadow-lg border border-gray-700 space-y-4 sm:space-y-5">
                    {/* Header with Title and Overall Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-700/80">
                        <div className="flex items-start sm:items-center gap-3">
                            <div className="p-2 sm:p-2.5 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 rounded-xl flex-shrink-0 mt-0.5 sm:mt-0">
                                <ArrowsRightLeftIcon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                                        {t.stats.distribution}
                                    </h3>
                                    <span className="text-[11px] sm:text-xs font-semibold px-2 sm:px-2.5 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-700/50">
                                        {distributionStats.total} {distributionStats.total === 1 ? (language === 'it' ? 'evento' : 'event') : t.stats.eventsTotal}
                                    </span>
                                </div>
                                <p className="text-xs sm:text-sm text-gray-400 mt-0.5 leading-snug">
                                    {t.stats.distributionSubtitle}
                                </p>
                            </div>
                        </div>

                        {/* Overall summary pill */}
                        <div className="flex items-center justify-between sm:justify-start gap-2.5 text-xs font-medium bg-gray-900/80 px-3 py-2 sm:px-3.5 sm:py-1.5 rounded-xl border border-gray-700/70 w-full sm:w-auto">
                            <span className="text-gray-300 font-medium">{t.stats.totalDistribution}:</span>
                            <div className="flex items-center gap-1.5">
                                <span className="font-bold text-cyan-300">{distributionStats.completed}/{distributionStats.total}</span>
                                <span className="text-emerald-400 font-bold">({distributionStats.percentage}%)</span>
                            </div>
                        </div>
                    </div>

                    {/* TWO DEDICATED BLOCKS: DISTRIBUZIONE CON LE MANI & DISTRIBUZIONE CON I PIEDI */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                        {/* 1. DISTRIBUZIONE CON LE MANI */}
                        <div className="bg-gray-900/50 p-3.5 sm:p-4.5 rounded-xl border border-gray-700/70 flex flex-col justify-between space-y-3.5">
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="p-1.5 bg-cyan-500/15 text-cyan-400 rounded-lg border border-cyan-500/25 flex-shrink-0">
                                            <GoalkeeperGloveIcon className="w-4 h-4" />
                                        </div>
                                        <h4 className="text-sm sm:text-base font-bold text-white">
                                            {t.stats.handDistribution}
                                        </h4>
                                    </div>
                                    <span className="text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-md bg-cyan-950/70 text-cyan-300 border border-cyan-800/40 flex-shrink-0">
                                        {distributionStats.hand.total} {distributionStats.hand.total === 1 ? (language === 'it' ? 'evento' : 'event') : (language === 'it' ? 'eventi' : 'events')}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-400 leading-snug">
                                    {t.stats.handDistributionDesc}
                                </p>
                            </div>

                            {/* Riquadri Completati e Falliti con le mani */}
                            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                <StatCard
                                    compact
                                    label={t.stats.completedHand}
                                    value={distributionStats.hand.completed.toString()}
                                    subValue={distributionStats.hand.total > 0 ? renderPassBreakdown(distributionStats.hand.shortCompleted, distributionStats.hand.longCompleted) : undefined}
                                    colorClass="text-emerald-400"
                                />
                                <StatCard
                                    compact
                                    label={t.stats.failedHand}
                                    value={distributionStats.hand.failed.toString()}
                                    subValue={distributionStats.hand.total > 0 ? renderPassBreakdown(distributionStats.hand.shortFailed, distributionStats.hand.longFailed) : undefined}
                                    colorClass="text-rose-400"
                                />
                                <StatCard
                                    compact
                                    label={t.stats.percHand}
                                    value={`${distributionStats.hand.percentage}%`}
                                    subValue={distributionStats.hand.total > 0 ? renderRatioSubValue(distributionStats.hand.completed, distributionStats.hand.total) : undefined}
                                    colorClass="text-cyan-400"
                                />
                            </div>
                        </div>

                        {/* 2. DISTRIBUZIONE CON I PIEDI */}
                        <div className="bg-gray-900/50 p-3.5 sm:p-4.5 rounded-xl border border-gray-700/70 flex flex-col justify-between space-y-3.5">
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="p-1.5 bg-emerald-500/15 text-emerald-400 rounded-lg border border-emerald-500/25 flex-shrink-0">
                                            <FootprintIcon className="w-4 h-4" />
                                        </div>
                                        <h4 className="text-sm sm:text-base font-bold text-white">
                                            {t.stats.footDistribution}
                                        </h4>
                                    </div>
                                    <span className="text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-950/70 text-emerald-300 border border-emerald-800/40 flex-shrink-0">
                                        {distributionStats.foot.total} {distributionStats.foot.total === 1 ? (language === 'it' ? 'evento' : 'event') : (language === 'it' ? 'eventi' : 'events')}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-400 leading-snug">
                                    {t.stats.footDistributionDesc}
                                </p>
                            </div>

                            {/* Riquadri Completati e Falliti con i piedi */}
                            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                <StatCard
                                    compact
                                    label={t.stats.completedFoot}
                                    value={distributionStats.foot.completed.toString()}
                                    subValue={distributionStats.foot.total > 0 ? renderPassBreakdown(distributionStats.foot.shortCompleted, distributionStats.foot.longCompleted) : undefined}
                                    colorClass="text-emerald-400"
                                />
                                <StatCard
                                    compact
                                    label={t.stats.failedFoot}
                                    value={distributionStats.foot.failed.toString()}
                                    subValue={distributionStats.foot.total > 0 ? renderPassBreakdown(distributionStats.foot.shortFailed, distributionStats.foot.longFailed) : undefined}
                                    colorClass="text-rose-400"
                                />
                                <StatCard
                                    compact
                                    label={t.stats.percFoot}
                                    value={`${distributionStats.foot.percentage}%`}
                                    subValue={distributionStats.foot.total > 0 ? renderRatioSubValue(distributionStats.foot.completed, distributionStats.foot.total) : undefined}
                                    colorClass="text-cyan-400"
                                />
                            </div>
                        </div>
                    </div>

                    {/* TOTALE COMPLESSIVO (Riepilogo Totale Distribuzione) */}
                    <div className="bg-gray-900/35 p-3 sm:p-4 rounded-xl border border-gray-700/60 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                                {t.stats.totalDistributionSummary}
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 sm:gap-3">
                            <StatCard
                                compact
                                label={t.stats.completedTotal}
                                value={distributionStats.completed.toString()}
                                subValue={distributionStats.total > 0 ? (
                                    <span className="text-[10px] sm:text-[11px] text-gray-300 font-medium">
                                        {distributionStats.hand.completed + distributionStats.foot.completed} {language === 'it' ? 'a segno' : language === 'es' ? 'con éxito' : 'on target'}
                                    </span>
                                ) : undefined}
                                colorClass="text-emerald-400"
                            />
                            <StatCard
                                compact
                                label={t.stats.failedTotal}
                                value={distributionStats.failed.toString()}
                                subValue={distributionStats.total > 0 ? (
                                    <span className="text-[10px] sm:text-[11px] text-gray-300 font-medium">
                                        {distributionStats.hand.failed + distributionStats.foot.failed} {language === 'it' ? 'sbagliati' : language === 'es' ? 'fallidos' : 'missed'}
                                    </span>
                                ) : undefined}
                                colorClass="text-rose-400"
                            />
                            <StatCard
                                compact
                                label={t.stats.completionPerc}
                                value={`${distributionStats.percentage}%`}
                                subValue={distributionStats.total > 0 ? (
                                    <span className="text-[10px] sm:text-[11px] text-gray-300 font-medium">
                                        {distributionStats.completed}/{distributionStats.total} {language === 'it' ? 'tot.' : 'tot'}
                                    </span>
                                ) : undefined}
                                colorClass="text-cyan-400"
                            />
                        </div>
                    </div>
                </div>
                );
            })()}

            {/* HEATMAPS */}
            {parataEvents.length > 0 && (
                <HeatmapSection 
                    title={t.stats.heatmapSaves}
                    events={parataEvents}
                    view="parata"
                    allowedEventTypes={parataEventTypesForFilter}
                    language={language}
                />
            )}
            
            {cornerLeftEvents.length > 0 && (
                 <HeatmapSection 
                    title={t.stats.heatmapCornerL}
                    events={cornerLeftEvents}
                    view="side"
                    allowedEventTypes={sideViewEventTypesForFilter}
                    language={language}
                    side="left"
                />
            )}

            {cornerRightEvents.length > 0 && (
                 <HeatmapSection 
                    title={t.stats.heatmapCornerR}
                    events={cornerRightEvents}
                    view="side"
                    allowedEventTypes={sideViewEventTypesForFilter}
                    language={language}
                    side="right"
                />
            )}

            {crossLeftEvents.length > 0 && (
                 <HeatmapSection 
                    title={t.stats.heatmapCrossL}
                    events={crossLeftEvents}
                    view="side"
                    allowedEventTypes={sideViewEventTypesForFilter}
                    language={language}
                    side="left"
                />
            )}

            {crossRightEvents.length > 0 && (
                 <HeatmapSection 
                    title={t.stats.heatmapCrossR}
                    events={crossRightEvents}
                    view="side"
                    allowedEventTypes={sideViewEventTypesForFilter}
                    language={language}
                    side="right"
                />
            )}
            
            {!hasVisualizableData && distributionStats.total === 0 && displayedEvents.length > 0 && (
                 <div className="bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-700">
                    <h3 className="text-xl font-bold mb-4">Event Heatmap</h3>
                    <div className="flex items-center justify-center h-64 text-gray-500 rounded-lg bg-gray-900/30">
                        <p className="text-center px-4">
                            {t.stats.noDataHeatmap}
                        </p>
                    </div>
                 </div>
            )}
        </div>
    );
};

export default StatsView;
