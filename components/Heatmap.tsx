import React, { useEffect, useRef, useState, useMemo, useId } from 'react';
import { SoccerEvent, Language } from '../types';

export type HeatmapPalette = 'thermal' | 'magma' | 'classic';

interface HeatmapProps {
  events: SoccerEvent[];
  view: 'parata' | 'side';
  side?: 'left' | 'right';
  language?: Language;
  showControls?: boolean;
}

interface ColorStop {
  stop: number;
  r: number;
  g: number;
  b: number;
  a: number; // 0..255
}

const PALETTE_DEFINITIONS: Record<HeatmapPalette, ColorStop[]> = {
  thermal: [
    { stop: 0.00, r: 14,  g: 165, b: 233, a: 0 },
    { stop: 0.08, r: 14,  g: 165, b: 233, a: 65 },
    { stop: 0.22, r: 6,   g: 182, b: 212, a: 135 },
    { stop: 0.38, r: 34,  g: 197, b: 94,  a: 185 },
    { stop: 0.54, r: 234, g: 179, b: 8,   a: 218 },
    { stop: 0.70, r: 249, g: 115, b: 22,  a: 240 },
    { stop: 0.86, r: 239, g: 68,  b: 68,  a: 250 },
    { stop: 1.00, r: 255, g: 252, b: 250, a: 255 },
  ],
  magma: [
    { stop: 0.00, r: 30,  g: 27,  b: 75,  a: 0 },
    { stop: 0.10, r: 76,  g: 29,  b: 149, a: 70 },
    { stop: 0.26, r: 147, g: 51,  b: 234, a: 145 },
    { stop: 0.45, r: 219, g: 39,  b: 119, a: 195 },
    { stop: 0.65, r: 249, g: 115, b: 22,  a: 228 },
    { stop: 0.82, r: 250, g: 204, b: 21,  a: 248 },
    { stop: 1.00, r: 255, g: 255, b: 255, a: 255 },
  ],
  classic: [
    { stop: 0.00, r: 0,   g: 0,   b: 255, a: 0 },
    { stop: 0.14, r: 0,   g: 80,  b: 255, a: 80 },
    { stop: 0.32, r: 0,   g: 215, b: 255, a: 160 },
    { stop: 0.52, r: 34,  g: 197, b: 94,  a: 195 },
    { stop: 0.72, r: 250, g: 204, b: 21,  a: 225 },
    { stop: 0.88, r: 239, g: 68,  b: 68,  a: 245 },
    { stop: 1.00, r: 255, g: 255, b: 255, a: 255 },
  ],
};

const buildGradientPalette = (stops: ColorStop[]): Uint8ClampedArray => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new Uint8ClampedArray(1024);

  const gradient = ctx.createLinearGradient(0, 0, 256, 0);
  for (const item of stops) {
    gradient.addColorStop(item.stop, `rgba(${item.r}, ${item.g}, ${item.b}, ${item.a / 255})`);
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 1);
  return ctx.getImageData(0, 0, 256, 1).data;
};

// Outcome colors matching SoccerGoal and CornerGoal
const eventOutcomeColors: Record<string, string> = {
  Goal: '#ef4444',
  Deflected: '#f97316',
  Post: '#10b981',
  Saved: '#eab308',
  Blocked: '#22c55e',
  Out: '#6b7280',
  Defense: '#3b82f6',
  Completed: '#22c55e',
  Failed: '#ef4444',
};

// -------------------------------------------------------------
// Goal Net & Pitch Base (Rendered BEHIND the heatmap)
// Maintains the exact geometry of SoccerGoal and CornerGoal
// -------------------------------------------------------------
const ParataGoalBackgroundAndNet: React.FC = () => (
  <g>
    {/* Dark goal canvas background */}
    <rect width="300" height="150" fill="#1F2937" rx="8" />

    {/* Vertical Net Mesh Lines */}
    {Array.from({ length: 23 }).map((_, i) => (
      <line
        key={`net-v-${i}`}
        x1={40 + i * 10}
        y1="30"
        x2={40 + i * 10}
        y2="110"
        stroke="#4B5563"
        strokeWidth="0.5"
        strokeOpacity="0.65"
      />
    ))}

    {/* Horizontal Net Mesh Lines */}
    {Array.from({ length: 7 }).map((_, i) => (
      <line
        key={`net-h-${i}`}
        x1="30"
        y1={40 + i * 10}
        x2="270"
        y2={40 + i * 10}
        stroke="#4B5563"
        strokeWidth="0.5"
        strokeOpacity="0.65"
      />
    ))}
  </g>
);

const SideGoalBackgroundAndNet: React.FC<{ clipId: string }> = ({ clipId }) => (
  <g>
    {/* Dark pitch canvas background */}
    <rect width="300" height="200" fill="#1F2937" rx="8" />

    {/* Pitch ground line behind */}
    <line x1="0" y1="160" x2="300" y2="160" stroke="#4B5563" strokeWidth="2" strokeOpacity="0.8" />

    {/* Clipped Net Mesh */}
    <defs>
      <clipPath id={clipId}>
        <path d="M120 40 L 90 40 L 50 160 L 120 160 Z" />
      </clipPath>
    </defs>

    <g clipPath={`url(#${clipId})`}>
      {Array.from({ length: 8 }).map((_, i) => (
        <line
          key={`side-net-v-${i}`}
          x1={50 + i * 10}
          y1="40"
          x2={50 + i * 10}
          y2="160"
          stroke="#4B5563"
          strokeWidth="0.5"
          strokeOpacity="0.65"
        />
      ))}
      {Array.from({ length: 11 }).map((_, i) => (
        <line
          key={`side-net-h-${i}`}
          x1="50"
          y1={50 + i * 10}
          x2="120"
          y2={50 + i * 10}
          stroke="#4B5563"
          strokeWidth="0.5"
          strokeOpacity="0.65"
        />
      ))}
    </g>
  </g>
);

// -------------------------------------------------------------
// Goal Posts, Crossbar & Pitch Lines (Rendered ON TOP of heatmap)
// Identical styling to SoccerGoal.tsx and CornerGoal.tsx
// -------------------------------------------------------------
const ParataGoalPostsOverlay: React.FC = () => (
  <g>
    {/* Outer Goalposts and Crossbar */}
    <rect
      x="29"
      y="29"
      width="242"
      height="82"
      fill="none"
      stroke="#E5E7EB"
      strokeWidth="2"
      strokeLinejoin="round"
    />

    {/* Goal Line across the mouth */}
    <line x1="30" y1="110" x2="270" y2="110" stroke="#E5E7EB" strokeWidth="2" />

    {/* Green pitch lines extending outside posts */}
    <line x1="0" y1="110" x2="30" y2="110" stroke="#22c55e" strokeWidth="2" strokeOpacity="0.9" />
    <line x1="270" y1="110" x2="300" y2="110" stroke="#22c55e" strokeWidth="2" strokeOpacity="0.9" />
  </g>
);

const SideGoalPostsOverlay: React.FC = () => (
  <g>
    {/* Goal Post outline */}
    <path
      d="M120 40 L 90 40 L 50 160 L 120 160 L 120 40"
      stroke="#E5E7EB"
      strokeWidth="2"
      fill="none"
      strokeLinejoin="round"
    />
  </g>
);

// -------------------------------------------------------------
// Main Heatmap Component
// -------------------------------------------------------------
const Heatmap: React.FC<HeatmapProps> = ({
  events,
  view,
  side,
  language = 'it',
  showControls = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clipId = useId().replace(/:/g, '-');

  const [palette, setPalette] = useState<HeatmapPalette>('thermal');
  const [showEventPoints, setShowEventPoints] = useState<boolean>(false);

  // Cached palette color tables
  const paletteTables = useMemo(() => {
    return {
      thermal: buildGradientPalette(PALETTE_DEFINITIONS.thermal),
      magma: buildGradientPalette(PALETTE_DEFINITIONS.magma),
      classic: buildGradientPalette(PALETTE_DEFINITIONS.classic),
    };
  }, []);

  // High-definition internal canvas resolution (3x super-sampled)
  const canvasWidth = 900;
  const canvasHeight = view === 'parata' ? 450 : 600;

  // Filter valid events
  const validEvents = useMemo(() => {
    return events.filter(
      (e) =>
        typeof e.x === 'number' &&
        !isNaN(e.x) &&
        typeof e.y === 'number' &&
        !isNaN(e.y)
    );
  }, [events]);

  // Primary zone analysis for coach insight
  const hotspotAnalysis = useMemo(() => {
    if (validEvents.length === 0) return null;
    let leftCount = 0;
    let centerCount = 0;
    let rightCount = 0;
    let topCount = 0;
    let bottomCount = 0;

    validEvents.forEach((e) => {
      if (e.x < 38) leftCount++;
      else if (e.x > 62) rightCount++;
      else centerCount++;

      if (e.y < 50) topCount++;
      else bottomCount++;
    });

    const isItalian = language === 'it';
    const isSpanish = language === 'es';

    const hZone =
      leftCount >= rightCount && leftCount >= centerCount
        ? isItalian ? 'Sinistra' : isSpanish ? 'Izquierda' : 'Left'
        : rightCount >= leftCount && rightCount >= centerCount
        ? isItalian ? 'Destra' : isSpanish ? 'Derecha' : 'Right'
        : isItalian ? 'Centro' : isSpanish ? 'Centro' : 'Center';

    const vZone =
      topCount >= bottomCount
        ? isItalian ? 'Alto' : isSpanish ? 'Alto' : 'High'
        : isItalian ? 'Basso' : isSpanish ? 'Bajo' : 'Low';

    return `${hZone} / ${vZone}`;
  }, [validEvents, language]);

  // -------------------------------------------------------------
  // High-Resolution Smooth Gaussian Heatmap Rendering Engine
  // -------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (validEvents.length === 0) return;

    // Offscreen accumulation buffer
    const intensityCanvas = document.createElement('canvas');
    intensityCanvas.width = canvasWidth;
    intensityCanvas.height = canvasHeight;
    const intensityCtx = intensityCanvas.getContext('2d');
    if (!intensityCtx) return;

    // Radius tuned for sports analytics: ~8.5% to 9.5% of canvas width
    const baseRadius = view === 'parata' ? 84 : 96;

    // Draw Gaussian-approximated density footprint for each event
    validEvents.forEach((event) => {
      const px = (event.x / 100) * canvasWidth;
      const py = (event.y / 100) * canvasHeight;

      const grad = intensityCtx.createRadialGradient(px, py, 0, px, py, baseRadius);
      // Multi-stop Hermite/Gaussian falloff for silky smooth thermal bloom
      grad.addColorStop(0.00, 'rgba(0, 0, 0, 0.32)');
      grad.addColorStop(0.15, 'rgba(0, 0, 0, 0.28)');
      grad.addColorStop(0.30, 'rgba(0, 0, 0, 0.21)');
      grad.addColorStop(0.45, 'rgba(0, 0, 0, 0.14)');
      grad.addColorStop(0.60, 'rgba(0, 0, 0, 0.08)');
      grad.addColorStop(0.75, 'rgba(0, 0, 0, 0.035)');
      grad.addColorStop(0.90, 'rgba(0, 0, 0, 0.010)');
      grad.addColorStop(1.00, 'rgba(0, 0, 0, 0.000)');

      intensityCtx.fillStyle = grad;
      intensityCtx.beginPath();
      intensityCtx.arc(px, py, baseRadius, 0, Math.PI * 2);
      intensityCtx.fill();
    });

    const imgData = intensityCtx.getImageData(0, 0, canvasWidth, canvasHeight);
    const data = imgData.data;

    // Calculate maximum accumulated alpha
    let maxAlpha = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > maxAlpha) {
        maxAlpha = data[i];
      }
    }

    if (maxAlpha === 0) return;

    // Dynamic Normalization:
    // Guarantees 1 event creates a warm, natural zone instead of blowing out to 100% white/red,
    // while multiple overlapping events naturally build up into the scorching hot-core.
    const minScaleThreshold = 180;
    const effectiveMax = Math.max(maxAlpha, minScaleThreshold);

    const activePalette = paletteTables[palette];

    // Map intensity to thermal color ramp with subtle contrast curve
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha > 0) {
        // Smooth power curve for rich midtone distinction
        const normalized = Math.min(1, Math.pow(alpha / effectiveMax, 0.92));
        const paletteIdx = Math.floor(normalized * 255) * 4;

        data[i]     = activePalette[paletteIdx];
        data[i + 1] = activePalette[paletteIdx + 1];
        data[i + 2] = activePalette[paletteIdx + 2];
        data[i + 3] = activePalette[paletteIdx + 3];
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [validEvents, palette, view, canvasWidth, canvasHeight, paletteTables]);

  const svgViewBox = view === 'parata' ? '0 0 300 150' : '0 0 300 200';
  const sideTransform = view === 'side' && side === 'left' ? 'translate(300, 0) scale(-1, 1)' : '';

  // Localized UI strings
  const labels = useMemo(() => {
    if (language === 'it') {
      return {
        palette: 'Palette',
        low: 'Bassa',
        high: 'Alta densità',
        thermal: 'Termica',
        magma: 'Magma',
        classic: 'Classica',
        points: 'Punti impatto',
        shots: 'eventi analizzati',
        focus: 'Zona focale',
      };
    }
    if (language === 'es') {
      return {
        palette: 'Paleta',
        low: 'Baja',
        high: 'Alta densidad',
        thermal: 'Térmica',
        magma: 'Magma',
        classic: 'Clásica',
        points: 'Puntos impacto',
        shots: 'eventos analizados',
        focus: 'Zona focal',
      };
    }
    return {
      palette: 'Palette',
      low: 'Low',
      high: 'High density',
      thermal: 'Thermal',
      magma: 'Magma',
      classic: 'Classic',
      points: 'Impact points',
      shots: 'analyzed events',
      focus: 'Focal zone',
    };
  }, [language]);

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Optional Top Controls Bar (Optimized for Mobile, Tablet & Desktop) */}
      {showControls && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2 sm:px-3 sm:py-2 bg-gray-900/70 rounded-xl border border-gray-700/80 text-xs shadow-inner">
          {/* Palette Selector */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-gray-400 font-medium text-[11px] sm:text-xs shrink-0">{labels.palette}:</span>
            <div className="grid grid-cols-3 gap-1 p-0.5 bg-gray-950/80 rounded-lg border border-gray-800/90 flex-grow sm:flex-initial">
              <button
                type="button"
                onClick={() => setPalette('thermal')}
                className={`px-2 sm:px-2.5 py-1 rounded-md font-semibold transition-all flex items-center justify-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs text-center truncate ${
                  palette === 'thermal'
                    ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-400/50'
                    : 'bg-gray-800/90 text-gray-300 hover:bg-gray-750 hover:text-white'
                }`}
                title={language === 'it' ? 'Mappa termica moderna' : language === 'es' ? 'Térmica moderna' : 'Modern sports thermal'}
              >
                <span className="w-2 h-2 rounded-full bg-gradient-to-r from-cyan-400 via-amber-400 to-red-500 shrink-0 inline-block" />
                <span className="truncate">{labels.thermal}</span>
              </button>
              <button
                type="button"
                onClick={() => setPalette('magma')}
                className={`px-2 sm:px-2.5 py-1 rounded-md font-semibold transition-all flex items-center justify-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs text-center truncate ${
                  palette === 'magma'
                    ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-400/50'
                    : 'bg-gray-800/90 text-gray-300 hover:bg-gray-750 hover:text-white'
                }`}
                title={language === 'it' ? 'Spettro Magma / Neon' : language === 'es' ? 'Espectro Magma / Neón' : 'Magma / Neon spectrum'}
              >
                <span className="w-2 h-2 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-400 shrink-0 inline-block" />
                <span className="truncate">{labels.magma}</span>
              </button>
              <button
                type="button"
                onClick={() => setPalette('classic')}
                className={`px-2 sm:px-2.5 py-1 rounded-md font-semibold transition-all flex items-center justify-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs text-center truncate ${
                  palette === 'classic'
                    ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400/50'
                    : 'bg-gray-800/90 text-gray-300 hover:bg-gray-750 hover:text-white'
                }`}
                title={language === 'it' ? 'Spettro Classico Jet' : language === 'es' ? 'Espectro Clásico Jet' : 'Classic jet spectrum'}
              >
                <span className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 via-emerald-400 to-red-500 shrink-0 inline-block" />
                <span className="truncate">{labels.classic}</span>
              </button>
            </div>
          </div>

          {/* Toggle Precise Event Points & Event Count */}
          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t border-gray-800/80 sm:border-0">
            <button
              type="button"
              onClick={() => setShowEventPoints(!showEventPoints)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 text-[11px] sm:text-xs ${
                showEventPoints
                  ? 'bg-emerald-600/90 text-white shadow-sm ring-1 ring-emerald-400/50'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  showEventPoints ? 'bg-white shadow-[0_0_6px_#fff]' : 'bg-gray-500'
                }`}
              />
              <span className="whitespace-nowrap">{labels.points}</span>
            </button>

            {validEvents.length > 0 && (
              <span className="text-gray-300 font-mono text-[11px] bg-gray-800/90 px-2 py-0.5 rounded-md border border-gray-700/80 shrink-0 whitespace-nowrap">
                <strong className="text-cyan-400">{validEvents.length}</strong> {labels.shots}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Goal and Heatmap Visual Container */}
      <div
        className={`w-full relative rounded-xl overflow-hidden shadow-2xl border border-gray-700/70 bg-gray-900 ${
          view === 'parata' ? 'aspect-[2/1]' : 'aspect-[3/2]'
        }`}
      >
        {/* Layer 1 (Underneath): Goal Background, Turf Lines & Net Mesh */}
        <svg
          viewBox={svgViewBox}
          className="w-full h-full absolute inset-0 z-0"
          preserveAspectRatio="none"
          style={{ pointerEvents: 'none' }}
        >
          {view === 'parata' ? (
            <ParataGoalBackgroundAndNet />
          ) : (
            <g transform={sideTransform}>
              <SideGoalBackgroundAndNet clipId={clipId} />
            </g>
          )}
        </svg>

        {/* Layer 2 (Middle): High-Resolution Canvas Heatmap */}
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="w-full h-full absolute inset-0 z-10"
          style={{ pointerEvents: 'none' }}
          aria-label="High definition goalkeeper heat map"
        />

        {/* Layer 3 (On Top): Crisp Goal Posts, Crossbar & Field Extensions */}
        <svg
          viewBox={svgViewBox}
          className="w-full h-full absolute inset-0 z-20"
          preserveAspectRatio="none"
          style={{ pointerEvents: 'none' }}
        >
          {view === 'parata' ? (
            <ParataGoalPostsOverlay />
          ) : (
            <g transform={sideTransform}>
              <SideGoalPostsOverlay />
            </g>
          )}

          {/* Optional Layer 4: Precise Event Markers */}
          {showEventPoints &&
            validEvents.map((event, idx) => {
              const color = eventOutcomeColors[event.outcome] || '#38bdf8';
              return (
                <g key={`pt-${event.id}_${idx}`}>
                  {/* Subtle outer halo */}
                  <circle
                    cx={`${event.x}%`}
                    cy={`${event.y}%`}
                    r="4.5"
                    fill={color}
                    fillOpacity="0.35"
                  />
                  {/* Inner pinpoint dot */}
                  <circle
                    cx={`${event.x}%`}
                    cy={`${event.y}%`}
                    r="2"
                    fill="#ffffff"
                    stroke={color}
                    strokeWidth="1"
                  />
                </g>
              );
            })}
        </svg>
      </div>

      {/* Heatmap Legend and Density Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-1.5 bg-gray-900/40 rounded-lg border border-gray-800 text-[11px] text-gray-400">
        {/* Thermal Density Gradient Bar */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-400">{labels.low}</span>
          <div
            className={`w-32 sm:w-44 h-2.5 rounded-full border border-gray-700/80 shadow-inner ${
              palette === 'thermal'
                ? 'bg-gradient-to-r from-cyan-500/20 via-cyan-400 via-emerald-400 via-amber-400 via-orange-500 to-red-600'
                : palette === 'magma'
                ? 'bg-gradient-to-r from-indigo-950 via-purple-600 via-pink-500 via-orange-500 to-yellow-300'
                : 'bg-gradient-to-r from-blue-700 via-cyan-400 via-green-400 via-yellow-400 to-red-600'
            }`}
          />
          <span className="font-medium text-gray-400">{labels.high}</span>
        </div>

        {/* Focal Zone Insight Badge */}
        {hotspotAnalysis && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">{labels.focus}:</span>
            <span className="text-cyan-400 font-semibold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
              {hotspotAnalysis}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Heatmap;
