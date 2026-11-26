import React from 'react';
import {Crown} from 'lucide-react';
import {ProfileRimId} from '../lib/wallets';

interface AvatarWithRimProps {
  src?: string;
  name: string;
  rim?: ProfileRimId;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  shape?: 'circle' | 'rounded';
  isFounder?: boolean;
  showFounderBadge?: boolean;
}

const SIZE_MAP = {
  xs: {outer: 'w-6 h-6', text: 'text-[9px]', badge: 'w-3 h-3 -top-0.5 -right-0.5'},
  sm: {outer: 'w-9 h-9', text: 'text-[12px]', badge: 'w-4 h-4 -top-1 -right-1'},
  md: {outer: 'w-11 h-11', text: 'text-[14px]', badge: 'w-4 h-4 -top-1 -right-1'},
  lg: {outer: 'w-16 h-16', text: 'text-[20px]', badge: 'w-5 h-5 -top-1.5 -right-1.5'},
};

const RIM_CLASS_MAP: Record<ProfileRimId, string> = {
  none: 'rim-none',
  silver: 'rim-silver',
  obsidian: 'rim-obsidian',
  platinum: 'rim-platinum',
  mercury: 'rim-mercury',
  'founder-crown': 'rim-founder-crown',
};

export const AvatarWithRim: React.FC<AvatarWithRimProps> = ({
  src,
  name,
  rim = 'silver',
  size = 'md',
  shape = 'circle',
  isFounder = false,
  showFounderBadge = false,
}) => {
  const s = SIZE_MAP[size];
  const radiusClass = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';
  const innerRadiusClass = shape === 'circle' ? 'rounded-full' : 'rounded-[13px]';
  const effectiveRim: ProfileRimId =
    rim === 'founder-crown' || isFounder ? (rim === 'none' ? 'none' : rim || 'founder-crown') : rim;
  const rimClass = RIM_CLASS_MAP[effectiveRim] || RIM_CLASS_MAP.silver;
  const initials = (name || 'KL').trim().slice(0, size === 'xs' ? 1 : 2).toUpperCase();

  return (
    <div className={`relative inline-flex shrink-0 ${s.outer} ${radiusClass} ${rimClass}`}>
      <div
        className={`w-full h-full ${innerRadiusClass} overflow-hidden bg-zinc-950 text-white flex items-center justify-center ring-1 ring-white/80`}
      >
        {src ? (
          <img
            src={src}
            alt={name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className={`${s.text} font-semibold tracking-tight select-none`}>{initials}</span>
        )}
      </div>

      {showFounderBadge && isFounder && (
        <span
          title="Klyro Founder"
          className={`absolute ${s.badge} rounded-full bg-zinc-950 text-white border border-white/80 shadow flex items-center justify-center`}
        >
          <Crown className="w-[62%] h-[62%]" />
        </span>
      )}
    </div>
  );
};
