import React from 'react';
import { MatchDetails, Player, SoccerEvent, Language } from '../types';
import { GoogleSheetsIcon, GoogleDriveIcon, CheckIcon, XMarkIcon } from './icons';

interface GoogleSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  player: Player | null;
  matchDetails: MatchDetails;
  events: SoccerEvent[];
  isSaving: boolean;
  language: Language;
}

export const GoogleSyncModal: React.FC<GoogleSyncModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  player,
  matchDetails,
  events,
  isSaving,
  language,
}) => {
  if (!isOpen) return null;

  const isItalian = language === 'it';
  const isSpanish = language === 'es';

  const title = isItalian
    ? 'Conferma Salvataggio su Google Sheets'
    : isSpanish
    ? 'Confirmar Guardado en Google Sheets'
    : 'Confirm Save to Google Sheets';

  const subtitle = isItalian
    ? 'Stai per aggiungere una nuova sessione/partita al foglio di calcolo Google Drive del portiere.'
    : isSpanish
    ? 'Vas a agregar una nueva sesión/partido a la hoja de cálculo Google Drive del portero.'
    : 'You are about to append a new match/session to the goalkeeper\'s Google Drive spreadsheet.';

  const confirmBtnText = isItalian
    ? 'Conferma e Salva'
    : isSpanish
    ? 'Confirmar y Guardar'
    : 'Confirm & Save';

  const cancelBtnText = isItalian ? 'Annulla' : isSpanish ? 'Cancelar' : 'Cancel';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-gray-750 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/15 text-emerald-400 rounded-lg border border-emerald-500/30">
              <GoogleSheetsIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{title}</h3>
              <p className="text-xs text-gray-400">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors disabled:opacity-50"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          <div className="bg-gray-900/70 p-4 rounded-xl border border-gray-700 space-y-2.5 text-sm">
            <div className="flex justify-between items-center py-1 border-b border-gray-800">
              <span className="text-gray-400 font-medium">
                {isItalian ? 'Portiere' : isSpanish ? 'Portero' : 'Goalkeeper'}:
              </span>
              <span className="text-white font-semibold">
                {player?.name} {player?.team ? `(${player.team})` : ''}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-gray-800">
              <span className="text-gray-400 font-medium">
                {isItalian ? 'Data Partita' : isSpanish ? 'Fecha Partido' : 'Match Date'}:
              </span>
              <span className="text-cyan-400 font-semibold">{matchDetails.date || '-'}</span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-gray-800">
              <span className="text-gray-400 font-medium">
                {isItalian ? 'Partita / Competizione' : isSpanish ? 'Partido / Competición' : 'Match / Competition'}:
              </span>
              <span className="text-white font-medium">
                {matchDetails.matchName || (isItalian ? 'Amichevole / Allenamento' : 'Session')}
                {matchDetails.competition ? ` • ${matchDetails.competition}` : ''}
              </span>
            </div>

            {matchDetails.duration && (
              <div className="flex justify-between items-center py-1 border-b border-gray-800">
                <span className="text-gray-400 font-medium">
                  {isItalian ? 'Durata Partita' : isSpanish ? 'Duración Partido' : 'Match Duration'}:
                </span>
                <span className="text-white font-medium">
                  {matchDetails.duration} {isItalian ? 'minuti' : isSpanish ? 'minutos' : 'minutes'}
                </span>
              </div>
            )}

            {matchDetails.starter && (
              <div className="flex justify-between items-center py-1 border-b border-gray-800">
                <span className="text-gray-400 font-medium">
                  {isItalian ? 'Titolare' : isSpanish ? 'Titular' : 'Starter'}:
                </span>
                <span className="text-white font-medium">
                  {matchDetails.starter === 'yes'
                    ? (isItalian ? 'Sì' : isSpanish ? 'Sí' : 'Yes')
                    : (isItalian ? 'No' : isSpanish ? 'No' : 'No')}
                </span>
              </div>
            )}

            {(matchDetails.subIn || matchDetails.subOut) && (
              <div className="flex justify-between items-center py-1 border-b border-gray-800">
                <span className="text-gray-400 font-medium">
                  {isItalian ? 'Sostituzione' : isSpanish ? 'Sustitución' : 'Substitution'}:
                </span>
                <span className="text-white font-medium">
                  {matchDetails.subIn && `${isItalian ? 'Entrata' : isSpanish ? 'Entrada' : 'In'}: ${matchDetails.subInMinute || '?'}'`}
                  {matchDetails.subIn && matchDetails.subOut && ' • '}
                  {matchDetails.subOut && `${isItalian ? 'Uscita' : isSpanish ? 'Salida' : 'Out'}: ${matchDetails.subOutMinute || '?'}'`}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center py-1">
              <span className="text-gray-400 font-medium">
                {isItalian ? 'Eventi da aggiungere' : isSpanish ? 'Eventos a guardar' : 'Events to append'}:
              </span>
              <span className="text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60">
                {events.length} {events.length === 1 ? 'evento' : 'eventi'}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-cyan-950/30 border border-cyan-800/40 text-xs text-cyan-200">
            <GoogleDriveIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>
                {isItalian
                  ? `Verranno aggiunte ${Math.max(events.length, 1)} righe in coda al foglio Google del portiere. I dati storici rimarranno al sicuro sul tuo Google Drive.`
                  : isSpanish
                  ? `Se añadirán ${Math.max(events.length, 1)} filas al final de la hoja Google del portero.`
                  : `${Math.max(events.length, 1)} rows will be appended to the goalkeeper's Google Sheet.`}
              </p>
              <p className="text-[11px] text-cyan-300/80">
                {isItalian
                  ? `Include coordinate dello Specchio della Porta, coordinate di Metà Campo, Distanza, xG e xGOT.`
                  : isSpanish
                  ? `Incluye coordenadas de la Portería, coordenadas de Medio Campo, Distancia, xG y xGOT.`
                  : `Includes Goal Frame coordinates, Half-Pitch coordinates, Distance, xG and xGOT.`}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-900/60 border-t border-gray-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {cancelBtnText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-emerald-300 hover:text-emerald-200 bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-700/70 rounded-lg transition-colors shadow-lg shadow-emerald-950/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-4 w-4 text-emerald-400" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>{isItalian ? 'Salvataggio in corso...' : 'Saving...'}</span>
              </>
            ) : (
              <>
                <CheckIcon className="w-4 h-4 text-emerald-400" />
                <span>{confirmBtnText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
