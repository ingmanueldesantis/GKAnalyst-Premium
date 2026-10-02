
import React, { useMemo } from 'react';
import { SoccerEvent, Language } from '../types';
import { translations } from '../utils/translations';

interface SoccerGoalProps {
  events: SoccerEvent[];
  onGoalClick: (x: number, y: number) => void;
  language: Language;
}

const eventColorMapping: { [key in SoccerEvent['outcome']]: string } = {
    'Goal': 'fill-red-500 stroke-red-300',
    'Deflected': 'fill-orange-500 stroke-orange-300',
    'Post': 'fill-emerald-500 stroke-emerald-300',
    'Saved': 'fill-yellow-500 stroke-yellow-300',
    'Blocked': 'fill-green-500 stroke-green-300',
    'Out': 'fill-gray-500 stroke-gray-300',
    'Defense': 'fill-blue-500 stroke-blue-300',
    'Completed': 'fill-green-500 stroke-green-300',
    'Failed': 'fill-red-500 stroke-red-300',
};

const SoccerGoal: React.FC<SoccerGoalProps> = ({ events, onGoalClick, language }) => {
    const t = useMemo(() => translations[language], [language]);

    const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        onGoalClick(x, y);
    };

    return (
        <div className="w-full max-w-lg aspect-[2/1] relative cursor-crosshair">
            <svg
                viewBox="0 0 300 150"
                className="w-full h-full"
                onClick={handleClick}
            >
                <rect width="300" height="150" fill="#1F2937" />

                <rect x="29" y="29" width="242" height="82" fill="none" stroke="#E5E7EB" strokeWidth="2" />
                <rect x="30" y="30" width="240" height="80" fill="transparent" />

                {Array.from({ length: 23 }).map((_, i) => (
                    <line key={`v-${i}`} x1={40 + i * 10} y1="30" x2={40 + i * 10} y2="110" stroke="#4B5563" strokeWidth="0.5" />
                ))}
                {Array.from({ length: 7 }).map((_, i) => (
                    <line key={`h-${i}`} x1="30" y1={40 + i * 10} x2="270" y2={40 + i * 10} stroke="#4B5563" strokeWidth="0.5" />
                ))}

                <line x1="30" y1="110" x2="270" y2="110" stroke="#E5E7EB" strokeWidth="2" />

                <line x1="0" y1="110" x2="30" y2="110" stroke="#22c55e" strokeWidth="2" />
                <line x1="270" y1="110" x2="300" y2="110" stroke="#22c55e" strokeWidth="2" />


                {events.map((event, index) => (
                    <circle
                        key={`${event.id}_${index}`}
                        cx={`${event.x}%`}
                        cy={`${event.y}%`}
                        r="4"
                        className={`${eventColorMapping[event.outcome]} transition-transform duration-300 ease-out`}
                        style={{ transformOrigin: `${event.x}% ${event.y}%` }}
                        aria-label={`${t.eventTypes[event.type]}: ${t.outcomes[event.outcome]}`}
                    />
                ))}
            </svg>
        </div>
    );
};

export default SoccerGoal;
