
import React, { useState, useEffect, useMemo } from 'react';
import { EventType, EventOutcome, TrackingMode, Language } from '../types';
import { translations } from '../utils/translations';

interface EventModalProps {
  onClose: () => void;
  onSave: (
    type: EventType,
    outcome: EventOutcome,
    notes: string,
    extraData?: {
      pitchX?: number;
      pitchY?: number;
      xG?: number;
      xGOT?: number;
      shotDistance?: number;
    }
  ) => void;
  mode: TrackingMode | null;
  clickCoords: { x: number; y: number } | null;
  language: Language;
}

const eventTypes: EventType[] = ['Shot', 'Free Kick', 'Penalty', 'Rush out'];
const parataOutcomes: EventOutcome[] = ['Deflected', 'Goal', 'Post', 'Saved', 'Blocked', 'Out'];
const cornerOutcomes: EventOutcome[] = ['Deflected', 'Goal', 'Saved', 'Blocked', 'Defense'];

const EventModal: React.FC<EventModalProps> = ({ onClose, onSave, mode, clickCoords, language }) => {
  const t = useMemo(() => translations[language], [language]);
  const isSideViewMode = mode === 'Corner' || mode === 'Cross';
  
  const outcomesToShow = useMemo(() => isSideViewMode ? cornerOutcomes : parataOutcomes, [isSideViewMode]);
  
  const [selectedType, setSelectedType] = useState<EventType>('Shot');
  const [selectedOutcome, setSelectedOutcome] = useState<EventOutcome>(outcomesToShow[0]);
  const [notes, setNotes] = useState('');

  const isPaloAllowed = useMemo(() => {
    if (mode !== 'Saves' || !clickCoords) return false;

    const { x, y } = clickCoords;
    const tolerance = 3; 

    const leftPostX = (29 / 300) * 100;
    const rightPostX = ((29 + 242) / 300) * 100;
    const crossbarY = (29 / 150) * 100; 
    const goalLineY = (110 / 150) * 100;   

    const isNearLeftPost = x >= leftPostX - tolerance && x <= leftPostX + tolerance && y >= crossbarY && y <= goalLineY;
    const isNearRightPost = x >= rightPostX - tolerance && x <= rightPostX + tolerance && y >= crossbarY && y <= goalLineY;
    const isNearCrossbar = y >= crossbarY - tolerance && y <= crossbarY + tolerance && x >= leftPostX && x <= rightPostX;
    
    return isNearLeftPost || isNearRightPost || isNearCrossbar;
  }, [clickCoords, mode]);

  const isOutAllowed = useMemo(() => {
    if (mode !== 'Saves' || !clickCoords) return false;

    const { x, y } = clickCoords;

    const leftPostX = (29 / 300) * 100;
    const rightPostX = ((29 + 242) / 300) * 100;
    const crossbarY = (29 / 150) * 100; 
    const goalLineY = (110 / 150) * 100; 

    const isAboveCrossbar = y < crossbarY;
    const isLeftOfPost = x < leftPostX && y >= crossbarY && y <= goalLineY;
    const isRightOfPost = x > rightPostX && y >= crossbarY && y <= goalLineY;

    return isAboveCrossbar || isLeftOfPost || isRightOfPost;
  }, [clickCoords, mode]);

  const isRushOutAllowed = useMemo(() => {
    if (mode !== 'Saves' || !clickCoords) return false;
    const { y } = clickCoords;
    const goalLineYPercent = (110 / 150) * 100;
    return y > goalLineYPercent;
  }, [clickCoords, mode]);

  useEffect(() => {
      if (!outcomesToShow.includes(selectedOutcome)) {
          setSelectedOutcome(outcomesToShow[0]);
      }
  }, [outcomesToShow, selectedOutcome]);

  useEffect(() => {
    if (selectedOutcome === 'Post' && !isPaloAllowed) {
      setSelectedOutcome(outcomesToShow[0]);
    }
    if (selectedOutcome === 'Out' && !isOutAllowed) {
      setSelectedOutcome(outcomesToShow[0]);
    }
    if (selectedType === 'Rush out' && !isRushOutAllowed) {
        setSelectedType('Shot'); 
    }
  }, [isPaloAllowed, isOutAllowed, selectedOutcome, outcomesToShow, isRushOutAllowed, selectedType]);

  const handleSave = () => {
    const typeToSave = isSideViewMode ? 'Intervention' : selectedType;
    let extraData: any = undefined;

    if (mode === 'Saves') {
      const isPenalty = selectedType === 'Penalty';
      extraData = {
        pitchX: 50,
        pitchY: isPenalty ? 20.95 : 31.4,
        shotDistance: isPenalty ? 11 : 16.5,
      };
    }

    onSave(typeToSave, selectedOutcome, notes, extraData);
  };

  const OptionButton: React.FC<{ value: string; label: string; selectedValue: string; onSelect: (value: any) => void; disabled?: boolean; }> = ({ value, label, selectedValue, onSelect, disabled = false }) => (
      <button
          onClick={() => !disabled && onSelect(value)}
          disabled={disabled}
          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors w-full
              ${selectedValue === value
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
      >
          {label}
      </button>
  );

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md border border-gray-700 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white">{t.tracking.registerEvent}</h2>
        </div>
        
        {!isSideViewMode && (
          <div className="mb-4">
              <h3 className="font-semibold text-gray-300 mb-2 text-xs uppercase tracking-wider">{t.tracking.eventType}</h3>
              <div className="grid grid-cols-2 gap-2">
                  {eventTypes.map(type => 
                      <OptionButton 
                        key={type} 
                        value={type} 
                        label={t.eventTypes[type]}
                        selectedValue={selectedType} 
                        onSelect={setSelectedType}
                        disabled={type === 'Rush out' && !isRushOutAllowed}
                      />
                  )}
              </div>
          </div>
        )}

        <div className="mb-4">
            <h3 className="font-semibold text-gray-300 mb-2 text-xs uppercase tracking-wider">{t.tracking.outcome}</h3>
            {isSideViewMode ? (
                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        {cornerOutcomes.slice(0, 4).map(outcome => 
                           <OptionButton key={outcome} value={outcome} label={t.outcomes[outcome]} selectedValue={selectedOutcome} onSelect={setSelectedOutcome} />
                        )}
                    </div>
                    {cornerOutcomes.length > 4 && (
                       <OptionButton 
                           key={cornerOutcomes[4]} 
                           value={cornerOutcomes[4]} 
                           label={t.outcomes[cornerOutcomes[4]]}
                           selectedValue={selectedOutcome} 
                           onSelect={setSelectedOutcome} 
                       />
                    )}
                </div>
            ) : (
                <div className={`grid gap-2 ${parataOutcomes.length > 4 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                     {parataOutcomes.map(outcome => 
                        <OptionButton 
                          key={outcome} 
                          value={outcome} 
                          label={t.outcomes[outcome]}
                          selectedValue={selectedOutcome} 
                          onSelect={setSelectedOutcome} 
                          disabled={
                              (outcome === 'Post' && !isPaloAllowed) ||
                              (outcome === 'Out' && !isOutAllowed)
                          }
                        />
                    )}
                </div>
            )}
        </div>
        
        <div className="mb-6">
            <h3 className="font-semibold text-gray-300 mb-2 text-xs uppercase tracking-wider">{t.tracking.notesLabel}</h3>
            <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.tracking.notesPlaceholder}
                className="w-full h-20 bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none text-xs"
            />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors text-xs"
          >
            {t.tracking.cancel}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-700/70 text-emerald-300 hover:text-emerald-200 font-semibold rounded-lg transition-colors shadow-md shadow-emerald-950/40 text-xs"
          >
            {t.tracking.save}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventModal;
