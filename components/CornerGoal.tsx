
import React, { useMemo } from 'react';
import { SoccerEvent, Language } from '../types';
import { translations } from '../utils/translations';

interface CornerGoalProps {
  events: SoccerEvent[];
  onGoalClick: (x: number, y: number) => void;
  side: 'left' | 'right';
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

const RightSideGoalDrawing: React.FC = () => {
    const goalPath = `M120 40 L 90 40 L 50 160 L 120 160 Z`;
    
    return (
        <g>
            <defs>
                <clipPath id="corner-goal-mask">
                     <path d={goalPath} />
                </clipPath>
            </defs>

            <g clipPath="url(#corner-goal-mask)">
                {Array.from({ length: 8 }).map((_, i) => (
                    <line key={`v-${i}`} x1={50 + i * 10} y1="40" x2={50 + i * 10} y2="160" stroke="#4B5563" strokeWidth="0.5" />
                ))}
                {Array.from({ length: 11 }).map((_, i) => (
                    <line key={`h-${i}`} x1="50" y1={50 + i * 10} x2="120" y2={50 + i * 10} stroke="#4B5563" strokeWidth="0.5" />
                ))}
            </g>
            
            <path d={`M120 40 L 90 40 L 50 160 L 120 160 L 120 40`} stroke="#E5E7EB" strokeWidth="2" fill="none" />
        </g>
    );
};


const CornerGoal: React.FC<CornerGoalProps> = ({ events, onGoalClick, side, language }) => {
    const t = useMemo(() => translations[language], [language]);

    const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();
        const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
        const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

        const rightSideGoalLinePercent = 40; 
        const leftSideGoalLinePercent = 60;

        if (side === 'right' && xPercent < rightSideGoalLinePercent) {
            return; 
        }
        if (side === 'left' && xPercent > leftSideGoalLinePercent) {
            return; 
        }

        onGoalClick(xPercent, yPercent);
    };

    const transform = side === 'left' ? 'translate(300, 0) scale(-1, 1)' : '';

    return (
        <div className="w-full max-w-lg aspect-[3/2] relative cursor-crosshair">
            <svg
                viewBox="0 0 300 200"
                className="w-full h-full"
                onClick={handleClick}
                aria-label={side === 'left' ? t.tracking.gkLeft : t.tracking.gkRight}
            >
                <rect width="300" height="200" fill="#1F2937" />

                <line x1="0" y1="160" x2="300" y2="160" stroke="#4B5563" strokeWidth="2" />

                <g transform={transform}>
                   <RightSideGoalDrawing />
                </g>
                
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

                {side === 'right' && (
                    <rect 
                        x="0" y="0" width="120" height="200" 
                        fill="transparent" 
                        style={{ cursor: 'not-allowed' }} 
                    />
                )}
                {side === 'left' && (
                    <rect 
                        x="180" y="0" width="120" height="200" 
                        fill="transparent" 
                        style={{ cursor: 'not-allowed' }} 
                    />
                )}
            </svg>
        </div>
    );
};

export default CornerGoal;
