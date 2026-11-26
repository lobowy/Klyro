import React from 'react';

interface KlyroHeroMarkProps {
  className?: string;
  /** Sweep position from -0.4 to 1.4; undefined hides the sweep beam */
  lightSweep?: number;
  /** Overall brightness / contrast emphasis */
  brightness?: number;
}

/**
 * Renders the exact uploaded glossy silver KLYRO emblem seamlessly on dark surfaces,
 * paired with a razor-sharp diagonal white studio light beam overlay.
 */
export const KlyroHeroMark: React.FC<KlyroHeroMarkProps> = ({
  className = 'w-64 h-44',
  lightSweep,
  brightness = 1.05,
}) => {
  const showBeam = typeof lightSweep === 'number' && lightSweep > -0.35 && lightSweep < 1.35;
  const beamPercent = showBeam ? lightSweep * 100 : -50;

  return (
    <div className={`relative select-none pointer-events-none overflow-hidden ${className}`}>
      <img
        src="/assets/aistudio/IMG_3735_0911aa51.png"
        alt="KLYRO glossy silver K emblem"
        referrerPolicy="no-referrer"
        className="w-full h-full object-contain mix-blend-screen"
        style={{
          filter: `brightness(${brightness}) contrast(1.08)`,
          transform: 'scale(1.55)',
        }}
      />

      {showBeam && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none mix-blend-screen"
          style={{
            background: `linear-gradient(112deg,
              transparent ${beamPercent - 16}%,
              rgba(255,255,255,0.06) ${beamPercent - 8}%,
              rgba(255,255,255,0.82) ${beamPercent}%,
              rgba(255,255,255,0.12) ${beamPercent + 6}%,
              transparent ${beamPercent + 16}%
            )`,
          }}
        />
      )}
    </div>
  );
};

/**
 * Crisp geometric vector silhouette of the Klyro K emblem for 18px-32px UI navbars and cards.
 */
export const KlyroMiniMark: React.FC<{className?: string}> = ({className = 'w-5 h-5'}) => (
  <svg viewBox="0 0 36 32" fill="none" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="klyro-mini-top" x1="4" y1="2" x2="26" y2="26" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="38%" stopColor="#D4D4D8" />
        <stop offset="68%" stopColor="#27272A" />
        <stop offset="100%" stopColor="#E4E4E7" />
      </linearGradient>
      <linearGradient id="klyro-mini-bottom" x1="16" y1="15" x2="31" y2="29" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="48%" stopColor="#52525B" />
        <stop offset="100%" stopColor="#D4D4D8" />
      </linearGradient>
    </defs>
    {/* Upper swept geometric arm */}
    <path
      d="M5 29V18.2C5 15.6 6.1 13.1 8 11.4L17.4 3.4C18.6 2.4 20.1 1.8 21.7 1.8H30.5L11.8 20.3L5 29Z"
      fill="url(#klyro-mini-top)"
      stroke="rgba(255,255,255,0.55)"
      strokeWidth="0.65"
    />
    {/* Lower angled geometric wedge */}
    <path
      d="M15.4 20.4L20.4 15.2C21.5 14.1 23.3 14.1 24.4 15.3L31.8 28.8H21.2C19.8 28.8 18.5 28.2 17.6 27.1L15.4 20.4Z"
      fill="url(#klyro-mini-bottom)"
      stroke="rgba(255,255,255,0.45)"
      strokeWidth="0.65"
    />
  </svg>
);

/**
 * Sculptural glossy obsidian-and-silver K emblem framed inside a tilted silver orbital ring,
 * designed for light pearl-silver homepage surfaces (no black bounding box).
 */
export const KlyroHeroSculpture: React.FC<{className?: string}> = ({
  className = 'w-full max-w-[480px] h-[340px]',
}) => (
  <div className={`relative flex items-center justify-center select-none pointer-events-none ${className}`}>
    {/* Soft studio ambient shadow on the pearl surface */}
    <div
      aria-hidden="true"
      className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[58%] h-10 rounded-full blur-2xl bg-zinc-400/35"
    />

    <svg viewBox="0 0 520 380" fill="none" className="w-full h-full overflow-visible" aria-hidden="true">
      <defs>
        {/* Back orbital ring gradient */}
        <linearGradient id="sculpt-ring-back" x1="30" y1="220" x2="490" y2="140" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#D4D4D8" stopOpacity="0.2" />
          <stop offset="45%" stopColor="#A1A1AA" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#E4E4E7" stopOpacity="0.35" />
        </linearGradient>

        {/* Upper swept blade glossy obsidian-chrome gradient */}
        <linearGradient id="sculpt-blade-top" x1="115" y1="68" x2="310" y2="275" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F4F4F5" />
          <stop offset="18%" stopColor="#D4D4D8" />
          <stop offset="42%" stopColor="#18181B" />
          <stop offset="72%" stopColor="#09090B" />
          <stop offset="92%" stopColor="#52525B" />
          <stop offset="100%" stopColor="#E4E4E7" />
        </linearGradient>

        {/* Specular highlight ribbon across the top curve */}
        <linearGradient id="sculpt-specular-top" x1="120" y1="80" x2="345" y2="130" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#E4E4E7" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#18181B" stopOpacity="0" />
        </linearGradient>

        {/* Lower angled blade glossy obsidian-silver gradient */}
        <linearGradient id="sculpt-blade-bottom" x1="255" y1="175" x2="365" y2="295" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="28%" stopColor="#A1A1AA" />
          <stop offset="58%" stopColor="#18181B" />
          <stop offset="100%" stopColor="#09090B" />
        </linearGradient>

        {/* Front orbital ring metallic rim */}
        <linearGradient id="sculpt-ring-front" x1="60" y1="260" x2="465" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#71717A" stopOpacity="0.7" />
          <stop offset="38%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="68%" stopColor="#A1A1AA" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#E4E4E7" stopOpacity="0.4" />
        </linearGradient>

        <filter id="sculpt-shadow" x="-15%" y="-15%" width="130%" height="135%">
          <feDropShadow dx="0" dy="18" stdDeviation="16" floodColor="#18181B" floodOpacity="0.22" />
        </filter>
      </defs>

      {/* Back half of silver orbital ring */}
      <path
        d="M 52 214 C 36 164, 134 106, 274 96 C 414 86, 492 128, 472 184"
        stroke="url(#sculpt-ring-back)"
        strokeWidth="3.5"
        strokeLinecap="round"
        transform="rotate(-14 260 190)"
      />

      {/* Main Glossy K Sculpture */}
      <g filter="url(#sculpt-shadow)">
        {/* Upper swept blade */}
        <path
          d="M 118 296 L 118 216 C 118 190, 129 166, 148 148 L 238 66 C 252 53, 270 46, 290 46 L 368 46 L 178 258 C 164 274, 144 296, 118 296 Z"
          fill="url(#sculpt-blade-top)"
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="1.2"
        />

        {/* Glossy white curved highlight facet on upper blade */}
        <path
          d="M 122 204 C 124 182, 135 162, 152 146 L 239 67 C 253 55, 270 48, 289 48 L 352 48 L 288 118 C 235 112, 174 142, 122 204 Z"
          fill="url(#sculpt-specular-top)"
          opacity="0.72"
        />

        {/* Lower detached bevel wedge */}
        <path
          d="M 218 224 L 258 178 C 269 165, 288 165, 300 177 L 382 296 L 274 296 C 258 296, 243 288, 234 274 L 218 224 Z"
          fill="url(#sculpt-blade-bottom)"
          stroke="rgba(255,255,255,0.65)"
          strokeWidth="1.2"
        />

        {/* Subtle glossy dome catchlight on lower wedge */}
        <path
          d="M 232 214 L 260 182 C 270 171, 286 171, 296 182 L 325 224 C 296 205, 260 202, 232 214 Z"
          fill="rgba(255,255,255,0.78)"
        />
      </g>

      {/* Front sweeping silver orbital ring crossing in front of K */}
      <path
        d="M 472 184 C 454 236, 356 278, 224 282 C 118 286, 66 258, 52 214"
        stroke="url(#sculpt-ring-front)"
        strokeWidth="4.2"
        strokeLinecap="round"
        transform="rotate(-14 260 190)"
      />
    </svg>
  </div>
);
