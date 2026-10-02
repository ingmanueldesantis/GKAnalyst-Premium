import React, { useState, useEffect, useMemo } from 'react';
import { Player, Language, GoogleDriveConfig } from '../types';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  UserPlusIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  GoalkeeperGloveIcon,
  GoogleSheetsIcon,
  ArrowPathIcon,
  ExternalLinkIcon,
} from './icons';
import { translations } from '../utils/translations';

interface PlayerViewProps {
  language: Language;
  players: Player[];
  selectedPlayerId?: string | null;
  onSelectPlayer?: (id: string) => void;
  onAddPlayer?: (name: string, team: string) => Promise<void> | void;
  onUpdatePlayer?: (id: string, name: string, team: string) => void;
  onDeletePlayer?: (id: string) => void;
  onNavigateToGoalkeepers?: () => void;

  // Google Drive & Sheets Integration Props
  driveConfig?: GoogleDriveConfig;
  hasDriveConfig?: boolean;
  isConnectedGoogle?: boolean;
  isCreatingSheet?: boolean;
  onLoadPlayerHistory?: (playerId: string) => Promise<void>;
  isLoadingHistory?: boolean;
}

const PlayerView: React.FC<PlayerViewProps> = ({
  language,
  players,
  selectedPlayerId = null,
  onSelectPlayer,
  onAddPlayer,
  onUpdatePlayer,
  onDeletePlayer,
  onNavigateToGoalkeepers,
  driveConfig,
  hasDriveConfig = false,
  isConnectedGoogle = false,
  isCreatingSheet = false,
  onLoadPlayerHistory,
  isLoadingHistory = false,
}) => {
  const t = useMemo(() => translations[language] || translations.en, [language]);
  const isItalian = language === 'it';
  const isSpanish = language === 'es';

  // Section accordion state (expanded by default for immediate access)
  const [isGkExpanded, setIsGkExpanded] = useState(true);

  // Drive configuration local form state
  const [folderInput, setFolderInput] = useState(driveConfig?.folderInput || '');

  // Add new Goalkeeper local state
  const [newGkName, setNewGkName] = useState('');
  const [newGkTeam, setNewGkTeam] = useState('');

  // Edit goalkeeper state
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTeam, setEditTeam] = useState('');

  useEffect(() => {
    setFolderInput(driveConfig?.folderInput || '');
  }, [driveConfig?.folderInput]);

  const selectedPlayer = useMemo(() => {
    return players.find((p) => p.id === selectedPlayerId) || (players.length > 0 ? players[0] : null);
  }, [players, selectedPlayerId]);

  const handleAddGk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newGkName.trim() && onAddPlayer) {
      await onAddPlayer(newGkName.trim(), newGkTeam.trim());
      setNewGkName('');
      setNewGkTeam('');
    }
  };

  const handleStartEdit = (player: Player) => {
    setEditingPlayerId(player.id);
    setEditName(player.name);
    setEditTeam(player.team || '');
  };

  const handleCancelEdit = () => {
    setEditingPlayerId(null);
  };

  const handleSaveEdit = (id: string) => {
    if (editName.trim() && onUpdatePlayer) {
      onUpdatePlayer(id, editName.trim(), editTeam.trim());
      setEditingPlayerId(null);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4 sm:space-y-6 pb-8">
      {/* 3. SECTION: Goalkeepers Management & Selection */}
      <div className="bg-gray-800 rounded-2xl shadow-lg border border-gray-700/90 overflow-hidden">
        {/* Accordion Header */}
        <div
          id="setting-option-goalkeeper"
          onClick={() => setIsGkExpanded((prev) => !prev)}
          className="p-4 sm:p-5 flex items-center justify-between cursor-pointer select-none hover:bg-gray-750/70 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 bg-cyan-500/15 text-cyan-400 rounded-xl border border-cyan-500/30 flex-shrink-0">
              <GoalkeeperGloveIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-bold text-white truncate">
                  {isItalian ? 'Gestione Portieri' : t.players.title}
                </span>
                {players.length > 0 && (
                  <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-cyan-900/60 text-cyan-300 border border-cyan-700/50 font-medium flex-shrink-0">
                    {players.length}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {selectedPlayer
                  ? `${t.settings.activeLabel}: ${selectedPlayer.name}${selectedPlayer.team ? ` (${selectedPlayer.team})` : ''}`
                  : players.length > 0
                  ? t.settings.selectActiveGoalkeeper
                  : t.settings.noGoalkeepersRegistered}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-2">
            {onNavigateToGoalkeepers && (
              <button
                type="button"
                id="go-to-goalkeepers-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToGoalkeepers();
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-700 hover:bg-gray-600 text-cyan-400 hover:text-cyan-300 border border-gray-600 transition-colors"
              >
                <span>{t.settings.manageBtn}</span>
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="text-gray-400 p-1">
              <ChevronDownIcon
                className={`w-5 h-5 transition-transform duration-200 ${isGkExpanded ? 'rotate-180' : ''}`}
              />
            </div>
          </div>
        </div>

        {/* Accordion Content */}
        {isGkExpanded && (
          <div className="p-4 sm:p-5 border-t border-gray-700/70 bg-gray-800/40 space-y-5">
            {/* Dropdown Selector of Existing Goalkeepers (Drive / Local) */}
            {players.length > 0 && onSelectPlayer && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="select-goalkeeper-dropdown"
                    className="block text-xs font-bold text-gray-300 uppercase tracking-wider"
                  >
                    {isItalian
                      ? 'Portiere Attivo'
                      : isSpanish
                      ? 'Portero Activo'
                      : 'Active Goalkeeper'}
                  </label>
                  {isLoadingHistory && (
                    <span className="text-xs text-cyan-400 flex items-center gap-1.5 animate-pulse">
                      <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                      <span>{isItalian ? 'Caricamento storico...' : 'Loading history...'}</span>
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-grow">
                    <select
                      id="select-goalkeeper-dropdown"
                      value={selectedPlayerId || (players[0]?.id ?? '')}
                      onChange={(e) => {
                        const id = e.target.value;
                        onSelectPlayer(id);
                        if (onLoadPlayerHistory) {
                          onLoadPlayerHistory(id);
                        }
                      }}
                      className="w-full appearance-none bg-gray-900 border border-gray-700 text-white rounded-xl px-3.5 py-2.5 text-base sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-sm pr-10 cursor-pointer"
                    >
                      {players.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.team ? ` (${p.team})` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDownIcon className="w-5 h-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  {/* Actions Row on mobile / inline on desktop */}
                  <div className="flex items-center gap-2">
                    {/* Historical data reload button */}
                    {selectedPlayer && onLoadPlayerHistory && (
                      <button
                        type="button"
                        id="load-history-btn"
                        onClick={() => onLoadPlayerHistory(selectedPlayer.id)}
                        disabled={isLoadingHistory}
                        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-cyan-950/60 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap active:scale-[0.99]"
                        title={t.settings.googleDrive?.loadHistory || 'Carica storico partite'}
                      >
                        <ArrowPathIcon className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                        <span>{t.settings.googleDrive?.loadHistory || 'Ricarica Storico'}</span>
                      </button>
                    )}

                    {/* Open Sheet directly in Drive link if available */}
                    {selectedPlayer?.webViewLink && (
                      <a
                        href={selectedPlayer.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 rounded-xl text-xs font-semibold transition-colors active:scale-[0.99]"
                        title={t.settings.googleDrive?.openInDrive || 'Apri su Google Drive'}
                      >
                        <GoogleSheetsIcon className="w-4 h-4 text-emerald-400" />
                        <span className="hidden xs:inline sm:inline">Drive</span>
                        <ExternalLinkIcon className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Add New Goalkeeper Form */}
            <div className="bg-gray-900/60 p-3.5 sm:p-4 rounded-xl border border-gray-700/70 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider">
                  {t.settings.addGoalkeeper}
                </label>
                {folderInput.trim() && isConnectedGoogle && (
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                    <GoogleSheetsIcon className="w-3.5 h-3.5" />
                    <span>{isItalian ? 'Crea Sheet su Drive' : 'Creates Sheet in Drive'}</span>
                  </span>
                )}
              </div>

              <form onSubmit={handleAddGk} className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  id="setting-gk-name-input"
                  value={newGkName}
                  onChange={(e) => setNewGkName(e.target.value)}
                  placeholder={t.settings.goalkeeperNamePlaceholder}
                  disabled={isCreatingSheet}
                  className="w-full sm:flex-grow bg-gray-800 text-white rounded-xl px-3.5 py-2.5 sm:py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-600 disabled:opacity-50"
                  required
                />
                <input
                  type="text"
                  id="setting-gk-team-input"
                  value={newGkTeam}
                  onChange={(e) => setNewGkTeam(e.target.value)}
                  placeholder={t.settings.teamOptionalPlaceholder}
                  disabled={isCreatingSheet}
                  className="w-full sm:w-1/3 bg-gray-800 text-white rounded-xl px-3.5 py-2.5 sm:py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-600 disabled:opacity-50"
                />
                <button
                  type="submit"
                  id="setting-add-gk-btn"
                  disabled={!newGkName.trim() || isCreatingSheet}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl font-bold text-sm transition-colors disabled:cursor-not-allowed whitespace-nowrap shadow-sm active:scale-[0.99]"
                >
                  {isCreatingSheet ? (
                    <>
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      <span>{isItalian ? 'Creazione...' : 'Creating...'}</span>
                    </>
                  ) : (
                    <>
                      <UserPlusIcon className="w-4 h-4" />
                      <span>{t.settings.addBtn}</span>
                    </>
                  )}
                </button>
              </form>
              <p className="text-[11px] text-gray-400 leading-snug">
                {folderInput.trim() && isConnectedGoogle
                  ? t.settings.googleDrive?.createNewSheet ||
                    'Verrà creato automaticamente un nuovo file Google Sheet nella cartella Drive per questo portiere con tutte le intestazioni.'
                  : t.settings.googleDrive?.syncWarning ||
                    'Configura Google Drive sopra per salvare e sincronizzare automaticamente i fogli.'}
              </p>
            </div>

            {/* Registered Goalkeepers List - Fully mobile responsive */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider">
                  {t.settings.registeredGoalkeepers} ({players.length})
                </label>
                {onNavigateToGoalkeepers && (
                  <button
                    type="button"
                    onClick={onNavigateToGoalkeepers}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold sm:hidden"
                  >
                    {t.settings.manageBtn} →
                  </button>
                )}
              </div>

              {players.length === 0 ? (
                <div className="text-center py-6 text-sm text-gray-400 bg-gray-900/40 rounded-xl border border-dashed border-gray-700 px-4">
                  {t.settings.noGoalkeepersHelp}
                </div>
              ) : (
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {players.map((player) => {
                    const isEditing = editingPlayerId === player.id;
                    const isSelected = (selectedPlayerId ?? players[0]?.id) === player.id;
                    return (
                      <div
                        key={player.id}
                        className={`p-3 sm:p-3.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-gray-750 border-cyan-500/70 shadow-sm ring-1 ring-cyan-500/40'
                            : 'bg-gray-750/70 border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        {isEditing ? (
                          <div className="space-y-2.5">
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 border border-gray-600"
                                autoFocus
                              />
                              <input
                                type="text"
                                value={editTeam}
                                onChange={(e) => setEditTeam(e.target.value)}
                                placeholder={t.settings.teamPlaceholder}
                                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 border border-gray-600"
                              />
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(player.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-700/70 text-emerald-300 hover:text-emerald-200 rounded-lg text-xs font-semibold transition-colors"
                              >
                                <CheckIcon className="w-4 h-4 text-emerald-400" />
                                <span>{t.settings.saveBtn}</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-semibold"
                              >
                                <XMarkIcon className="w-4 h-4" />
                                <span>{t.settings.cancelBtn}</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            {/* Goalkeeper Details (Tappable to select) */}
                            <div
                              className="flex-grow min-w-0 cursor-pointer select-none"
                              onClick={() => {
                                if (onSelectPlayer) {
                                  onSelectPlayer(player.id);
                                  if (onLoadPlayerHistory) onLoadPlayerHistory(player.id);
                                }
                              }}
                            >
                              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                <span className="font-bold text-white text-sm sm:text-base leading-snug">
                                  {player.name}
                                </span>
                                {isSelected && (
                                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-cyan-900/80 text-cyan-300 border border-cyan-700/60">
                                    {t.settings.activeLabel}
                                  </span>
                                )}
                                {player.spreadsheetId && (
                                  <span className="text-[10px] flex items-center gap-1 font-medium px-1.5 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800/60">
                                    <GoogleSheetsIcon className="w-3 h-3 text-emerald-400" />
                                    <span>Google Sheet</span>
                                  </span>
                                )}
                              </div>
                              {player.team && (
                                <p className="text-xs text-gray-400 mt-0.5 truncate">{player.team}</p>
                              )}
                            </div>

                            {/* Action Buttons with comfortable touch targets */}
                            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                              {player.webViewLink && (
                                <a
                                  href={player.webViewLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-gray-400 hover:text-emerald-400 p-2 sm:p-1.5 rounded-lg hover:bg-gray-700/60 transition-colors"
                                  title={t.settings.googleDrive?.openInDrive || 'Apri su Google Drive'}
                                >
                                  <ExternalLinkIcon className="w-4 h-4 text-emerald-400" />
                                </a>
                              )}
                              {onUpdatePlayer && (
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(player)}
                                  className="text-yellow-400 hover:text-yellow-300 p-2 sm:p-1.5 rounded-lg hover:bg-gray-700/60 transition-colors"
                                  title="Modifica"
                                >
                                  <PencilIcon className="w-4 h-4" />
                                </button>
                              )}
                              {onDeletePlayer && (
                                <button
                                  type="button"
                                  onClick={() => onDeletePlayer(player.id)}
                                  className="text-red-400 hover:text-red-300 p-2 sm:p-1.5 rounded-lg hover:bg-gray-700/60 transition-colors"
                                  title="Elimina"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerView;
