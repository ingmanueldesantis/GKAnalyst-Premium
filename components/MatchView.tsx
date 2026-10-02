
import React, { useMemo } from 'react';
import { MatchDetails, Language, Player } from '../types';
import { translations } from '../utils/translations';
import { CheckIcon, GoogleSheetsIcon, ExternalLinkIcon, XMarkIcon } from './icons';

interface MatchViewProps {
  matchDetails: MatchDetails;
  onDetailsChange: (field: keyof MatchDetails, value: string) => void;
  language: Language;
  onSave?: () => void;
  isSaving?: boolean;
  selectedPlayer?: Player | null;
  eventsCount?: number;
  saveSuccessBanner?: { message: string; sheetUrl?: string } | null;
  onDismissSuccessBanner?: () => void;
  saveError?: string | null;
}

const MatchView: React.FC<MatchViewProps> = ({
  matchDetails,
  onDetailsChange,
  language,
  onSave,
  isSaving = false,
  selectedPlayer = null,
  eventsCount = 0,
  saveSuccessBanner = null,
  onDismissSuccessBanner,
  saveError = null,
}) => {
  const t = useMemo(() => translations[language], [language]);
  const isItalian = language === 'it';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    onDetailsChange(name as keyof MatchDetails, value);
  };

  const isSaveDisabled = isSaving || !matchDetails.date || !selectedPlayer;

  return (
    <div className="max-w-2xl mx-auto bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
      <h2 className="text-2xl font-bold text-white mb-6">{t.match.title}</h2>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-300 mb-1">
            {t.match.date} <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="date"
            name="date"
            value={matchDetails.date}
            onChange={handleInputChange}
            className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            required
          />
          <p className="text-xs text-gray-400 mt-1">{t.match.dateHelp}</p>
        </div>
        
        <div>
          <label htmlFor="matchName" className="block text-sm font-medium text-gray-300 mb-1">{t.match.match}</label>
          <input
            type="text"
            id="matchName"
            name="matchName"
            placeholder={t.match.placeholderMatch}
            value={matchDetails.matchName}
            onChange={handleInputChange}
            className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <div>
          <label htmlFor="competition" className="block text-sm font-medium text-gray-300 mb-1">{t.match.competition}</label>
          <input
            type="text"
            id="competition"
            name="competition"
            placeholder={t.match.placeholderComp}
            value={matchDetails.competition}
            onChange={handleInputChange}
            className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            {t.match.duration}
          </label>
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={t.match.duration}>
            <button
              type="button"
              role="radio"
              aria-checked={(matchDetails.duration || '90') === '80'}
              onClick={() => onDetailsChange('duration', '80')}
              className={`py-3 px-4 rounded-xl font-medium text-sm border transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
                (matchDetails.duration || '90') === '80'
                  ? 'bg-cyan-600/90 hover:bg-cyan-600 border-cyan-400 text-white shadow-lg shadow-cyan-900/30 ring-2 ring-cyan-500/40 font-semibold'
                  : 'bg-gray-750/90 border-gray-600/80 hover:bg-gray-700 hover:border-gray-500 text-gray-300'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                  (matchDetails.duration || '90') === '80'
                    ? 'border-white bg-white'
                    : 'border-gray-400'
                }`}
              >
                {(matchDetails.duration || '90') === '80' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-700" />
                )}
              </span>
              <span>{t.match.duration80}</span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={(matchDetails.duration || '90') === '90'}
              onClick={() => onDetailsChange('duration', '90')}
              className={`py-3 px-4 rounded-xl font-medium text-sm border transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
                (matchDetails.duration || '90') === '90'
                  ? 'bg-cyan-600/90 hover:bg-cyan-600 border-cyan-400 text-white shadow-lg shadow-cyan-900/30 ring-2 ring-cyan-500/40 font-semibold'
                  : 'bg-gray-750/90 border-gray-600/80 hover:bg-gray-700 hover:border-gray-500 text-gray-300'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                  (matchDetails.duration || '90') === '90'
                    ? 'border-white bg-white'
                    : 'border-gray-400'
                }`}
              >
                {(matchDetails.duration || '90') === '90' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-700" />
                )}
              </span>
              <span>{t.match.duration90}</span>
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">{t.match.durationHelp}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            {t.match.starter}
          </label>
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={t.match.starter}>
            <button
              type="button"
              role="radio"
              aria-checked={(matchDetails.starter || 'yes') === 'yes'}
              onClick={() => onDetailsChange('starter', 'yes')}
              className={`py-3 px-4 rounded-xl font-medium text-sm border transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
                (matchDetails.starter || 'yes') === 'yes'
                  ? 'bg-cyan-600/90 hover:bg-cyan-600 border-cyan-400 text-white shadow-lg shadow-cyan-900/30 ring-2 ring-cyan-500/40 font-semibold'
                  : 'bg-gray-750/90 border-gray-600/80 hover:bg-gray-700 hover:border-gray-500 text-gray-300'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                  (matchDetails.starter || 'yes') === 'yes'
                    ? 'border-white bg-white'
                    : 'border-gray-400'
                }`}
              >
                {(matchDetails.starter || 'yes') === 'yes' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-700" />
                )}
              </span>
              <span>{t.match.starterYes}</span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={(matchDetails.starter || 'yes') === 'no'}
              onClick={() => onDetailsChange('starter', 'no')}
              className={`py-3 px-4 rounded-xl font-medium text-sm border transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
                (matchDetails.starter || 'yes') === 'no'
                  ? 'bg-cyan-600/90 hover:bg-cyan-600 border-cyan-400 text-white shadow-lg shadow-cyan-900/30 ring-2 ring-cyan-500/40 font-semibold'
                  : 'bg-gray-750/90 border-gray-600/80 hover:bg-gray-700 hover:border-gray-500 text-gray-300'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                  (matchDetails.starter || 'yes') === 'no'
                    ? 'border-white bg-white'
                    : 'border-gray-400'
                }`}
              >
                {(matchDetails.starter || 'yes') === 'no' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-700" />
                )}
              </span>
              <span>{t.match.starterNo}</span>
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">{t.match.starterHelp}</p>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-300 mb-1">{t.match.notes}</label>
          <textarea
            id="notes"
            name="notes"
            placeholder={t.match.placeholderNotes}
            value={matchDetails.notes}
            onChange={handleInputChange}
            rows={4}
            className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
          />
        </div>

        {/* Pulsante Salva e Sezione di Sincronizzazione sotto la voce Note */}
        <div id="match-save-section" className="pt-4 border-t border-gray-700 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <button
              type="button"
              id="match-save-button"
              onClick={onSave}
              disabled={isSaveDisabled}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-950/70 hover:bg-emerald-900/80 active:bg-emerald-900 border border-emerald-700/70 text-emerald-300 hover:text-emerald-200 rounded-xl font-bold text-sm shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title={
                !selectedPlayer
                  ? t.match.noPlayerWarning
                  : !matchDetails.date
                  ? t.match.noDateWarning
                  : t.match.saveHelp
              }
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-emerald-400" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>{t.match.savingBtn}</span>
                </>
              ) : (
                <>
                  <GoogleSheetsIcon className="w-5 h-5 flex-shrink-0" />
                  <span>{t.match.saveBtn}</span>
                </>
              )}
            </button>

            {/* Riepilogo di stato: Portiere e Eventi Tracciamento */}
            <div className="flex flex-col sm:items-end text-xs text-gray-400">
              {selectedPlayer ? (
                <div className="flex items-center gap-1.5 font-medium text-gray-200">
                  <span>{isItalian ? 'Portiere:' : 'Goalkeeper:'}</span>
                  <strong className="text-white font-semibold">{selectedPlayer.name}</strong>
                  {selectedPlayer.team && (
                    <span className="text-gray-400">({selectedPlayer.team})</span>
                  )}
                </div>
              ) : (
                <span className="text-amber-400 font-medium">{t.match.noPlayerWarning}</span>
              )}
              <div className="mt-0.5 text-cyan-400 font-medium">
                {eventsCount} {isItalian ? (eventsCount === 1 ? 'evento registrato nel tracciamento' : 'eventi registrati nel tracciamento') : (eventsCount === 1 ? 'event in graphic tracking' : 'events in graphic tracking')}
              </div>
            </div>
          </div>

          {/* Dettaglio operativo salvataggio e reset tracciamento */}
          <div className="p-3 bg-gray-750/70 border border-gray-700/80 rounded-lg text-xs text-gray-300 flex items-start gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mt-1 flex-shrink-0" />
            <p className="leading-relaxed">
              {t.match.saveHelp}
            </p>
          </div>

          {/* Banner di Errore Salva */}
          {saveError && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-xs text-red-200">
              <p className="font-semibold">{isItalian ? 'Errore durante il salvataggio:' : 'Error saving match:'}</p>
              <p className="mt-0.5 text-red-300">{saveError}</p>
            </div>
          )}

          {/* Banner di Successo Salva con link al file Google Sheet */}
          {saveSuccessBanner && (
            <div className="p-3.5 bg-emerald-950/40 border border-emerald-600/70 rounded-xl text-xs text-emerald-200 flex items-start justify-between gap-3 animate-fade-in">
              <div className="flex items-start gap-2.5">
                <CheckIcon className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-emerald-100">{saveSuccessBanner.message}</p>
                  {saveSuccessBanner.sheetUrl && (
                    <a
                      href={saveSuccessBanner.sheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2 mt-1"
                    >
                      <span>{isItalian ? 'Apri file Google Sheet di riferimento' : 'Open reference Google Sheet'}</span>
                      <ExternalLinkIcon className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
              {onDismissSuccessBanner && (
                <button
                  type="button"
                  onClick={onDismissSuccessBanner}
                  className="text-emerald-400 hover:text-white p-1 rounded transition-colors flex-shrink-0"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchView;
