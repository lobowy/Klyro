import React, {useState} from 'react';
import {ArrowRight, Check} from 'lucide-react';
import {COMMUNITIES, LEARN_GUIDES} from '../data/projects';

interface CommunityViewProps {
  joinedCommunities: Record<string, boolean>;
  onToggleJoin: (name: string) => void;
  onExploreProjects: () => void;
}

export const CommunityView: React.FC<CommunityViewProps> = ({
  joinedCommunities,
  onToggleJoin,
  onExploreProjects,
}) => {
  return (
    <section className="max-w-[1160px] mx-auto px-6 py-12 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <h1 className="text-[36px] font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Community
          </h1>
          <p className="text-[15px] text-zinc-500 dark:text-zinc-400 mt-1">
            Connect with 100+ creator collectives, builders, and independent studios.
          </p>
        </div>
        <button
          type="button"
          onClick={onExploreProjects}
          className="h-10 px-5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer"
        >
          <span>Browse Projects</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {COMMUNITIES.map((c) => {
          const isJoined = Boolean(joinedCommunities[c.name]);
          return (
            <div
              key={c.name}
              className="rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/90 dark:border-zinc-800 p-6 flex flex-col justify-between gap-5"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-[18px] font-semibold text-zinc-950 dark:text-zinc-50">
                    {c.name}
                  </h2>
                  <span className="text-[12px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                    {c.members}
                  </span>
                </div>
                <div className="text-[12px] text-zinc-500 dark:text-zinc-400">{c.focus}</div>
                <p className="text-[14px] text-zinc-600 dark:text-zinc-400 leading-relaxed pt-1">
                  {c.summary}
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => onToggleJoin(c.name)}
                  className={`h-9 px-4 rounded-full text-[12px] font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isJoined
                      ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 border-zinc-950 dark:border-white'
                      : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700 hover:border-zinc-500'
                  }`}
                >
                  {isJoined && <Check className="w-3.5 h-3.5" />}
                  <span>{isJoined ? 'Joined' : 'Join Collective'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

interface LearnViewProps {
  completedGuides: Record<string, boolean>;
  onToggleComplete: (guideNumber: string) => void;
  onStartLaunch: () => void;
}

export const LearnView: React.FC<LearnViewProps> = ({
  completedGuides,
  onToggleComplete,
  onStartLaunch,
}) => {
  const [selectedGuide, setSelectedGuide] = useState<string | null>(null);

  return (
    <section className="max-w-[1160px] mx-auto px-6 py-12 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <h1 className="text-[36px] font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Learn
          </h1>
          <p className="text-[15px] text-zinc-500 dark:text-zinc-400 mt-1">
            Guides and playbooks for designing, launching, and growing on Klyro.
          </p>
        </div>
        <button
          type="button"
          onClick={onStartLaunch}
          className="h-10 px-5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer"
        >
          <span>Create a Project</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200/90 dark:border-zinc-800 overflow-hidden">
        {LEARN_GUIDES.map((g) => {
          const expanded = selectedGuide === g.number;
          const isCompleted = Boolean(completedGuides[g.number]);
          return (
            <div key={g.number} className="p-6 md:p-7">
              <button
                type="button"
                onClick={() => setSelectedGuide(expanded ? null : g.number)}
                className="w-full text-left flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group"
              >
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-[13px] text-zinc-400">{g.number}.</span>
                  <div>
                    <h2 className="text-[18px] font-semibold text-zinc-950 dark:text-zinc-50 group-hover:underline">
                      {g.title}
                    </h2>
                    <div className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1">
                      {g.category} · {g.readTime}
                      {isCompleted ? ' · Read' : ''}
                    </div>
                  </div>
                </div>

                <span className="text-[12px] font-medium text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                  {expanded ? 'Close' : 'Read Guide'}
                </span>
              </button>

              {expanded && (
                <div className="mt-4 md:pl-9 space-y-3 max-w-2xl">
                  <p className="text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {g.summary}
                  </p>
                  <button
                    type="button"
                    onClick={() => onToggleComplete(g.number)}
                    className={`h-8 px-3.5 rounded-full text-[12px] font-medium border inline-flex items-center gap-1.5 cursor-pointer ${
                      isCompleted
                        ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 border-zinc-950 dark:border-white'
                        : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                    }`}
                  >
                    {isCompleted && <Check className="w-3.5 h-3.5" />}
                    <span>{isCompleted ? 'Marked as Read' : 'Mark as Read'}</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
