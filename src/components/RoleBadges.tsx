import React from 'react';
import {CheckCircle2, Code2, Crown, ShieldCheck, Sparkles} from 'lucide-react';
import {RoleBadge} from '../lib/firebase';

interface RoleBadgesProps {
  badges?: RoleBadge[];
  compact?: boolean;
}

const BADGE_META: Record<
  RoleBadge,
  {icon: React.ComponentType<{className?: string}>; tier: 'founder' | 'primary' | 'secondary'}
> = {
  Founder: {icon: Crown, tier: 'founder'},
  Owner: {icon: Sparkles, tier: 'primary'},
  Moderator: {icon: ShieldCheck, tier: 'secondary'},
  Developer: {icon: Code2, tier: 'secondary'},
  Verified: {icon: CheckCircle2, tier: 'secondary'},
};

export const RoleBadges: React.FC<RoleBadgesProps> = ({badges, compact = false}) => {
  if (!badges || badges.length === 0) return null;

  const sorted = [...badges].sort((a, b) => {
    const order: RoleBadge[] = ['Founder', 'Owner', 'Moderator', 'Developer', 'Verified'];
    return order.indexOf(a) - order.indexOf(b);
  });

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {sorted.map((badge) => {
        const meta = BADGE_META[badge] || {icon: CheckCircle2, tier: 'secondary'};
        const Icon = meta.icon;
        const styleClass =
          meta.tier === 'founder'
            ? 'bg-gradient-to-r from-zinc-950 via-zinc-800 to-zinc-950 dark:from-white dark:via-zinc-200 dark:to-white text-white dark:text-zinc-950 border border-zinc-600 dark:border-zinc-300 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.45)]'
            : meta.tier === 'primary'
              ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 border border-zinc-950 dark:border-white'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700';

        return (
          <span
            key={badge}
            className={`inline-flex items-center gap-1 rounded-full font-mono uppercase tracking-wider whitespace-nowrap ${
              compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[10px]'
            } ${styleClass}`}
          >
            <Icon className="w-3 h-3 shrink-0" />
            <span>{badge}</span>
          </span>
        );
      })}
    </div>
  );
};
