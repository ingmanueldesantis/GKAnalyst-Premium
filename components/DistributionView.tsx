
import React, { useState, useMemo } from 'react';
import { EventType, EventOutcome, Language } from '../types';
import { translations } from '../utils/translations';

interface DistributionViewProps {
  onAddEvent: (type: EventType, outcome: EventOutcome, notes: string) => void;
  language: Language;
}

const distributionTypes: EventType[] = [
    'Short hand pass', 'Long hand pass',
    'Short foot pass', 'Long foot pass',
];
const distributionOutcomes: EventOutcome[] = ['Completed', 'Failed'];

const DistributionView: React.FC<DistributionViewProps> = ({ onAddEvent, language }) => {
    const t = useMemo(() => translations[language], [language]);
    const [selectedType, setSelectedType] = useState<EventType>(distributionTypes[0]);
    const [selectedOutcome, setSelectedOutcome] = useState<EventOutcome>(distributionOutcomes[0]);
    const [notes, setNotes] = useState('');

    const handleSave = () => {
        if (selectedType) {
            onAddEvent(selectedType, selectedOutcome, notes);
            setNotes('');
        }
    };

    const OptionButton: React.FC<{ value: string; label: string; selectedValue: string; onSelect: (value: any) => void; }> = ({ value, label, selectedValue, onSelect }) => (
      <button
          onClick={() => onSelect(value)}
          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors w-full
              ${selectedValue === value
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`
          }
      >
          {label}
      </button>
  );

    return (
        <div className="w-full max-w-md">
             <h2 className="text-2xl font-bold text-white mb-6 text-center">{t.tracking.registerEvent}</h2>
            
            <div className="mb-6">
                <h3 className="font-semibold text-gray-300 mb-3">{t.tracking.eventType}</h3>
                <div className="grid grid-cols-2 gap-2">
                    {distributionTypes.map(type => 
                        <OptionButton key={type} value={type} label={t.eventTypes[type]} selectedValue={selectedType} onSelect={setSelectedType} />
                    )}
                </div>
            </div>

            <div className="mb-6">
                <h3 className="font-semibold text-gray-300 mb-3">{t.tracking.outcome}</h3>
                <div className="grid grid-cols-2 gap-2">
                    {distributionOutcomes.map(outcome => 
                        <OptionButton key={outcome} value={outcome} label={t.outcomes[outcome]} selectedValue={selectedOutcome} onSelect={setSelectedOutcome} />
                    )}
                </div>
            </div>
            
            <div className="mb-8">
                <h3 className="font-semibold text-gray-300 mb-3">{t.tracking.notesLabel}</h3>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t.tracking.notesPlaceholder}
                    className="w-full h-24 bg-gray-900 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                />
            </div>

            <button
                onClick={handleSave}
                disabled={!selectedType}
                className="w-full px-4 py-2.5 bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-700/70 text-emerald-300 hover:text-emerald-200 font-semibold rounded-lg transition-colors shadow-md shadow-emerald-950/40 disabled:bg-gray-800 disabled:border-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
                {t.tracking.save}
            </button>
        </div>
    );
};

export default DistributionView;
