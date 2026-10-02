import React, { useState, useEffect } from 'react';
import {
  GoalkeeperGloveIcon,
  LockClosedIcon,
  UserIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ShieldCheckIcon,
} from './icons';
import {
  verifyCredentials,
  saveAuthSession,
} from '../services/authService';
import { Language } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (username: string, scadenza: string) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  initialErrorMessage?: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  language,
  onLanguageChange,
  initialErrorMessage = null,
}) => {
  const isItalian = language === 'it';
  const isSpanish = language === 'es';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialErrorMessage);

  useEffect(() => {
    if (initialErrorMessage) {
      setErrorMessage(initialErrorMessage);
    }
  }, [initialErrorMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser) {
      setErrorMessage(
        isItalian
          ? 'Inserisci il tuo nome utente.'
          : isSpanish
          ? 'Introduce tu nombre de usuario.'
          : 'Please enter your username.'
      );
      return;
    }

    if (!cleanPass) {
      setErrorMessage(
        isItalian
          ? 'Inserisci la tua password.'
          : isSpanish
          ? 'Introduce tu contraseña.'
          : 'Please enter your password.'
      );
      return;
    }

    setIsLoading(true);

    try {
      const result = await verifyCredentials(cleanUser, cleanPass);

      if (result.success && result.status === 'ATTIVO') {
        const scadenza = result.scadenza || '';
        // Salva le credenziali e la scadenza in localStorage
        saveAuthSession(cleanUser, cleanPass, scadenza);

        // Notifica sblocco app
        onLoginSuccess(cleanUser, scadenza);
      } else {
        // Messaggi dettagliati a seconda dello stato
        let msg = result.message;
        if (!msg) {
          switch (result.status) {
            case 'DISABILITATO':
              msg = isItalian
                ? 'Account disabilitato dall\'amministratore. Contatta il supporto per riattivarlo.'
                : 'Account disabled by administrator. Contact support.';
              break;
            case 'SCADUTO':
              msg = isItalian
                ? 'Abbonamento o accesso scaduto. Contatta l\'amministratore per rinnovarlo.'
                : 'Subscription or access expired. Contact administrator.';
              break;
            case 'DISPOSITIVO_NON_AUTORIZZATO':
              msg = isItalian
                ? 'Dispositivo non autorizzato per questo account. Contatta l\'amministratore comunicando l\'ID dispositivo.'
                : 'Unauthorized device for this account. Contact administrator.';
              break;
            case 'NON_TROVATO':
              msg = isItalian
                ? 'Credenziali non valide o utente non trovato.'
                : 'Invalid credentials or user not found.';
              break;
            default:
              msg = isItalian
                ? 'Credenziali errate o account non abilitato.'
                : 'Incorrect credentials or account not active.';
          }
        }
        setErrorMessage(msg);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        isItalian
          ? 'Errore durante la connessione al server di autenticazione. Riprova.'
          : 'Authentication server connection error. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-950 via-gray-900 to-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Language Selector in Top Bar */}
      <div className="absolute top-4 right-4 z-10">
        <div className="relative">
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as Language)}
            className="appearance-none bg-gray-900/80 backdrop-blur-md border border-gray-700/80 text-white rounded-xl px-3 py-1.5 pr-8 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer shadow-lg"
            aria-label="Lingua"
          >
            <option value="it">Italiano (IT)</option>
            <option value="en">English (EN)</option>
            <option value="es">Español (ES)</option>
          </select>
          <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Center Authentication Card Container */}
      <div className="w-full max-w-md relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center p-3.5 mb-3 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 shadow-xl shadow-cyan-950/50">
            <GoalkeeperGloveIcon className="w-10 h-10 sm:w-12 sm:h-12" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center justify-center">
            <span>GKAnalytics</span>
          </h1>

          <p className="text-xs sm:text-sm text-gray-400 mt-1 font-medium">
            {isItalian
              ? 'Analisi e tracciamento professionale per portieri'
              : isSpanish
              ? 'Análisis y seguimiento profesional para porteros'
              : 'Professional Goalkeeper Analysis & Performance Tracking'}
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-gray-900/90 backdrop-blur-xl border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 relative">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheckIcon className="w-5 h-5 text-cyan-400" />
              <span>{isItalian ? 'Accesso Riservato' : isSpanish ? 'Acceso Reservado' : 'Member Login'}</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isItalian
                ? 'Inserisci Username e Password per accedere all\'app.'
                : isSpanish
                ? 'Introduce tu usuario y contraseña para acceder.'
                : 'Enter your credentials to access the application.'}
            </p>
          </div>

          {/* Error Message Box */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-950/70 border border-rose-600/70 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in">
              <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <span className="font-semibold block mb-0.5">
                  {isItalian ? 'Accesso non autorizzato' : 'Access Denied'}
                </span>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5" htmlFor="login-username">
                {isItalian ? 'Username' : isSpanish ? 'Nombre de Usuario' : 'Username'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={isItalian ? 'Inserisci username' : 'Enter username'}
                  disabled={isLoading}
                  className="w-full bg-gray-950/70 border border-gray-700/80 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5" htmlFor="login-password">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <LockClosedIcon className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  className="w-full bg-gray-950/70 border border-gray-700/80 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-200 transition-colors"
                  aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                >
                  {showPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-lg shadow-cyan-950/60 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <ArrowPathIcon className="w-4 h-4 animate-spin text-white" />
                    <span>
                      {isItalian ? 'Verifica in corso...' : isSpanish ? 'Verificando...' : 'Verifying...'}
                    </span>
                  </>
                ) : (
                  <span>{isItalian ? 'Accedi' : isSpanish ? 'Acceder' : 'Sign In'}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
