import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Language } from '../types';
import { translations } from '../utils/translations';
import {
  ArrowsRightLeftIcon,
  ArrowEnterIcon,
  ArrowExitIcon,
  XMarkIcon,
  CheckIcon,
} from './icons';

interface SubstitutionControlProps {
  subIn?: boolean;
  subInMinute?: string;
  subOut?: boolean;
  subOutMinute?: string;
  onChange: (update: {
    subIn: boolean;
    subInMinute: string;
    subOut: boolean;
    subOutMinute: string;
  }) => void;
  language: Language;
}

export const SubstitutionControl: React.FC<SubstitutionControlProps> = ({
  subIn = false,
  subInMinute = '',
  subOut = false,
  subOutMinute = '',
  onChange,
  language,
}) => {
  const t = useMemo(() => translations[language] || translations.en, [language]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Local draft state when opening popover
  const [draftSubIn, setDraftSubIn] = useState<boolean>(subIn || !!subInMinute);
  const [draftSubInMinute, setDraftSubInMinute] = useState<string>(subInMinute || '');
  const [draftSubOut, setDraftSubOut] = useState<boolean>(subOut || !!subOutMinute);
  const [draftSubOutMinute, setDraftSubOutMinute] = useState<string>(subOutMinute || '');

  // Keep draft in sync if external props change while closed
  useEffect(() => {
    if (!isOpen) {
      setDraftSubIn(subIn || !!subInMinute);
      setDraftSubInMinute(subInMinute || '');
      setDraftSubOut(subOut || !!subOutMinute);
      setDraftSubOutMinute(subOutMinute || '');
    }
  }, [subIn, subInMinute, subOut, subOutMinute, isOpen]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // Save on click outside
        handleConfirm();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, draftSubIn, draftSubInMinute, draftSubOut, draftSubOutMinute]);

  const hasActiveSub = (subIn && !!subInMinute) || (subOut && !!subOutMinute) || !!subInMinute || !!subOutMinute;

  const handleConfirm = () => {
    const isSubInActive = draftSubIn && draftSubInMinute.trim() !== '';
    const isSubOutActive = draftSubOut && draftSubOutMinute.trim() !== '';

    onChange({
      subIn: isSubInActive,
      subInMinute: isSubInActive ? draftSubInMinute.trim() : '',
      subOut: isSubOutActive,
      subOutMinute: isSubOutActive ? draftSubOutMinute.trim() : '',
    });
    setIsOpen(false);
  };

  const handleClear = () => {
    setDraftSubIn(false);
    setDraftSubInMinute('');
    setDraftSubOut(false);
    setDraftSubOutMinute('');
    onChange({
      subIn: false,
      subInMinute: '',
      subOut: false,
      subOutMinute: '',
    });
    setIsOpen(false);
  };

  // Build summary label for trigger button
  const getSummaryBadge = () => {
    const parts: string[] = [];
    if (subIn && subInMinute) {
      parts.push(`${t.tracking.subIn} ${subInMinute}'`);
    }
    if (subOut && subOutMinute) {
      parts.push(`${t.tracking.subOut} ${subOutMinute}'`);
    }
    return parts.join(' • ');
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        id="substitution-toggle-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all cursor-pointer shadow-md ${
          hasActiveSub
            ? 'bg-cyan-950/80 hover:bg-cyan-900/90 border-cyan-500/80 text-cyan-200 ring-2 ring-cyan-500/30 shadow-cyan-950/40'
            : 'bg-gray-700/80 hover:bg-gray-700 border-gray-600 text-gray-200 hover:text-white'
        }`}
        title={t.tracking.substitution}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <ArrowsRightLeftIcon className={`w-4 h-4 flex-shrink-0 ${hasActiveSub ? 'text-cyan-400' : 'text-gray-400'}`} />
        <span>{t.tracking.substitution}</span>
        {hasActiveSub && (
          <span className="ml-1 px-2 py-0.5 rounded-md text-xs font-bold bg-cyan-600/90 text-white flex items-center gap-1 shadow-sm">
            {getSummaryBadge()}
          </span>
        )}
      </button>

      {/* Popover / Modal Panel */}
      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 sm:hidden"
            onClick={handleConfirm}
          />

          <div
            role="dialog"
            aria-label={t.tracking.substitution}
            className="fixed sm:absolute top-1/2 sm:top-full left-1/2 sm:left-auto sm:right-0 -translate-x-1/2 sm:translate-x-0 -translate-y-1/2 sm:translate-y-0 mt-0 sm:mt-2 z-50 w-[92vw] sm:w-88 max-w-sm bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-5 text-white animate-fade-in"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                  <ArrowsRightLeftIcon className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-white">{t.tracking.substitution}</h3>
              </div>
              <button
                type="button"
                onClick={handleConfirm}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
                title={t.tracking.cancel}
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Options Body */}
            <div className="space-y-4">
              {/* Option 1: ENTRATA */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  draftSubIn
                    ? 'bg-emerald-950/30 border-emerald-600/60 ring-1 ring-emerald-500/20'
                    : 'bg-gray-750/70 border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="sub-in-checkbox"
                    className="flex items-center gap-2.5 font-semibold text-sm cursor-pointer select-none text-emerald-300"
                  >
                    <input
                      type="checkbox"
                      id="sub-in-checkbox"
                      checked={draftSubIn}
                      onChange={(e) => {
                        setDraftSubIn(e.target.checked);
                        if (!e.target.checked) setDraftSubInMinute('');
                      }}
                      className="w-4 h-4 text-emerald-500 rounded bg-gray-700 border-gray-600 focus:ring-emerald-500 focus:ring-offset-gray-800 cursor-pointer"
                    />
                    <span className="flex items-center gap-1.5">
                      <ArrowEnterIcon className="w-4 h-4 text-emerald-400 inline" />
                      {t.tracking.subIn}
                    </span>
                  </label>
                  {draftSubIn && (
                    <span className="text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                      {draftSubInMinute ? `${draftSubInMinute}'` : t.tracking.subMinute}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-2.5 ml-6.5">{t.tracking.subInHelp}</p>

                {draftSubIn && (
                  <div className="flex items-center gap-2 ml-6.5">
                    <span className="text-xs text-gray-300 font-medium">{t.tracking.subMinute}:</span>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min="1"
                        max="130"
                        placeholder={t.tracking.minutePlaceholder}
                        value={draftSubInMinute}
                        onChange={(e) => {
                          setDraftSubInMinute(e.target.value);
                          if (!draftSubIn && e.target.value) {
                            setDraftSubIn(true);
                          }
                        }}
                        className="w-24 bg-gray-700 text-white font-bold text-sm px-3 py-1.5 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        autoFocus
                      />
                      <span className="absolute right-2.5 text-xs text-gray-400 pointer-events-none font-semibold">'</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Option 2: USCITA */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  draftSubOut
                    ? 'bg-amber-950/30 border-amber-600/60 ring-1 ring-amber-500/20'
                    : 'bg-gray-750/70 border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="sub-out-checkbox"
                    className="flex items-center gap-2.5 font-semibold text-sm cursor-pointer select-none text-amber-300"
                  >
                    <input
                      type="checkbox"
                      id="sub-out-checkbox"
                      checked={draftSubOut}
                      onChange={(e) => {
                        setDraftSubOut(e.target.checked);
                        if (!e.target.checked) setDraftSubOutMinute('');
                      }}
                      className="w-4 h-4 text-amber-500 rounded bg-gray-700 border-gray-600 focus:ring-amber-500 focus:ring-offset-gray-800 cursor-pointer"
                    />
                    <span className="flex items-center gap-1.5">
                      <ArrowExitIcon className="w-4 h-4 text-amber-400 inline" />
                      {t.tracking.subOut}
                    </span>
                  </label>
                  {draftSubOut && (
                    <span className="text-[11px] font-medium text-amber-400 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded">
                      {draftSubOutMinute ? `${draftSubOutMinute}'` : t.tracking.subMinute}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-2.5 ml-6.5">{t.tracking.subOutHelp}</p>

                {draftSubOut && (
                  <div className="flex items-center gap-2 ml-6.5">
                    <span className="text-xs text-gray-300 font-medium">{t.tracking.subMinute}:</span>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min="1"
                        max="130"
                        placeholder={t.tracking.minutePlaceholder}
                        value={draftSubOutMinute}
                        onChange={(e) => {
                          setDraftSubOutMinute(e.target.value);
                          if (!draftSubOut && e.target.value) {
                            setDraftSubOut(true);
                          }
                        }}
                        className="w-24 bg-gray-700 text-white font-bold text-sm px-3 py-1.5 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <span className="absolute right-2.5 text-xs text-gray-400 pointer-events-none font-semibold">'</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-700 gap-2">
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-2 text-xs font-medium text-gray-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
              >
                {t.tracking.clearSub}
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
              >
                <CheckIcon className="w-4 h-4" />
                <span>{t.tracking.confirmSub}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
export default SubstitutionControl;
