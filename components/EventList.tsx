
import React, { useMemo } from 'react';
import { SoccerEvent, Language } from '../types';
import { TrashIcon } from './icons';
import { translations } from '../utils/translations';

interface EventListProps {
  events: SoccerEvent[];
  onDeleteEvent: (id: string) => void;
  language: Language;
  selectedEventId?: string | null;
  onSelectEvent?: (id: string) => void;
}

const outcomeStyles: { [key in SoccerEvent['outcome']]: string } = {
    Goal: 'bg-red-500/20 text-red-300 border-red-500',
    Deflected: 'bg-orange-500/20 text-orange-300 border-orange-500',
    Post: 'bg-emerald-500/20 text-emerald-300 border-emerald-500',
    Saved: 'bg-yellow-500/20 text-yellow-300 border-yellow-500',
    Blocked: 'bg-green-500/20 text-green-300 border-green-500',
    Out: 'bg-gray-500/20 text-gray-300 border-gray-500',
    Defense: 'bg-blue-500/20 text-blue-300 border-blue-500',
    Completed: 'bg-green-500/20 text-green-300 border-green-500',
    Failed: 'bg-red-500/20 text-red-300 border-red-500',
};


const EventList: React.FC<EventListProps> = ({ events, onDeleteEvent, language, selectedEventId, onSelectEvent }) => {
  const t = useMemo(() => translations[language], [language]);

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        {t.tracking.noEvents}
      </div>
    );
  }

  const sortedEvents = [...events].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="space-y-3 h-full max-h-[60vh] overflow-y-auto pr-2">
      {sortedEvents.map((event, index) => {
        const isSelected = selectedEventId === event.id;
        return (
          <div
            key={`${event.id}_${index}`}
            onClick={() => onSelectEvent && onSelectEvent(event.id)}
            className={`p-3 rounded-lg flex items-start justify-between gap-2 transition-all ${
              onSelectEvent ? 'cursor-pointer' : ''
            } ${
              isSelected
                ? 'bg-gray-700 ring-2 ring-cyan-500 border border-cyan-400/80 shadow-md shadow-cyan-950/40'
                : 'bg-gray-700/50 hover:bg-gray-700/80 border border-transparent'
            }`}
          >
            <div className="flex items-start gap-4 flex-grow">
              <span className="text-sm font-bold text-gray-400 mt-1">#{events.length - index}</span>
              <div className="flex-grow">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-white">{t.eventTypes[event.type]}</p>
                  {event.xGOT !== undefined && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-700/60">
                      xGOT: {event.xGOT.toFixed(2)}
                    </span>
                  )}
                  {event.shotDistance !== undefined && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-800 text-gray-300 border border-gray-600">
                      {event.shotDistance}m
                    </span>
                  )}
                  {event.x >= 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-800 text-emerald-300 border border-emerald-800/60" title={language === 'it' ? 'Coordinate Specchio Porta' : 'Goal Frame Coords'}>
                      {language === 'it' ? 'Porta' : 'Goal'}: ({event.x.toFixed(0)}%, {event.y.toFixed(0)}%)
                    </span>
                  )}
                  {event.pitchX !== undefined && event.pitchY !== undefined && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-800 text-cyan-300 border border-cyan-800/60" title={language === 'it' ? 'Coordinate Metà Campo' : 'Pitch Coords'}>
                      {language === 'it' ? 'Campo' : 'Pitch'}: ({event.pitchX.toFixed(0)}%, {event.pitchY.toFixed(0)}%)
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-1">{new Date(event.timestamp).toLocaleTimeString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 mt-1">
               <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${outcomeStyles[event.outcome]}`}>
                  {t.outcomes[event.outcome]}
               </span>
               <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteEvent(event.id);
                  }}
                  className="text-gray-500 hover:text-red-400 p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-colors"
                  aria-label={`Delete event #${events.length - index}`}
               >
                  <TrashIcon className="w-4 h-4"/>
               </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default EventList;
