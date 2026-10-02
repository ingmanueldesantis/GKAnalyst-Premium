import React, { useMemo } from 'react';
import { Language } from '../types';
import { translations } from '../utils/translations';
import {
  InformationCircleIcon,
  ExternalLinkIcon,
  GoalkeeperGloveIcon,
  ChartBarIcon,
  GoogleSheetsIcon,
} from './icons';

interface InfoViewProps {
  language: Language;
}

const InfoView: React.FC<InfoViewProps> = ({ language }) => {
  const t = useMemo(() => translations[language] || translations.it, [language]);
  const infoText = t.info || translations.it.info;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header bar */}
      <div className="bg-gray-800 p-5 md:p-6 rounded-xl shadow-lg border border-gray-700 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-950/80 border border-cyan-800/60 rounded-lg text-cyan-400">
            <InformationCircleIcon className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-wide">{infoText.title}</h2>
            <p className="text-sm text-gray-400">{infoText.subtitle}</p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-cyan-900/40 text-cyan-300 border border-cyan-700/50">
          Tecnica e Tattica
        </span>
      </div>

      {/* Main Info Card */}
      <div className="bg-gray-800 p-6 md:p-10 rounded-xl shadow-xl border border-gray-700 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

        <div className="relative space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold bg-gray-900/80 text-cyan-400 border border-cyan-800/50 shadow-sm">
            <GoalkeeperGloveIcon className="w-4 h-4 text-cyan-400" />
            <span>GKAnalytics</span>
          </div>

          {/* Core Author & Contact Box */}
          <div className="bg-gray-900/70 p-6 sm:p-8 md:p-10 rounded-xl border border-gray-700/80 shadow-inner flex flex-col items-center justify-center text-center gap-5 sm:gap-6">
            <div className="space-y-1.5 max-w-2xl mx-auto">
              <p className="text-sm sm:text-base md:text-lg text-gray-300 font-medium">
                {infoText.appBy || 'App realizzata da'}
              </p>
              <h3 className="text-2xl sm:text-3xl md:text-4xl text-cyan-400 font-extrabold tracking-tight whitespace-nowrap">
                Manuel De Santis
              </h3>
              <p className="text-sm sm:text-base md:text-lg text-gray-300 font-medium pt-1">
                {infoText.contactPrompt || 'per contatti e informazioni premere qui'}
              </p>
            </div>

            {/* Primary Contact Button */}
            <a
              href="https://forms.gle/Zobpa9RG7ZrjwgEXA"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-900/30 hover:shadow-cyan-900/50 active:scale-[0.98] transition-all duration-200 text-sm sm:text-base group whitespace-nowrap text-center"
            >
              <span>{infoText.contactBtn || 'Contatti e Informazioni'}</span>
              <ExternalLinkIcon className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>

          {/* Service Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700/60 flex items-start gap-3.5">
              <div className="p-2 bg-cyan-950/60 text-cyan-400 rounded-lg shrink-0 mt-0.5">
                <ChartBarIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {infoText.feature1Title || 'Analisi Prestazioni Portieri'}
                </h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  {infoText.feature1Desc ||
                    'Monitoraggio interattivo di parate, uscite, corner, cross, distribuzione (mani/piedi) e modello xG / xGOT.'}
                </p>
              </div>
            </div>

            <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700/60 flex items-start gap-3.5">
              <div className="p-2 bg-emerald-950/60 text-emerald-400 rounded-lg shrink-0 mt-0.5">
                <GoogleSheetsIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {infoText.feature2Title || 'Integrazione Cloud & Sheets'}
                </h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  {infoText.feature2Desc ||
                    'Salvataggio centralizzato su Google Drive e fogli di calcolo Google Sheets per match e stagioni sportive.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InfoView;
