import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  SoccerEvent,
  Player,
  TrackingMode,
  MatchDetails,
  EventType,
  EventOutcome,
  Language,
  GoogleDriveConfig,
} from './types';
import SoccerGoal from './components/SoccerGoal';
import CornerGoal from './components/CornerGoal';
import EventList from './components/EventList';
import EventModal from './components/EventModal';
import StatsView from './components/StatsView';
import PlayerView from './components/PlayerView';
import MatchView from './components/MatchView';
import DistributionView from './components/DistributionView';
import InfoView from './components/InfoView';
import SettingsView from './components/SettingsView';
import HalfPitchXGOT from './components/HalfPitchXGOT';
import { GoogleSyncModal } from './components/GoogleSyncModal';
import { SubstitutionControl } from './components/SubstitutionControl';
import { LoginScreen } from './components/LoginScreen';
import {
  getOrCreateDeviceId,
  getSavedAuthSession,
  saveAuthSession,
  clearAuthSession,
  verifyCredentials,
  SavedAuthSession,
} from './services/authService';
import {
  GoalkeeperGloveIcon,
  ChevronDownIcon,
  GoogleDriveIcon,
  GoogleSheetsIcon,
  CloudArrowUpIcon,
  ArrowPathIcon,
  ExternalLinkIcon,
  CheckIcon,
  XMarkIcon,
  DownloadIcon,
  SpreadsheetIcon,
  UserIcon,
  ArrowRightOnRectangleIcon,
} from './components/icons';
import { exportToCsv, exportStatsToXlsx } from './utils/export';
import { translations } from './utils/translations';
import {
  extractFolderId,
  saveDatabaseToDrive,
  loadDatabaseFromDrive,
  checkDriveFolder,
} from './services/driveSyncService';
import { parsePlayerFromFileName } from './services/googleDriveService';

const STORAGE_KEY_DRIVE = 'gkanaytics_drive_config';
const STORAGE_KEY_PLAYERS = 'gkanaytics_players';
const STORAGE_KEY_MATCH = 'gkanaytics_match_details';

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>('it');
  const t = useMemo(() => translations[language] || translations.en, [language]);
  const isItalian = language === 'it';

  // 2. GENERAZIONE DEVICE ID UNIVOCO (Anti-condivisione account)
  useEffect(() => {
    getOrCreateDeviceId();
  }, []);

  // 4. GESTIONE SESSIONE E CONTROLLO AUTOMATICO ALL'AVVIO
  const [currentUser, setCurrentUser] = useState<{ username: string; scadenza: string } | null>(null);
  const [isVerifyingSession, setIsVerifyingSession] = useState<boolean>(() => {
    return Boolean(getSavedAuthSession());
  });
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);

  // A ogni riapertura o ricaricamento dell'app, se sono presenti credenziali salvate,
  // mostra una schermata di caricamento ed esegui subito la chiamata fetch allo script
  useEffect(() => {
    const saved = getSavedAuthSession();
    if (!saved) {
      setIsVerifyingSession(false);
      return;
    }

    let isMounted = true;

    const performStartupVerification = async () => {
      try {
        const result = await verifyCredentials(saved.username, saved.password);
        if (!isMounted) return;

        if (result.success && result.status === 'ATTIVO') {
          const scadenza = result.scadenza || saved.scadenza || '';
          saveAuthSession(saved.username, saved.password, scadenza);
          setCurrentUser({
            username: saved.username,
            scadenza: scadenza || (isItalian ? 'Illimitata' : 'Unlimited'),
          });
          setAuthErrorMessage(null);
        } else {
          // Se lo script risponde con success: false, cancella credenziali (mantenendo app_device_id)
          clearAuthSession();
          setCurrentUser(null);
          setAuthErrorMessage(
            result.message ||
              (isItalian
                ? 'Accesso revocato o scaduto. Effettua nuovamente il login.'
                : 'Access revoked or expired. Please sign in again.')
          );
        }
      } catch (err) {
        if (!isMounted) return;
        clearAuthSession();
        setCurrentUser(null);
        setAuthErrorMessage(
          isItalian
            ? 'Impossibile verificare l\'accesso con il server di autenticazione.'
            : 'Could not verify access with authentication server.'
        );
      } finally {
        if (isMounted) {
          setIsVerifyingSession(false);
        }
      }
    };

    performStartupVerification();

    return () => {
      isMounted = false;
    };
  }, [isItalian]);

  const handleLogout = useCallback(() => {
    clearAuthSession(); // Cancella auth_username, auth_password, auth_scadenza. Non cancella MAI app_device_id!
    setCurrentUser(null);
    setAuthErrorMessage(null);
  }, []);

  // Core domain states
  const [events, setEvents] = useState<SoccerEvent[]>([]);
  const [players, setPlayers] = useState<Player[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PLAYERS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [matchDetails, setMatchDetails] = useState<MatchDetails>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MATCH);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          date: parsed.date || new Date().toISOString().split('T')[0],
          matchName: parsed.matchName || '',
          competition: parsed.competition || '',
          duration: parsed.duration || '90',
          starter: parsed.starter || 'yes',
          subIn: parsed.subIn || false,
          subInMinute: parsed.subInMinute || '',
          subOut: parsed.subOut || false,
          subOutMinute: parsed.subOutMinute || '',
          notes: parsed.notes || '',
        };
      }
      return {
        date: new Date().toISOString().split('T')[0],
        matchName: '',
        competition: '',
        duration: '90',
        starter: 'yes',
        subIn: false,
        subInMinute: '',
        subOut: false,
        subOutMinute: '',
        notes: '',
      };
    } catch {
      return {
        date: new Date().toISOString().split('T')[0],
        matchName: '',
        competition: '',
        duration: '90',
        starter: 'yes',
        subIn: false,
        subInMinute: '',
        subOut: false,
        subOutMinute: '',
        notes: '',
      };
    }
  });

  const [view, setView] = useState<'settings' | 'match' | 'players' | 'tracking' | 'stats' | 'info'>('settings');
  const [trackingMode, setTrackingMode] = useState<TrackingMode | null>('Saves');
  const [selectedSide, setSelectedSide] = useState<'left' | 'right' | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clickCoords, setClickCoords] = useState<{ x: number; y: number } | null>(null);

  // Google Drive & Sheets Integration state
  const [driveConfig, setDriveConfig] = useState<GoogleDriveConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DRIVE);
      return saved ? JSON.parse(saved) : { folderInput: '', folderId: '', email: '', connected: false };
    } catch {
      return { folderInput: '', folderId: '', email: '', connected: false };
    }
  });

  const [userEmail, setUserEmail] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DRIVE);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.email || null;
      }
    } catch {}
    return null;
  });
  const [isConnectedGoogle, setIsConnectedGoogle] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DRIVE);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Boolean(parsed.connected && parsed.folderId);
      }
    } catch {}
    return false;
  });
  const [isScanningDrive, setIsScanningDrive] = useState<boolean>(false);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [isCreatingSheet, setIsCreatingSheet] = useState<boolean>(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [isSavingMatchToSheets, setIsSavingMatchToSheets] = useState<boolean>(false);
  const [driveScanMessage, setDriveScanMessage] = useState<string | null>(null);
  const [driveScanError, setDriveScanError] = useState<string | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [saveSuccessBanner, setSaveSuccessBanner] = useState<{ message: string; sheetUrl?: string } | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExportXlsxMenuOpen, setIsExportXlsxMenuOpen] = useState(false);
  const [statsSelectedMatchKey, setStatsSelectedMatchKey] = useState<string>('ALL');
  const [selectedTrackingEventId, setSelectedTrackingEventId] = useState<string | null>(null);

  // Reset match selection when switching goalkeeper
  useEffect(() => {
    setStatsSelectedMatchKey('ALL');
  }, [selectedPlayerId]);

  // Persist players and match details
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify(players));
    } catch (e) {
      console.error(e);
    }
  }, [players]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MATCH, JSON.stringify(matchDetails));
    } catch (e) {
      console.error(e);
    }
  }, [matchDetails]);

  // Update selected player if list changes
  useEffect(() => {
    if (players.length > 0 && !selectedPlayerId) {
      setSelectedPlayerId(players[0].id);
    }
    if (players.length === 0) {
      setSelectedPlayerId(null);
    }
  }, [players, selectedPlayerId]);

  useEffect(() => {
    setSelectedSide(null);
  }, [trackingMode]);

  useEffect(() => {
    document.title = `GKAnalytics - ${t.appSubtitle}`;
    document.documentElement.lang = language;
  }, [language, t.appSubtitle]);

  // Scan Google Drive folder via Google Apps Script (NO POPUP!)
  const performDriveScan = useCallback(
    async (folderId: string, email?: string) => {
      setIsScanningDrive(true);
      setDriveScanError(null);
      setDriveScanMessage(null);

      try {
        const loadResult = await loadDatabaseFromDrive(folderId, email);

        if (!loadResult.success) {
          throw new Error(loadResult.message || 'Errore durante la connessione alla cartella Google Drive.');
        }

        if (!loadResult.data) {
          setDriveScanMessage(
            isItalian
              ? `Cartella Google Drive accessibile (${loadResult.folderName || folderId}). Nessun database precedente trovato: verrà creato al primo salvataggio.`
              : `Google Drive folder verified (${loadResult.folderName || folderId}). Database will be created on first save.`
          );
          return;
        }

        const driveData = loadResult.data;

        // Restore or merge players
        if (driveData.players && Array.isArray(driveData.players) && driveData.players.length > 0) {
          setPlayers((prevPlayers) => {
            const merged = [...prevPlayers];
            for (const dp of driveData.players) {
              const existingIdx = merged.findIndex(
                (p) => p.id === dp.id || p.name.toLowerCase() === dp.name.toLowerCase()
              );
              if (existingIdx >= 0) {
                merged[existingIdx] = { ...merged[existingIdx], ...dp };
              } else {
                merged.push(dp);
              }
            }
            return merged;
          });

          if (!selectedPlayerId && driveData.players.length > 0) {
            setSelectedPlayerId(driveData.players[0].id);
          }
        }

        // Restore or merge events
        if (driveData.events && Array.isArray(driveData.events) && driveData.events.length > 0) {
          setEvents((prevEvents) => {
            const map = new Map<string, SoccerEvent>();
            prevEvents.forEach((e) => map.set(e.id, e));
            driveData.events.forEach((e) => map.set(e.id, e));
            return Array.from(map.values());
          });
        }

        // Restore matchDetails if available
        if (driveData.matchDetails && driveData.matchDetails.date) {
          setMatchDetails((prev) => ({
            ...prev,
            ...driveData.matchDetails,
          }));
        }

        const countPlayers = driveData.players ? driveData.players.length : 0;
        const countEvents = driveData.events ? driveData.events.length : 0;

        setDriveScanMessage(
          isItalian
            ? `Sincronizzazione completata: caricati ${countPlayers} portieri e ${countEvents} eventi dalla cartella Google Drive!`
            : `Sync completed: loaded ${countPlayers} goalkeepers and ${countEvents} events from Google Drive!`
        );
      } catch (err: any) {
        console.error('Drive scan error:', err);
        setDriveScanError(err.message || 'Errore durante la scansione della cartella Google Drive.');
      } finally {
        setIsScanningDrive(false);
      }
    },
    [isItalian, selectedPlayerId]
  );

  // Save Settings & Connect Drive via Google Apps Script (NO POPUP!)
  const handleSaveDriveConfig = async (folderInput: string, email: string) => {
    setIsSavingSettings(true);
    setDriveScanError(null);
    setDriveScanMessage(null);

    const folderId = extractFolderId(folderInput);
    if (!folderId) {
      setDriveScanError(
        isItalian
          ? 'Inserisci un link valido o un ID cartella Google Drive.'
          : 'Please enter a valid Google Drive folder link or ID.'
      );
      setIsSavingSettings(false);
      return;
    }

    try {
      // 1. Verify folder accessibility via Apps Script (NO POPUP!)
      const checkResult = await checkDriveFolder(folderId, email);
      if (!checkResult.success) {
        throw new Error(checkResult.message || 'Impossibile accedere alla cartella Google Drive.');
      }

      const updatedConfig: GoogleDriveConfig = {
        folderInput,
        folderId,
        email,
        connected: true,
      };

      setDriveConfig(updatedConfig);
      localStorage.setItem(STORAGE_KEY_DRIVE, JSON.stringify(updatedConfig));
      setIsConnectedGoogle(true);
      setUserEmail(email);

      // 2. Scan and load any existing data from the Drive folder
      await performDriveScan(folderId, email);
    } catch (err: any) {
      console.error('Config save error:', err);
      setDriveScanError(err.message || (isItalian ? 'Salvataggio o verifica cartella fallita.' : 'Save or folder verification failed.'));
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Manual folder rescan via Google Apps Script
  const handleScanDriveFolder = async () => {
    if (!driveConfig.folderId) {
      setDriveScanError(isItalian ? 'Cartella Google Drive non configurata.' : 'Google Drive folder not configured.');
      return;
    }
    await performDriveScan(driveConfig.folderId, driveConfig.email);
  };

  // Load historical match data from goalkeeper's Google Drive database
  const handleLoadPlayerHistory = useCallback(
    async (playerId: string) => {
      const player = players.find((p) => p.id === playerId);
      if (!player) return;

      if (!driveConfig.folderId) return;

      setIsLoadingHistory(true);
      setDriveScanError(null);

      try {
        const loadResult = await loadDatabaseFromDrive(driveConfig.folderId, driveConfig.email);
        if (loadResult.success && loadResult.data) {
          const driveData = loadResult.data;
          if (driveData.events && Array.isArray(driveData.events)) {
            const playerEvts = driveData.events.filter((e) => e.playerId === playerId);
            setEvents((prev) => {
              const others = prev.filter((e) => e.playerId !== playerId);
              return [...others, ...playerEvts];
            });

            setSaveSuccessBanner({
              message: isItalian
                ? `Dati storici per ${player.name} caricati (${playerEvts.length} eventi da Google Drive).`
                : `Historical data for ${player.name} loaded (${playerEvts.length} events from Google Drive).`,
            });
          }
        }
      } catch (err: any) {
        console.error('Error loading historical data from Drive:', err);
        setDriveScanError(err.message || 'Errore nel caricamento dei dati da Google Drive.');
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [players, driveConfig.folderId, driveConfig.email, isItalian]
  );

  // Select a goalkeeper: updates selection and loads their historical Google Sheet data
  const handleSelectPlayerAndLoad = (id: string) => {
    setSelectedPlayerId(id);
    handleLoadPlayerHistory(id);
  };

  // Disconnect Google Drive
  const handleDisconnectGoogle = async () => {
    setIsConnectedGoogle(false);
    setUserEmail(null);
    const updated = { ...driveConfig, connected: false };
    setDriveConfig(updated);
    localStorage.setItem(STORAGE_KEY_DRIVE, JSON.stringify(updated));
    setDriveScanMessage(isItalian ? 'Google Drive disconnesso.' : 'Google Drive disconnected.');
  };

  // Add a new goalkeeper: saves locally and syncs to Drive folder if configured
  const handleAddPlayer = async (name: string, team: string) => {
    const trimmedName = name.trim();
    const trimmedTeam = team.trim();
    if (!trimmedName) return;

    const newPlayer: Player = {
      id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: trimmedName,
      team: trimmedTeam,
    };

    const updatedPlayers = [...players, newPlayer];
    setPlayers(updatedPlayers);
    setSelectedPlayerId(newPlayer.id);

    if (driveConfig.folderId && isConnectedGoogle) {
      setIsCreatingSheet(true);
      setDriveScanError(null);
      try {
        await saveDatabaseToDrive(driveConfig.folderId, {
          players: updatedPlayers,
          events,
          matchDetails,
          email: driveConfig.email,
        });

        setSaveSuccessBanner({
          message: isItalian
            ? `Portiere "${trimmedName}" aggiunto e sincronizzato nella cartella Google Drive!`
            : `Goalkeeper "${trimmedName}" added and synced to Google Drive folder!`,
        });
      } catch (err: any) {
        console.error('Error syncing new player to Drive:', err);
      } finally {
        setIsCreatingSheet(false);
      }
    }
  };

  const handleUpdatePlayer = (id: string, name: string, team: string) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, name, team } : p)));
  };

  const handleDeletePlayer = (id: string) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
    if (selectedPlayerId === id) {
      setSelectedPlayerId(null);
    }
  };

  const handleDetailsChange = (field: keyof MatchDetails, value: string) => {
    setMatchDetails((prev) => ({ ...prev, [field]: value }));
  };

  const handleGoalClick = useCallback((x: number, y: number) => {
    setClickCoords({ x, y });
    setIsModalOpen(true);
  }, []);

  const handleAddEvent = useCallback(
    (
      type: SoccerEvent['type'],
      outcome: SoccerEvent['outcome'],
      notes: string,
      extraData?: {
        pitchX?: number;
        pitchY?: number;
        xG?: number;
        xGOT?: number;
        shotDistance?: number;
      }
    ) => {
      if (clickCoords && selectedPlayerId && trackingMode) {
        const newEvent: SoccerEvent = {
          id: `evt_${Date.now()}`,
          playerId: selectedPlayerId,
          type,
          outcome,
          x: clickCoords.x,
          y: clickCoords.y,
          timestamp: Date.now(),
          notes: notes,
          mode: trackingMode,
          matchDate: matchDetails.date,
          matchName: matchDetails.matchName,
          competition: matchDetails.competition,
          ...(extraData || {}),
        };
        if (trackingMode === 'Corner' || trackingMode === 'Cross') {
          newEvent.eventSide = selectedSide!;
        }
        setEvents((prevEvents) => [...prevEvents, newEvent]);
        setSelectedTrackingEventId(newEvent.id);
      }
      setIsModalOpen(false);
      setClickCoords(null);
    },
    [clickCoords, selectedPlayerId, trackingMode, selectedSide, matchDetails]
  );

  const handleRecordShotWithXgot = useCallback(
    (eventData: Partial<SoccerEvent>) => {
      if (!selectedPlayerId) return;

      if (eventData.id) {
        // Update existing event with enriched xGOT calculations
        setEvents((prevEvents) =>
          prevEvents.map((evt) =>
            evt.id === eventData.id
              ? {
                  ...evt,
                  ...eventData,
                  pitchX: eventData.pitchX !== undefined ? eventData.pitchX : evt.pitchX,
                  pitchY: eventData.pitchY !== undefined ? eventData.pitchY : evt.pitchY,
                  shotDistance: eventData.shotDistance !== undefined ? eventData.shotDistance : evt.shotDistance,
                  shotAngle: eventData.shotAngle !== undefined ? eventData.shotAngle : evt.shotAngle,
                  xG: eventData.xG !== undefined ? eventData.xG : evt.xG,
                  xGOT: eventData.xGOT !== undefined ? eventData.xGOT : evt.xGOT,
                  shotBodyPart: eventData.shotBodyPart || evt.shotBodyPart,
                  shotSituation: eventData.shotSituation || evt.shotSituation,
                  shotPressure: eventData.shotPressure || evt.shotPressure,
                  shotPower: eventData.shotPower || evt.shotPower,
                  isDeflected: eventData.isDeflected !== undefined ? eventData.isDeflected : evt.isDeflected,
                  notes: eventData.notes || evt.notes,
                }
              : evt
          )
        );
        return;
      }

      const newEvent: SoccerEvent = {
        id: `evt_${Date.now()}`,
        playerId: selectedPlayerId,
        type: eventData.type || 'Shot',
        outcome: eventData.outcome || 'Saved',
        x: eventData.x !== undefined ? eventData.x : 50,
        y: eventData.y !== undefined ? eventData.y : 50,
        pitchX: eventData.pitchX,
        pitchY: eventData.pitchY,
        shotDistance: eventData.shotDistance,
        shotAngle: eventData.shotAngle,
        xG: eventData.xG,
        xGOT: eventData.xGOT,
        shotBodyPart: eventData.shotBodyPart,
        shotSituation: eventData.shotSituation,
        shotPressure: eventData.shotPressure,
        shotPower: eventData.shotPower,
        isDeflected: eventData.isDeflected,
        timestamp: Date.now(),
        notes: eventData.notes || '',
        mode: 'Saves',
        matchDate: matchDetails.date,
        matchName: matchDetails.matchName,
        competition: matchDetails.competition,
      };
      setEvents((prevEvents) => [...prevEvents, newEvent]);
    },
    [selectedPlayerId, matchDetails]
  );

  const handleAddDistributionEvent = useCallback(
    (type: EventType, outcome: EventOutcome, notes: string) => {
      if (selectedPlayerId && trackingMode === 'Distribution') {
        const newEvent: SoccerEvent = {
          id: `evt_${Date.now()}`,
          playerId: selectedPlayerId,
          type,
          outcome,
          x: -1,
          y: -1,
          timestamp: Date.now(),
          notes: notes,
          mode: trackingMode,
          matchDate: matchDetails.date,
          matchName: matchDetails.matchName,
          competition: matchDetails.competition,
        };
        setEvents((prevEvents) => [...prevEvents, newEvent]);
      }
    },
    [selectedPlayerId, trackingMode, matchDetails]
  );

  const handleDeleteEvent = useCallback((id: string) => {
    setEvents((prevEvents) => prevEvents.filter((event) => event.id !== id));
  }, []);

  // Filter player events
  const playerEvents = useMemo(() => {
    if (!selectedPlayerId) return [];
    return events.filter((event) => event.playerId === selectedPlayerId);
  }, [events, selectedPlayerId]);

  const selectedPlayer = useMemo(() => {
    return players.find((p) => p.id === selectedPlayerId) || null;
  }, [players, selectedPlayerId]);

  const parataEvents = useMemo(() => {
    return playerEvents.filter((e) => e.mode === 'Saves');
  }, [playerEvents]);

  const sideViewEvents = useMemo(() => {
    return playerEvents.filter(
      (e) => (e.mode === 'Corner' || e.mode === 'Cross') && e.eventSide === selectedSide && e.mode === trackingMode
    );
  }, [playerEvents, selectedSide, trackingMode]);

  const distribuzioneEvents = useMemo(() => {
    return playerEvents.filter((e) => e.mode === 'Distribution');
  }, [playerEvents]);

  const selectedPlayerName = selectedPlayer?.name || t.noPlayerSelected;
  const hasPlayers = players.length > 0;
  const isReadyForTracking = hasPlayers && !!matchDetails.date;

  // Open Save to Sheets Confirmation Modal
  const handlePromptSaveToSheets = () => {
    if (!selectedPlayer) return;
    setIsSyncModalOpen(true);
  };

  // Confirm Save & Sync to Goalkeeper's Google Drive database (NO POPUP!)
  const handleConfirmSaveToSheets = async () => {
    if (!selectedPlayer) return;

    setIsSavingMatchToSheets(true);
    setDriveScanError(null);

    try {
      if (!driveConfig.folderId) {
        throw new Error(
          isItalian
            ? 'Cartella Google Drive non configurata. Impostala nelle Impostazioni.'
            : 'Google Drive folder is not configured. Please set it in Settings.'
        );
      }

      const result = await saveDatabaseToDrive(driveConfig.folderId, {
        players,
        events,
        matchDetails,
        email: driveConfig.email,
      });

      if (!result.success) {
        throw new Error(result.message || 'Errore durante il salvataggio su Google Drive.');
      }

      // Reset the graphic input in tracking for new recordings
      setEvents((prev) => prev.filter((e) => e.playerId !== selectedPlayer.id));
      setSelectedSide(null);
      setClickCoords(null);

      setIsSyncModalOpen(false);
      setSaveSuccessBanner({
        message: isItalian
          ? `Partita salvata con successo nella cartella Google Drive (${result.folderName || 'Drive'})! L'inserimento grafico nel tracciamento è stato resettato per le nuove registrazioni.`
          : `Match saved successfully to Google Drive folder! Graphic tracking reset for new recordings.`,
      });
    } catch (err: any) {
      console.error('Error saving match to Google Drive:', err);
      setDriveScanError(err.message || 'Errore durante il salvataggio su Google Drive.');
    } finally {
      setIsSavingMatchToSheets(false);
    }
  };

  // Direct Save from Match section: saves match details & events to Google Drive, then resets graphic tracking
  const handleSaveMatchFromMatchView = async () => {
    if (!selectedPlayer) {
      setDriveScanError(
        isItalian
          ? 'Nessun portiere selezionato. Seleziona prima un portiere nella sezione Portieri o Impostazioni.'
          : 'No goalkeeper selected. Please select a goalkeeper first.'
      );
      return;
    }

    if (!matchDetails.date) {
      setDriveScanError(
        isItalian
          ? 'La data della partita è obbligatoria per effettuare il salvataggio.'
          : 'Match date is required to save.'
      );
      return;
    }

    setIsSavingMatchToSheets(true);
    setDriveScanError(null);

    try {
      const currentEvents = events.filter((e) => e.playerId === selectedPlayer.id);

      if (!driveConfig.folderId) {
        // Local save fallback if Google Drive is not configured
        setEvents((prev) => prev.filter((e) => e.playerId !== selectedPlayer.id));
        setSelectedSide(null);
        setClickCoords(null);

        setSaveSuccessBanner({
          message: isItalian
            ? `Partita salvata in locale per ${selectedPlayer.name} (${currentEvents.length} eventi). L'inserimento grafico nel tracciamento è stato resettato per le nuove registrazioni. Per sincronizzare su Google Drive, inserisci il link della cartella nelle Impostazioni.`
            : `Match saved locally for ${selectedPlayer.name} (${currentEvents.length} events). Graphic tracking has been reset for new recordings. Connect Google Drive in Settings to sync directly to Google Drive.`,
        });
        return;
      }

      // Save to Google Drive via Apps Script
      const result = await saveDatabaseToDrive(driveConfig.folderId, {
        players,
        events,
        matchDetails,
        email: driveConfig.email,
      });

      if (!result.success) {
        throw new Error(result.message || 'Errore durante il salvataggio su Google Drive.');
      }

      // RESET THE GRAPHIC INPUT IN TRACKING FOR NEW ENTRIES
      setEvents((prev) => prev.filter((e) => e.playerId !== selectedPlayer.id));
      setSelectedSide(null);
      setClickCoords(null);

      setSaveSuccessBanner({
        message: isItalian
          ? `Partita salvata con successo nella cartella Google Drive (${result.folderName || 'Drive'})! L'inserimento grafico nel tracciamento è stato resettato per le nuove registrazioni.`
          : `Match saved successfully to Google Drive folder! Graphic tracking has been reset for new recordings.`,
      });
    } catch (err: any) {
      console.error('Error saving match from MatchView:', err);
      setDriveScanError(
        err.message ||
          (isItalian ? 'Errore durante il salvataggio su Google Drive.' : 'Error saving to Google Drive.')
      );
    } finally {
      setIsSavingMatchToSheets(false);
    }
  };

  const handleExportCsv = (onlySingleMatch: boolean = false) => {
    if (!selectedPlayerId) return;
    const allPlayerData = events.filter((e) => e.playerId === selectedPlayerId);
    const playerName = players.find((p) => p.id === selectedPlayerId)?.name || 'data';

    let dataToExport = allPlayerData;
    let fileName = `${playerName}_all_matches_stats.csv`;

    if (onlySingleMatch && statsSelectedMatchKey !== 'ALL') {
      dataToExport = allPlayerData.filter((e) => {
        const date = (e.matchDate || '').trim();
        const matchName = (e.matchName || '').trim();
        const comp = (e.competition || '').trim();
        const displayDate = date || (e.timestamp ? new Date(e.timestamp).toISOString().split('T')[0] : '');
        return `${displayDate}___${matchName}___${comp}` === statsSelectedMatchKey;
      });
      fileName = `${playerName}_match_stats.csv`;
    }

    exportToCsv(dataToExport, fileName);
    setIsExportMenuOpen(false);
  };

  const handleExportXlsx = (onlySingleMatch: boolean = false) => {
    if (!selectedPlayerId) return;
    const player = players.find((p) => p.id === selectedPlayerId);
    if (!player) return;
    const allPlayerData = events.filter((e) => e.playerId === selectedPlayerId);

    let dataToExport = allPlayerData;
    let filterLabel = isItalian ? 'Tutte le partite' : isSpanish ? 'Todos los partidos' : 'All matches';
    let fileName = `${player.name}_tutte_le_partite_statistiche.xlsx`.replace(/\s+/g, '_');

    if (onlySingleMatch && statsSelectedMatchKey !== 'ALL') {
      const parts = statsSelectedMatchKey.split('___');
      const displayDate = parts[0] || '';
      const matchName = parts[1] || '';
      const comp = parts[2] || '';
      filterLabel = `${displayDate}${matchName ? ` - ${matchName}` : ''}${comp ? ` (${comp})` : ''}`.trim() || (isItalian ? 'Partita Selezionata' : 'Selected Match');

      dataToExport = allPlayerData.filter((e) => {
        const date = (e.matchDate || '').trim();
        const mName = (e.matchName || '').trim();
        const c = (e.competition || '').trim();
        const dDate = date || (e.timestamp ? new Date(e.timestamp).toISOString().split('T')[0] : '');
        return `${dDate}___${mName}___${c}` === statsSelectedMatchKey;
      });
      fileName = `${player.name}_${matchName || displayDate || 'partita'}_statistiche.xlsx`.replace(/\s+/g, '_');
    }

    exportStatsToXlsx({
      events: dataToExport,
      player,
      filterLabel,
      currentMatchDetails: matchDetails,
      language,
      filename: fileName,
    });
    setIsExportXlsxMenuOpen(false);
  };

  // 4. Schermata di caricamento durante la verifica automatica all'avvio
  if (isVerifyingSession) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-gray-950 via-gray-900 to-slate-950 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="inline-flex items-center justify-center p-4 mb-4 rounded-3xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 shadow-2xl shadow-cyan-950/60 animate-pulse">
          <GoalkeeperGloveIcon className="w-12 h-12" />
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-white mb-2 tracking-tight">GKAnalytics</h2>
        <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm mb-1.5 justify-center">
          <ArrowPathIcon className="w-4 h-4 animate-spin text-cyan-400" />
          <span>Verifica accesso in corso...</span>
        </div>
        <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
          Verifica automatica delle credenziali e dello stato dell'account in corso...
        </p>
      </div>
    );
  }

  // 1. Blocco completo: se l'utente non è autenticato mostra esclusivamente la schermata di Login
  if (!currentUser) {
    return (
      <LoginScreen
        onLoginSuccess={(username, scadenza) => {
          setCurrentUser({
            username,
            scadenza: scadenza || (isItalian ? 'Illimitata' : 'Unlimited'),
          });
          setAuthErrorMessage(null);
        }}
        language={language}
        onLanguageChange={setLanguage}
        initialErrorMessage={authErrorMessage}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col p-3 sm:p-4 md:p-6 selection:bg-cyan-500 selection:text-white">
      {/* Toast / Banner for Saved Match or Scan result */}
      {saveSuccessBanner && (
        <div className="fixed top-3 sm:top-4 right-3 sm:right-4 left-3 sm:left-auto z-50 max-w-md bg-gray-800 border border-emerald-500/80 shadow-2xl rounded-2xl p-3.5 sm:p-4 flex items-start gap-3 animate-fade-in">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl flex-shrink-0">
            <GoogleSheetsIcon className="w-5 h-5" />
          </div>
          <div className="flex-grow min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-white">{saveSuccessBanner.message}</p>
            {saveSuccessBanner.sheetUrl && (
              <a
                href={saveSuccessBanner.sheetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium mt-1.5 underline underline-offset-2"
              >
                <span>{isItalian ? 'Apri foglio su Google Drive' : 'Open Sheet in Google Drive'}</span>
                <ExternalLinkIcon className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
          <button
            onClick={() => setSaveSuccessBanner(null)}
            className="text-gray-400 hover:text-white p-1 rounded-lg flex-shrink-0"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <header className="w-full max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-stretch sm:items-center mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-gray-800 gap-3 sm:gap-4">
        <div className="flex items-center justify-between sm:justify-start gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              <span>GKAnalytics</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-gray-400 font-medium">{t.appSubtitle}</p>
          </div>

          {/* Quick drive status icon on mobile right */}
          <div className="sm:hidden">
            <button
              type="button"
              onClick={() => setView('settings')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all ${
                isConnectedGoogle
                  ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                  : 'bg-gray-800 border-gray-700 text-gray-400'
              }`}
              title={isConnectedGoogle ? 'Google Drive Connesso' : 'Collega Google Drive'}
            >
              <GoogleDriveIcon className="w-3.5 h-3.5" />
              <span>{isConnectedGoogle ? 'Drive' : 'Connetti'}</span>
            </button>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 flex-wrap">
          {/* Google Drive Status Indicator (desktop) */}
          <button
            type="button"
            onClick={() => setView('settings')}
            className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              isConnectedGoogle
                ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300 hover:bg-emerald-950/60'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
            }`}
            title={isConnectedGoogle ? `Drive: ${driveConfig.folderId || 'Connesso'}` : 'Configura Google Drive'}
          >
            <GoogleDriveIcon className="w-4 h-4" />
            <span>
              {isConnectedGoogle
                ? isItalian
                  ? 'Drive Connesso'
                  : 'Drive Connected'
                : isItalian
                ? 'Collega Drive'
                : 'Connect Drive'}
            </span>
          </button>

          {/* Language Selector */}
          <div className="relative">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="appearance-none bg-gray-800 border border-gray-700 text-white rounded-xl px-2.5 sm:px-3 py-1.5 pr-7 sm:pr-8 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
              aria-label="Select language"
            >
              <option value="en">EN</option>
              <option value="it">IT</option>
              <option value="es">ES</option>
            </select>
            <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Goalkeeper Dropdown Selector */}
          <div
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-gray-800 rounded-xl border border-gray-700 flex-grow sm:flex-grow-0 max-w-[200px] ${
              hasPlayers ? 'opacity-100' : 'opacity-50'
            }`}
          >
            <GoalkeeperGloveIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400 flex-shrink-0" />
            <select
              value={selectedPlayerId ?? ''}
              onChange={(e) => handleSelectPlayerAndLoad(e.target.value)}
              className="bg-transparent text-white font-semibold focus:outline-none text-xs disabled:text-gray-500 cursor-pointer w-full truncate"
              aria-label={t.selectPlayer}
              disabled={!hasPlayers}
            >
              {hasPlayers ? (
                players.map((p) => (
                  <option className="bg-gray-800 text-white" key={p.id} value={p.id}>
                    {p.name}{p.team ? ` (${p.team})` : ''}
                  </option>
                ))
              ) : (
                <option className="bg-gray-800 text-gray-400" value="">
                  {t.addPlayerFirst}
                </option>
              )}
            </select>
          </div>

          {/* Save Match to Google Sheets button in header if in tracking/stats view */}
          {(view === 'tracking' || view === 'stats') && isReadyForTracking && (
            <button
              type="button"
              id="header-save-to-sheets-btn"
              onClick={handlePromptSaveToSheets}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-700/70 text-emerald-300 hover:text-emerald-200 rounded-xl font-bold text-xs shadow-md shadow-emerald-950/40 transition-colors"
              title="Salva Partita su Google Sheets"
            >
              <GoogleSheetsIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{isItalian ? 'Salva' : 'Save'}</span>
            </button>
          )}

          {/* Pulsante Esci (Logout) */}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-rose-300 hover:text-white bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 rounded-xl transition-colors text-xs font-bold shadow-sm"
            title={isItalian ? 'Esci dall\'applicazione' : 'Sign Out'}
            aria-label="Logout"
          >
            <ArrowRightOnRectangleIcon className="w-3.5 h-3.5" />
            <span>{isItalian ? 'Esci' : 'Sign Out'}</span>
          </button>
        </div>
      </header>

      {/* Main Navigation */}
      <main className="w-full max-w-7xl mx-auto flex-grow flex flex-col">
        <div className="flex border-b border-gray-800 mb-4 sm:mb-6 overflow-x-auto no-scrollbar gap-1 touch-pan-x scroll-smooth">
          <NavButton targetView="settings" currentView={view} onClick={setView}>
            {t.nav.settings}
          </NavButton>
          <NavButton targetView="players" currentView={view} onClick={setView}>
            {t.nav.players}
          </NavButton>
          <NavButton targetView="match" currentView={view} onClick={setView}>
            {t.nav.match}
          </NavButton>
          <NavButton
            targetView="tracking"
            currentView={view}
            onClick={setView}
            disabled={!isReadyForTracking}
            disabledTooltip={t.navTooltip}
          >
            {t.nav.tracking}
          </NavButton>
          <NavButton
            targetView="stats"
            currentView={view}
            onClick={setView}
            disabled={!isReadyForTracking}
            disabledTooltip={t.navTooltipStats}
          >
            {t.nav.stats}
          </NavButton>
          <NavButton
            targetView="info"
            currentView={view}
            onClick={setView}
          >
            {t.nav.info}
          </NavButton>
        </div>

        {/* VIEW 1: Settings */}
        {view === 'settings' && (
          <SettingsView
            language={language}
            driveConfig={driveConfig}
            onSaveDriveConfig={handleSaveDriveConfig}
            onScanDriveFolder={handleScanDriveFolder}
            isScanningDrive={isScanningDrive}
            isSavingSettings={isSavingSettings}
            driveScanMessage={driveScanMessage}
            driveScanError={driveScanError}
            userEmail={userEmail}
            isConnectedGoogle={isConnectedGoogle}
            onDisconnectGoogle={handleDisconnectGoogle}
          />
        )}

        {/* VIEW 2: Match Details */}
        {view === 'match' && (
          <MatchView
            matchDetails={matchDetails}
            onDetailsChange={handleDetailsChange}
            language={language}
            onSave={handleSaveMatchFromMatchView}
            isSaving={isSavingMatchToSheets}
            selectedPlayer={selectedPlayer}
            eventsCount={playerEvents.length}
            saveSuccessBanner={saveSuccessBanner}
            onDismissSuccessBanner={() => setSaveSuccessBanner(null)}
            saveError={driveScanError}
          />
        )}

        {/* VIEW 3: Players */}
        {view === 'players' && (
          <PlayerView
            language={language}
            players={players}
            selectedPlayerId={selectedPlayerId}
            onSelectPlayer={handleSelectPlayerAndLoad}
            onAddPlayer={handleAddPlayer}
            onUpdatePlayer={handleUpdatePlayer}
            onDeletePlayer={handleDeletePlayer}
            driveConfig={driveConfig}
            hasDriveConfig={!!driveConfig.folderId && isConnectedGoogle}
            isConnectedGoogle={isConnectedGoogle}
            isCreatingSheet={isCreatingSheet}
            onLoadPlayerHistory={handleLoadPlayerHistory}
            isLoadingHistory={isLoadingHistory}
          />
        )}

        {/* VIEW 4: Tracking */}
        {view === 'tracking' && isReadyForTracking && (
          <div className="space-y-6">
            {/* Action Bar with Save to Google Sheets */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-gray-800 rounded-2xl border border-gray-700 shadow-md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/15 text-cyan-400 rounded-xl border border-cyan-500/30">
                  <GoalkeeperGloveIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-base">{selectedPlayerName}</span>
                    {selectedPlayer?.team && (
                      <span className="text-xs text-gray-400">({selectedPlayer.team})</span>
                    )}
                    {selectedPlayer?.spreadsheetId && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 flex items-center gap-1">
                        <GoogleSheetsIcon className="w-3 h-3" />
                        <span>Google Sheet</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {matchDetails.date ? `${matchDetails.date} • ` : ''}
                    {matchDetails.matchName || (isItalian ? 'Sessione di Tracciamento' : 'Tracking Session')}
                    {matchDetails.competition ? ` (${matchDetails.competition})` : ''}
                    {matchDetails.duration ? ` • ${matchDetails.duration} min` : ''}
                    {matchDetails.starter ? ` • ${matchDetails.starter === 'yes' ? (isItalian ? 'Titolare' : 'Starter') : (isItalian ? 'Panchina' : 'Bench')}` : ''}
                    {(matchDetails.subIn || matchDetails.subOut) && (
                      <span className="text-cyan-300 font-medium">
                        {' '}• {isItalian ? 'Sost.: ' : 'Sub: '}
                        {matchDetails.subIn && `${isItalian ? 'Entr. ' : 'In '}${matchDetails.subInMinute}'`}
                        {matchDetails.subIn && matchDetails.subOut && ' - '}
                        {matchDetails.subOut && `${isItalian ? 'Usc. ' : 'Out '}${matchDetails.subOutMinute}'`}
                      </span>
                    )} •{' '}
                    <strong className="text-cyan-400">{playerEvents.length}</strong>{' '}
                    {isItalian ? 'eventi registrati' : 'recorded events'}
                  </p>
                </div>
              </div>

              {/* Actions Area: Sostituzione & Salva Partita su Google Sheets */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full sm:w-auto justify-end">
                {/* OPZIONE SOSTITUZIONE */}
                <SubstitutionControl
                  subIn={matchDetails.subIn}
                  subInMinute={matchDetails.subInMinute}
                  subOut={matchDetails.subOut}
                  subOutMinute={matchDetails.subOutMinute}
                  onChange={(subData) => {
                    setMatchDetails((prev) => ({
                      ...prev,
                      ...subData,
                    }));
                  }}
                  language={language}
                />

                {/* SAVE TO GOOGLE SHEETS BUTTON */}
                <button
                  type="button"
                  id="save-match-to-sheets-btn"
                  onClick={handlePromptSaveToSheets}
                  className="flex-grow sm:flex-grow-0 flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-700/70 text-emerald-300 hover:text-emerald-200 rounded-xl font-bold text-sm shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
                >
                  <GoogleSheetsIcon className="w-4 h-4" />
                  <span>{isItalian ? 'Salva Partita su Google Sheets' : 'Save Match to Google Sheets'}</span>
                </button>
              </div>
            </div>

            {/* Mode selector */}
            <div
              id="tracking-mode-selector"
              className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-4 p-2 bg-gray-800 border border-gray-700 rounded-xl max-w-2xl mx-auto"
            >
              {(['Saves', 'Corner', 'Cross', 'Distribution'] as const).map((mode) => (
                <button
                  id={`tracking-mode-${mode.toLowerCase()}`}
                  key={mode}
                  onClick={() => setTrackingMode(mode)}
                  className={`w-full py-2.5 px-3 sm:px-4 text-sm font-semibold rounded-lg transition-colors text-center ${
                    trackingMode === mode
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'bg-gray-700/70 hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  {t.modes[mode]}
                </button>
              ))}
            </div>

            {trackingMode === 'Saves' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="space-y-6">
                  {/* Goal Frame Box */}
                  <div className="bg-gray-800 p-4 rounded-2xl shadow-lg border border-gray-700 flex flex-col items-center">
                    <h2 className="text-lg font-bold mb-4">
                      {t.tracking.tapToRecord} <span className="text-cyan-400">{selectedPlayerName}</span>
                    </h2>
                    <SoccerGoal events={parataEvents} onGoalClick={handleGoalClick} language={language} />
                  </div>

                  {/* Half Pitch & xGOT Conceded Box (Same style, mobile optimized) */}
                  <HalfPitchXGOT
                    events={parataEvents}
                    selectedPlayerName={selectedPlayerName}
                    language={language}
                    lastGoalClickCoords={clickCoords}
                    onRecordShotWithXgot={handleRecordShotWithXgot}
                    activeMatchDetails={matchDetails}
                    selectedEventId={selectedTrackingEventId}
                    onSelectEvent={setSelectedTrackingEventId}
                  />
                </div>

                {/* Session Events Column */}
                <div className="bg-gray-800 p-4 rounded-2xl shadow-lg border border-gray-700 lg:sticky lg:top-4">
                  <h2 className="text-lg font-bold mb-4">{t.tracking.sessionEvents}</h2>
                  <EventList
                    events={parataEvents}
                    onDeleteEvent={handleDeleteEvent}
                    language={language}
                    selectedEventId={selectedTrackingEventId}
                    onSelectEvent={setSelectedTrackingEventId}
                  />
                </div>
              </div>
            )}

            {(trackingMode === 'Corner' || trackingMode === 'Cross') && (
              <div>
                {!selectedSide ? (
                  <div className="text-center p-8 bg-gray-800 rounded-2xl border border-gray-700 max-w-2xl mx-auto">
                    <h3 className="text-xl font-semibold text-white mb-4">
                      {t.tracking.selectSide} {t.modes[trackingMode]}
                    </h3>
                    <div className="flex justify-center gap-4">
                      <button
                        onClick={() => setSelectedSide('left')}
                        className="px-6 py-3 bg-gray-700 hover:bg-cyan-600 rounded-xl font-semibold transition-colors"
                      >
                        {t.tracking.gkLeft}
                      </button>
                      <button
                        onClick={() => setSelectedSide('right')}
                        className="px-6 py-3 bg-gray-700 hover:bg-cyan-600 rounded-xl font-semibold transition-colors"
                      >
                        {t.tracking.gkRight}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-gray-800 p-4 rounded-2xl shadow-lg border border-gray-700 flex flex-col items-center">
                      <div className="w-full flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold">
                          {t.modes[trackingMode]}:{' '}
                          <span className="text-cyan-400">
                            {selectedSide === 'left' ? t.tracking.left : t.tracking.right}
                          </span>
                        </h2>
                        <button
                          onClick={() => setSelectedSide(null)}
                          className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                        >
                          {t.tracking.changeSide}
                        </button>
                      </div>
                      <CornerGoal
                        events={sideViewEvents}
                        onGoalClick={handleGoalClick}
                        side={selectedSide}
                        language={language}
                      />
                    </div>
                    <div className="bg-gray-800 p-4 rounded-2xl shadow-lg border border-gray-700">
                      <h2 className="text-lg font-bold mb-4">{t.tracking.sessionEvents}</h2>
                      <EventList events={sideViewEvents} onDeleteEvent={handleDeleteEvent} language={language} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {trackingMode === 'Distribution' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 flex flex-col items-center justify-center">
                  <DistributionView onAddEvent={handleAddDistributionEvent} language={language} />
                </div>
                <div className="bg-gray-800 p-4 rounded-2xl shadow-lg border border-gray-700">
                  <h2 className="text-lg font-bold mb-4">{t.tracking.sessionEvents}</h2>
                  <EventList events={distribuzioneEvents} onDeleteEvent={handleDeleteEvent} language={language} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 5: Stats */}
        {view === 'stats' && isReadyForTracking && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-800 p-4 rounded-2xl border border-gray-700 shadow-md">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {t.stats.performanceReport}: <span className="text-cyan-400">{selectedPlayerName}</span>
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {playerEvents.length} {isItalian ? 'eventi registrati' : 'recorded events'}
                </p>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-stretch sm:justify-end">
                {/* XLSX export dropdown */}
                <div className="relative flex-1 sm:flex-initial">
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportXlsxMenuOpen(!isExportXlsxMenuOpen);
                      setIsExportMenuOpen(false);
                    }}
                    className={`w-full sm:w-auto flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all border shadow-sm min-h-[44px] active:scale-[0.98] ${
                      isExportXlsxMenuOpen
                        ? 'bg-emerald-900 border-emerald-500 text-emerald-200 ring-2 ring-emerald-500/30'
                        : 'bg-emerald-950/80 hover:bg-emerald-900/90 border-emerald-700/80 text-emerald-300 hover:text-emerald-100'
                    }`}
                    title={isItalian ? 'Esporta tutte le statistiche in formato XLSX' : 'Export all stats in XLSX format'}
                    aria-expanded={isExportXlsxMenuOpen}
                  >
                    <SpreadsheetIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>XLSX</span>
                    <ChevronDownIcon
                      className={`w-3.5 h-3.5 text-emerald-400 transition-transform duration-200 ${isExportXlsxMenuOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Backdrop for mobile, tablet, and desktop */}
                  {isExportXlsxMenuOpen && (
                    <div
                      className="fixed inset-0 z-40 bg-black/60 sm:bg-black/30 backdrop-blur-sm sm:backdrop-blur-none transition-opacity"
                      onClick={() => setIsExportXlsxMenuOpen(false)}
                      aria-hidden="true"
                    />
                  )}

                  {/* Adaptive Menu: Bottom Sheet on Mobile (<sm), Floating Popover on Tablet & Desktop (>=sm) */}
                  {isExportXlsxMenuOpen && (
                    <div
                      className="fixed inset-x-0 bottom-0 z-50 sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:right-0 sm:mt-2 sm:w-80 w-full bg-gray-900/98 sm:bg-gray-800/98 backdrop-blur-xl sm:backdrop-blur-md rounded-t-3xl sm:rounded-2xl border-t sm:border border-gray-700 shadow-2xl p-4 sm:p-0 overflow-hidden divide-y divide-gray-700/60 max-h-[85vh] sm:max-h-none overflow-y-auto animate-in slide-in-from-bottom duration-200 sm:animate-none"
                    >
                      {/* Mobile Top Pill Handle */}
                      <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-3 sm:hidden" />

                      {/* Header with Title and Mobile Close Button */}
                      <div className="flex items-center justify-between px-1 py-1 sm:px-4 sm:py-3 bg-transparent sm:bg-gray-900/70">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 sm:hidden">
                            <SpreadsheetIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-sm sm:text-xs font-bold text-white sm:text-emerald-300 block">
                              {isItalian ? 'Esporta statistiche (XLSX)' : 'Export statistics (XLSX)'}
                            </span>
                            <span className="text-[11px] text-gray-400 font-normal sm:hidden block">
                              {isItalian ? 'Formato Microsoft Excel con formule e KPI' : 'Microsoft Excel format with formulas'}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsExportXlsxMenuOpen(false)}
                          className="sm:hidden p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
                          aria-label="Chiudi"
                        >
                          <XMarkIcon className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Options List */}
                      <div className="space-y-1.5 sm:space-y-0 pt-2 sm:pt-0">
                        {statsSelectedMatchKey !== 'ALL' && (
                          <button
                            type="button"
                            onClick={() => handleExportXlsx(true)}
                            className="w-full text-left p-3 sm:px-4 sm:py-3 text-xs text-emerald-300 hover:bg-gray-700/80 active:bg-gray-700 rounded-xl sm:rounded-none flex items-center gap-3 transition-colors font-semibold min-h-[50px] sm:min-h-[46px] border border-emerald-500/30 sm:border-0 bg-emerald-950/20 sm:bg-transparent"
                          >
                            <div className="p-2 sm:p-0 rounded-lg bg-emerald-500/20 sm:bg-transparent flex-shrink-0">
                              <SpreadsheetIcon className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div className="min-w-0 flex-grow">
                              <div className="flex items-center gap-2">
                                <span className="block truncate font-bold text-white sm:text-emerald-300">
                                  {isItalian ? 'Esporta partita selezionata' : 'Export selected match'}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/80 font-medium">
                                  {isItalian ? 'Filtro' : 'Filter'}
                                </span>
                              </div>
                              <span className="text-[11px] text-gray-300 sm:text-gray-400 block truncate font-normal mt-0.5">
                                {[
                                  statsSelectedMatchKey.split('___')[0],
                                  statsSelectedMatchKey.split('___')[1],
                                  statsSelectedMatchKey.split('___')[2] ? `[${statsSelectedMatchKey.split('___')[2]}]` : '',
                                ].filter(Boolean).join(' • ')}
                              </span>
                            </div>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleExportXlsx(false)}
                          className="w-full text-left p-3 sm:px-4 sm:py-3 text-xs text-gray-200 hover:bg-gray-700/80 active:bg-gray-700 rounded-xl sm:rounded-none flex items-center gap-3 transition-colors font-medium min-h-[50px] sm:min-h-[46px] border border-gray-700/50 sm:border-0 bg-gray-800/50 sm:bg-transparent"
                        >
                          <div className="p-2 sm:p-0 rounded-lg bg-gray-700/60 sm:bg-transparent flex-shrink-0">
                            <SpreadsheetIcon className="w-4 h-4 text-emerald-400" />
                          </div>
                          <div className="min-w-0 flex-grow">
                            <span className="block font-semibold text-white sm:text-gray-200">
                              {isItalian ? 'Esporta tutte le partite' : 'Export all matches'}
                            </span>
                            <span className="text-[11px] text-gray-400 block font-normal mt-0.5">
                              {isItalian ? 'Riepilogo statistiche complete di tutte le partite' : 'Complete statistics summary of all matches'}
                            </span>
                          </div>
                        </button>
                      </div>

                      {/* Mobile bottom dismiss button */}
                      <div className="pt-3 sm:hidden">
                        <button
                          type="button"
                          onClick={() => setIsExportXlsxMenuOpen(false)}
                          className="w-full py-2.5 text-center text-xs font-semibold text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
                        >
                          {isItalian ? 'Annulla' : 'Cancel'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* CSV export dropdown */}
                <div className="relative flex-1 sm:flex-initial">
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(!isExportMenuOpen);
                      setIsExportXlsxMenuOpen(false);
                    }}
                    className={`w-full sm:w-auto flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all border shadow-sm min-h-[44px] active:scale-[0.98] ${
                      isExportMenuOpen
                        ? 'bg-gray-600 border-cyan-500 text-white ring-2 ring-cyan-500/30'
                        : 'bg-gray-700/80 hover:bg-gray-600 border-gray-600 text-gray-200'
                    }`}
                    title={isItalian ? 'Esporta dati grezzi in formato CSV' : 'Export raw data in CSV format'}
                    aria-expanded={isExportMenuOpen}
                  >
                    <DownloadIcon className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span>CSV</span>
                    <ChevronDownIcon
                      className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isExportMenuOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Backdrop for mobile, tablet, and desktop */}
                  {isExportMenuOpen && (
                    <div
                      className="fixed inset-0 z-40 bg-black/60 sm:bg-black/30 backdrop-blur-sm sm:backdrop-blur-none transition-opacity"
                      onClick={() => setIsExportMenuOpen(false)}
                      aria-hidden="true"
                    />
                  )}

                  {/* Adaptive Menu: Bottom Sheet on Mobile (<sm), Floating Popover on Tablet & Desktop (>=sm) */}
                  {isExportMenuOpen && (
                    <div
                      className="fixed inset-x-0 bottom-0 z-50 sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:right-0 sm:mt-2 sm:w-80 w-full bg-gray-900/98 sm:bg-gray-800/98 backdrop-blur-xl sm:backdrop-blur-md rounded-t-3xl sm:rounded-2xl border-t sm:border border-gray-700 shadow-2xl p-4 sm:p-0 overflow-hidden divide-y divide-gray-700/60 max-h-[85vh] sm:max-h-none overflow-y-auto animate-in slide-in-from-bottom duration-200 sm:animate-none"
                    >
                      {/* Mobile Top Pill Handle */}
                      <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-3 sm:hidden" />

                      {/* Header with Title and Mobile Close Button */}
                      <div className="flex items-center justify-between px-1 py-1 sm:px-4 sm:py-3 bg-transparent sm:bg-gray-900/70">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 sm:hidden">
                            <DownloadIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-sm sm:text-xs font-bold text-white sm:text-cyan-300 block">
                              {isItalian ? 'Esporta file CSV' : 'Export CSV file'}
                            </span>
                            <span className="text-[11px] text-gray-400 font-normal sm:hidden block">
                              {isItalian ? 'File di testo con dati grezzi degli eventi' : 'Raw event data in CSV format'}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsExportMenuOpen(false)}
                          className="sm:hidden p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
                          aria-label="Chiudi"
                        >
                          <XMarkIcon className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Options List */}
                      <div className="space-y-1.5 sm:space-y-0 pt-2 sm:pt-0">
                        {statsSelectedMatchKey !== 'ALL' && (
                          <button
                            type="button"
                            onClick={() => handleExportCsv(true)}
                            className="w-full text-left p-3 sm:px-4 sm:py-3 text-xs text-cyan-300 hover:bg-gray-700/80 active:bg-gray-700 rounded-xl sm:rounded-none flex items-center gap-3 transition-colors font-medium min-h-[50px] sm:min-h-[46px] border border-cyan-500/30 sm:border-0 bg-cyan-950/20 sm:bg-transparent"
                          >
                            <div className="p-2 sm:p-0 rounded-lg bg-cyan-500/20 sm:bg-transparent flex-shrink-0">
                              <DownloadIcon className="w-4 h-4 text-cyan-400" />
                            </div>
                            <div className="min-w-0 flex-grow">
                              <div className="flex items-center gap-2">
                                <span className="block truncate font-bold text-white sm:text-cyan-300">
                                  {isItalian ? 'Esporta partita selezionata' : 'Export selected match'}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/80 font-medium">
                                  {isItalian ? 'Filtro' : 'Filter'}
                                </span>
                              </div>
                              <span className="text-[11px] text-gray-300 sm:text-gray-400 block truncate font-normal mt-0.5">
                                {[
                                  statsSelectedMatchKey.split('___')[0],
                                  statsSelectedMatchKey.split('___')[1],
                                  statsSelectedMatchKey.split('___')[2] ? `[${statsSelectedMatchKey.split('___')[2]}]` : '',
                                ].filter(Boolean).join(' • ')}
                              </span>
                            </div>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleExportCsv(false)}
                          className="w-full text-left p-3 sm:px-4 sm:py-3 text-xs text-gray-200 hover:bg-gray-700/80 active:bg-gray-700 rounded-xl sm:rounded-none flex items-center gap-3 transition-colors min-h-[50px] sm:min-h-[46px] border border-gray-700/50 sm:border-0 bg-gray-800/50 sm:bg-transparent"
                        >
                          <div className="p-2 sm:p-0 rounded-lg bg-gray-700/60 sm:bg-transparent flex-shrink-0">
                            <DownloadIcon className="w-4 h-4 text-emerald-400" />
                          </div>
                          <div className="min-w-0 flex-grow">
                            <span className="block font-semibold text-white sm:text-gray-200">
                              {isItalian ? 'Esporta tutte le partite' : 'Export all matches'}
                            </span>
                            <span className="text-[11px] text-gray-400 block font-normal mt-0.5">
                              {isItalian ? 'Tutti gli eventi registrati in formato tabellare' : 'All recorded events in tabular format'}
                            </span>
                          </div>
                        </button>
                      </div>

                      {/* Mobile bottom dismiss button */}
                      <div className="pt-3 sm:hidden">
                        <button
                          type="button"
                          onClick={() => setIsExportMenuOpen(false)}
                          className="w-full py-2.5 text-center text-xs font-semibold text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
                        >
                          {isItalian ? 'Annulla' : 'Cancel'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <StatsView
              events={playerEvents}
              language={language}
              selectedPlayer={selectedPlayer}
              matchDetails={matchDetails}
              onRefreshFromSheet={() => selectedPlayer && handleLoadPlayerHistory(selectedPlayer.id)}
              isLoadingSheet={isLoadingHistory}
              isConnectedGoogle={isConnectedGoogle}
              hasGoogleSheet={!!(selectedPlayer?.spreadsheetId || selectedPlayer?.fileId)}
              selectedMatchKey={statsSelectedMatchKey}
              onSelectMatchKey={setStatsSelectedMatchKey}
            />
          </div>
        )}

        {/* VIEW 6: Info */}
        {view === 'info' && (
          <InfoView language={language} />
        )}
      </main>

      {/* Event Add Modal */}
      {isModalOpen && (
        <EventModal
          onClose={() => setIsModalOpen(false)}
          onSave={handleAddEvent}
          mode={trackingMode}
          clickCoords={clickCoords}
          language={language}
        />
      )}

      {/* Google Sheets Sync Confirmation Dialog */}
      <GoogleSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onConfirm={handleConfirmSaveToSheets}
        player={selectedPlayer}
        matchDetails={matchDetails}
        events={playerEvents}
        isSaving={isSavingMatchToSheets}
        language={language}
      />
    </div>
  );
};

interface NavButtonProps {
  targetView: 'settings' | 'match' | 'players' | 'tracking' | 'stats' | 'info';
  currentView: string;
  onClick: (view: 'settings' | 'match' | 'players' | 'tracking' | 'stats' | 'info') => void;
  disabled?: boolean;
  disabledTooltip?: string;
  children: React.ReactNode;
}

const NavButton: React.FC<NavButtonProps> = ({
  targetView,
  currentView,
  onClick,
  disabled,
  disabledTooltip,
  children,
}) => {
  return (
    <button
      onClick={() => onClick(targetView)}
      disabled={disabled}
      title={disabled ? disabledTooltip : undefined}
      className={`px-3 py-2.5 sm:px-4 sm:py-3 font-semibold text-xs sm:text-sm transition-all border-b-2 whitespace-nowrap active:bg-gray-800/40 ${
        currentView === targetView
          ? 'border-cyan-400 text-cyan-400'
          : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-700'
      } ${disabled ? 'opacity-40 cursor-not-allowed hover:border-transparent hover:text-gray-400' : ''}`}
    >
      {children}
    </button>
  );
};

export default App;
