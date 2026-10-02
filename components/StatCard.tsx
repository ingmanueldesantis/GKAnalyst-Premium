import React from 'react';

interface StatCardProps {
  label: string;
  value: string;
  subValue?: React.ReactNode;
  colorClass?: string;
  compact?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subValue,
  colorClass = 'text-cyan-400',
  compact = false,
}) => {
  return (
    <div
      className={`bg-gray-800 rounded-xl text-center border border-gray-700 shadow-md flex flex-col justify-between items-center hover:border-gray-600 transition-colors min-w-0 w-full ${
        compact ? 'p-2 sm:p-3' : 'p-2.5 sm:p-3.5 md:p-4'
      }`}
    >
      <p
        className="text-[11px] sm:text-xs md:text-sm text-gray-300 font-semibold mb-1 text-center leading-tight break-words max-w-full min-h-[1.75rem] flex items-center justify-center px-0.5"
        title={typeof label === 'string' ? label : undefined}
      >
        {label}
      </p>
      <div
        className={`font-black tracking-tight my-auto ${
          compact
            ? 'text-lg sm:text-2xl md:text-3xl'
            : 'text-xl sm:text-2xl md:text-3xl'
        } ${colorClass}`}
      >
        {value}
      </div>
      {subValue ? (
        <div className="text-[10px] sm:text-[11px] text-gray-400 font-medium mt-1 text-center leading-tight break-words max-w-full w-full px-0.5">
          {subValue}
        </div>
      ) : (
        <div className="h-0" />
      )}
    </div>
  );
};

export default StatCard;
