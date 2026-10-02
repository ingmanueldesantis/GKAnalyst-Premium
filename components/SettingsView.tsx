import React, { useState, useEffect, useMemo } from 'react';
import { Player, Language, GoogleDriveConfig } from '../types';
import {
  CogIcon,
  CheckIcon,
  GoogleDriveIcon,
  GoogleSheetsIcon,
  ArrowPathIcon,
  FolderIcon,
} from './icons';
import { translations } from '../utils/translations';

interface SettingsViewProps {
  language: Language;
  players?: Player[];
  selectedPlayerId?: string | null;
  onSelectPlayer?: (id: string) => void;
  onAddPlayer?: (name: string, team: string) => Promise<void> | void;
  onUpdatePlayer?: (id: string, name: string, team: string) => void;
  onDeletePlayer?: (id: string) => void;
  onNavigateToGoalkeepers?: () => void;

  // Google Drive & Sheets Integration Props
  driveConfig: GoogleDriveConfig;
  onSaveDriveConfig: (folderInput: string, email: string) => Promise<void>;
  onScanDriveFolder?: () => Promise<void>;
  isScanningDrive?: boolean;
  isSavingSettings?: boolean;
  isCreatingSheet?: boolean;
  driveScanMessage?: string | null;
  driveScanError?: string | null;
  userEmail?: string | null;
  isConnectedGoogle?: boolean;
  onDisconnectGoogle?: () => Promise<void>;
  onLoadPlayerHistory?: (playerId: string) => Promise<void>;
  isLoadingHistory?: boolean;
}

const SettingsView: React.FC<SettingsViewProps> = ({
  language,
  driveConfig,
  onSaveDriveConfig,
  onScanDriveFolder,
  isScanningDrive = false,
  isSavingSettings = false,
  driveScanMessage = null,
  driveScanError = null,
  userEmail = null,
  isConnectedGoogle = false,
  onDisconnectGoogle,
}) => {
  const t = useMemo(() => translations[language] || translations.en, [language]);
  const isItalian = language === 'it';
  const isSpanish = language === 'es';

  // Drive configuration local form state
  const [folderInput, setFolderInput] = useState(driveConfig.folderInput || '');
  const [emailInput, setEmailInput] = useState(driveConfig.email || '');

  useEffect(() => {
    setFolderInput(driveConfig.folderInput || '');
    setEmailInput(driveConfig.email || '');
  }, [driveConfig.folderInput, driveConfig.email]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveDriveConfig(folderInput.trim(), emailInput.trim());
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4 sm:space-y-6 pb-8">
      {/* 1. Page Title Header - Mobile optimized with responsive stacking */}
      <div className="bg-gray-800 p-4 sm:p-5 rounded-2xl shadow-lg border border-gray-700/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 bg-cyan-500/15 rounded-xl text-cyan-400 border border-cyan-500/30 flex-shrink-0">
            <CogIcon className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">{t.settings.title}</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{t.settings.subtitle}</p>
          </div>
        </div>

        {/* Cloud sync status badge */}
        <div className="flex items-center self-start sm:self-center">
          {isConnectedGoogle ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/70 border border-emerald-600/60 text-emerald-300 text-xs font-semibold shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              <span>{isItalian ? 'Google Connesso' : isSpanish ? 'Google Conectado' : 'Google Connected'}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-950/50 border border-amber-600/50 text-amber-300 text-xs font-semibold shadow-sm">
              <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
              <span>{isItalian ? 'Drive non connesso' : isSpanish ? 'Drive desconectado' : 'Drive disconnected'}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. SECTION: Google Drive & Google Sheets Configuration */}
      <div className="bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-700/90 space-y-5">
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-700/80">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 sm:p-2.5 bg-green-500/15 rounded-xl border border-green-500/30 flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0">
              <GoogleDriveIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {t.settings.googleDrive?.title || 'Google Drive & Google Sheets'}
                </h3>
                <span className="p-1 bg-emerald-500/10 rounded border border-emerald-500/20">
                  <GoogleSheetsIcon className="w-3.5 h-3.5 text-emerald-400" />
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                {t.settings.googleDrive?.subtitle ||
                  'Collega la tua cartella Drive per sincronizzare i portieri e salvare le partite direttamente su fogli Google Sheets.'}
              </p>
            </div>
          </div>

          {/* Quick scan button if connected (responsive full width on mobile) */}
          {isConnectedGoogle && (
            <button
              type="button"
              id="scan-drive-folder-btn"
              onClick={onScanDriveFolder}
              disabled={isScanningDrive || !folderInput.trim()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2.5 sm:py-2 text-xs font-semibold rounded-xl bg-gray-700/90 hover:bg-gray-700 text-cyan-300 border border-gray-600 transition-colors disabled:opacity-50 shadow-sm active:scale-[0.99]"
              title={t.settings.googleDrive?.scanNowBtn || 'Scansiona Cartella'}
            >
              <ArrowPathIcon className={`w-4 h-4 ${isScanningDrive ? 'animate-spin text-cyan-400' : ''}`} />
              <span>
                {isScanningDrive
                  ? t.settings.googleDrive?.scanning || 'Scansione in corso...'
                  : t.settings.googleDrive?.scanNowBtn || 'Scansiona Cartella'}
              </span>
            </button>
          )}
        </div>

        {/* Form Inputs: Folder ID/Link + Email */}
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Folder ID / Link */}
            <div>
              <label
                htmlFor="drive-folder-input"
                className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
              >
                <FolderIcon className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="truncate">{t.settings.googleDrive?.folderLabel || 'Cartella Google Drive (Link o ID)'}</span>
                <span className="text-red-400">*</span>
              </label>
              <input
                id="drive-folder-input"
                type="text"
                value={folderInput}
                onChange={(e) => setFolderInput(e.target.value)}
                placeholder={
                  t.settings.googleDrive?.folderPlaceholder ||
                  'https://drive.google.com/drive/folders/... oppure ID'
                }
                className="w-full bg-gray-900/90 text-white rounded-xl px-3.5 py-2.5 sm:py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-700 shadow-inner transition-colors"
                required
              />
              <p className="text-[11px] text-gray-400 mt-1.5 leading-snug">
                {t.settings.googleDrive?.folderHelp ||
                  'Incolla il link della cartella Drive o il suo ID alfanumerico.'}
              </p>
            </div>

            {/* Google Email */}
            <div>
              <label
                htmlFor="google-email-input"
                className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
              >
                <GoogleDriveIcon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <span className="truncate">{t.settings.googleDrive?.emailLabel || 'Indirizzo Email Google'}</span>
                <span className="text-red-400">*</span>
              </label>
              <input
                id="google-email-input"
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder={t.settings.googleDrive?.emailPlaceholder || 'es. nome@gmail.com'}
                className="w-full bg-gray-900/90 text-white rounded-xl px-3.5 py-2.5 sm:py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-700 shadow-inner transition-colors"
                required
              />
              <p className="text-[11px] text-gray-400 mt-1.5 leading-snug">
                {t.settings.googleDrive?.emailHelp ||
                  "L'email dell'account Google autorizzato ad accedere alla cartella."}
              </p>
            </div>
          </div>

          {/* Messages / Alerts */}
          {driveScanError && (
            <div className="p-3.5 bg-red-950/60 border border-red-700/70 rounded-xl text-red-200 text-xs flex items-start gap-2.5 animate-fade-in shadow-inner">
              <span className="text-base leading-none">⚠️</span>
              <div className="flex-grow">
                <span className="font-bold">{isItalian ? 'Attenzione: ' : 'Notice: '}</span>
                <span>{driveScanError}</span>
              </div>
            </div>
          )}

          {driveScanMessage && (
            <div className="p-3.5 bg-emerald-950/50 border border-emerald-700/60 rounded-xl text-emerald-200 text-xs flex items-start gap-2.5 animate-fade-in shadow-inner">
              <CheckIcon className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="flex-grow">
                <span className="font-bold">{isItalian ? 'Sincronizzazione completata: ' : 'Sync: '}</span>
                <span>{driveScanMessage}</span>
              </div>
            </div>
          )}

          {/* User Account info & Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Account Info Pill */}
            <div className="text-xs text-gray-300 flex items-center gap-2">
              {userEmail ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900/60 border border-gray-700/80 text-gray-300 w-full sm:w-auto">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                  <span className="text-gray-400">{isItalian ? 'Account:' : 'Account:'}</span>
                  <span className="font-medium text-white truncate max-w-[200px]">{userEmail}</span>
                </div>
              ) : (
                <span className="text-gray-400 text-[11px]">
                  {isItalian
                    ? 'Premi "Salva Impostazioni" per collegare Google Drive.'
                    : 'Click "Save Settings" to connect Google Drive.'}
                </span>
              )}
            </div>

            {/* Buttons Row: full-width on mobile */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
              {isConnectedGoogle && onDisconnectGoogle && (
                <button
                  type="button"
                  id="disconnect-google-btn"
                  onClick={onDisconnectGoogle}
                  className="w-full sm:w-auto px-4 py-2.5 bg-gray-700/80 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl text-xs font-semibold transition-colors border border-gray-600 text-center active:scale-[0.99]"
                >
                  {isItalian ? 'Disconnetti' : 'Disconnect'}
                </button>
              )}

              <button
                type="submit"
                id="save-settings-btn"
                disabled={isSavingSettings || isScanningDrive || !folderInput.trim()}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 sm:py-2.5 bg-emerald-950/70 hover:bg-emerald-900/80 active:bg-emerald-900 border border-emerald-700/70 text-emerald-300 hover:text-emerald-200 disabled:bg-gray-800/60 disabled:border-gray-700 disabled:text-gray-500 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-950/40 disabled:cursor-not-allowed active:scale-[0.99]"
              >
                {isSavingSettings || isScanningDrive ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-emerald-400" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>
                      {isScanningDrive
                        ? t.settings.googleDrive?.scanning || 'Scansione Drive...'
                        : isItalian
                        ? 'Autenticazione...'
                        : 'Authenticating...'}
                    </span>
                  </>
                ) : (
                  <>
                    <GoogleSheetsIcon className="w-4 h-4 text-emerald-300" />
                    <span>{t.settings.googleDrive?.saveSettingsBtn || 'Salva Impostazioni'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsView;
