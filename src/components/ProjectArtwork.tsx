import React, {useState} from 'react';
import {ArtworkVariant} from '../data/projects';

interface ProjectArtworkProps {
  variant: ArtworkVariant;
  customCoverUrl?: string;
  alt?: string;
  className?: string;
}

/**
 * Renders high-contrast monochrome black, white, and glossy silver geometric artwork
 * or a validated custom cover image with resilient fallback.
 */
export const ProjectArtwork: React.FC<ProjectArtworkProps> = ({
  variant,
  customCoverUrl,
  alt = 'Project cover artwork',
  className = 'w-full h-full',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  if (customCoverUrl && !imgFailed) {
    return (
      <div className={`relative bg-[#070709] overflow-hidden ${className}`}>
        <img
          src={customCoverUrl}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }
  if (variant === 'nova') {
    return (
      <div className={`relative bg-[#070709] flex items-center justify-center overflow-hidden ${className}`}>
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.14) 0%, rgba(0,0,0,0) 68%)',
          }}
        />
        <svg viewBox="0 0 120 120" className="w-20 h-20 relative z-10" fill="none">
          <path
            d="M60 12 C62 44, 76 58, 108 60 C76 62, 62 76, 60 108 C58 76, 44 62, 12 60 C44 58, 58 44, 60 12 Z"
            fill="url(#nova-star)"
          />
          <defs>
            <linearGradient id="nova-star" x1="20" y1="20" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#D4D4D8" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  }

  if (variant === 'zenith') {
    return (
      <div className={`relative bg-[#111114] flex items-center justify-center overflow-hidden ${className}`}>
        <svg viewBox="0 0 320 180" className="w-full h-full" preserveAspectRatio="none" fill="none">
          <defs>
            <linearGradient id="zenith-w1" x1="0" y1="40" x2="320" y2="140" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#3F3F46" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#E4E4E7" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#52525B" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="zenith-fill" x1="0" y1="30" x2="0" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
            </linearGradient>
          </defs>
          <path
            d="M-10 125 C55 45, 115 145, 185 78 C235 30, 285 92, 330 58 L330 190 L-10 190 Z"
            fill="url(#zenith-fill)"
          />
          <path
            d="M-10 125 C55 45, 115 145, 185 78 C235 30, 285 92, 330 58"
            stroke="url(#zenith-w1)"
            strokeWidth="3"
          />
          <path
            d="M-10 92 C60 15, 130 120, 200 54 C250 10, 290 65, 330 40"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="1.8"
          />
        </svg>
      </div>
    );
  }

  if (variant === 'orbit') {
    return (
      <div className={`relative bg-[#070709] flex items-center justify-center overflow-hidden ${className}`}>
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.12) 0%, rgba(0,0,0,0) 65%)',
          }}
        />
        <svg viewBox="0 0 140 120" className="w-24 h-20 relative z-10" fill="none">
          <path
            d="M70 14 L118 98 H94 L70 54 L46 98 H22 L70 14 Z"
            fill="url(#orbit-tri)"
          />
          <path d="M70 68 L84 98 H56 L70 68 Z" fill="#D4D4D8" />
          <defs>
            <linearGradient id="orbit-tri" x1="30" y1="14" x2="105" y2="98" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#A1A1AA" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  }

  if (variant === 'pixelcraft') {
    return (
      <div className={`relative bg-gradient-to-b from-zinc-200 via-zinc-300 to-zinc-600 flex items-end overflow-hidden ${className}`}>
        <svg viewBox="0 0 320 180" className="w-full h-full" preserveAspectRatio="none" fill="none">
          <circle cx="160" cy="48" r="24" fill="rgba(255,255,255,0.75)" />
          <path
            d="M0 145 L42 108 L78 132 L124 88 L170 126 L218 76 L266 118 L320 84 L320 180 L0 180 Z"
            fill="#52525B"
            opacity="0.55"
          />
          <path
            d="M0 160 L58 122 L102 146 L154 106 L204 142 L258 104 L320 138 L320 180 L0 180 Z"
            fill="#18181B"
          />
        </svg>
      </div>
    );
  }

  if (variant === 'stackforge') {
    return (
      <div className={`relative bg-[#09090B] flex items-center justify-center overflow-hidden ${className}`}>
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.16) 0%, rgba(0,0,0,0) 64%)',
          }}
        />
        <svg viewBox="0 0 140 120" className="w-24 h-20 relative z-10" fill="none">
          {[0, 18, 36].map((dy, idx) => (
            <path
              key={dy}
              d={`M70 ${22 + dy} L112 ${42 + dy} L70 ${62 + dy} L28 ${42 + dy} Z`}
              fill={idx === 0 ? '#E4E4E7' : idx === 1 ? '#A1A1AA' : '#52525B'}
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="1"
            />
          ))}
        </svg>
      </div>
    );
  }

  if (variant === 'edusphere') {
    return (
      <div className={`relative bg-gradient-to-b from-zinc-200 to-zinc-300 flex items-center justify-center overflow-hidden ${className}`}>
        <svg viewBox="0 0 140 110" className="w-24 h-20" fill="none">
          <path d="M70 22 L120 44 L70 66 L20 44 L70 22 Z" fill="#18181B" />
          <path
            d="M38 54 V76 C38 83, 52 90, 70 90 C88 90, 102 83, 102 76 V54 L70 68 L38 54 Z"
            fill="#27272A"
          />
          <path d="M112 48 V78" stroke="#18181B" strokeWidth="3" strokeLinecap="round" />
          <circle cx="112" cy="80" r="3.5" fill="#18181B" />
        </svg>
      </div>
    );
  }

  // Default: klyro glossy orbital wave
  return (
    <div className={`relative bg-[#070709] flex items-center justify-center overflow-hidden ${className}`}>
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 75% 65% at 52% 45%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.03) 50%, rgba(0,0,0,0) 80%)',
        }}
      />
      <svg viewBox="0 0 320 180" className="w-full h-full relative z-10" fill="none">
        <path
          d="M-20 155 C60 65, 165 25, 340 42"
          stroke="rgba(255,255,255,0.72)"
          strokeWidth="2.5"
        />
        <path
          d="M-10 175 C95 88, 210 62, 340 88"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
};
