import React, {useEffect, useRef, useState} from 'react';
import {ArrowRight, Check, CheckCircle2, Search, Shield, Sparkles, TrendingUp} from 'lucide-react';
import {KlyroHeroMark, KlyroMiniMark} from './KlyroMark';
import {
  clamp,
  easeInOutCubic,
  easeInOutQuart,
  easeOutCubic,
  easeOutExpo,
  lerp,
  segment,
} from '../lib/timeline';

interface CinemaStageProps {
  time: number;
}

const VIRTUAL_W = 1280;
const VIRTUAL_H = 720;

export const CinemaStage: React.FC<CinemaStageProps> = ({time}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / VIRTUAL_W);
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // =========================================================================
  // ACT I (0.00s - 3.00s): Logo Reveal
  // =========================================================================
  const act1In = easeOutCubic(segment(time, 0.28, 1.65));
  const act1Out = 1 - easeInOutCubic(segment(time, 2.58, 3.05));
  const act1Opacity = act1In * act1Out;
  const act1Scale = lerp(0.9, 1.0, easeOutExpo(segment(time, 0.28, 2.3))) * lerp(1, 1.08, 1 - act1Out);
  const act1Sweep = lerp(-0.35, 1.35, easeInOutCubic(segment(time, 0.78, 2.25)));
  const act1WordmarkIn = easeOutCubic(segment(time, 1.68, 2.42));

  // =========================================================================
  // ACT II (3.00s - 6.20s): Platform Thesis & Obsidian Hero
  // =========================================================================
  const act2In = easeOutCubic(segment(time, 2.72, 3.45));
  const act2Out = 1 - easeInOutCubic(segment(time, 5.8, 6.32));
  const act2Opacity = act2In * act2Out;
  const act2RotY = lerp(-8.5, 1.2, easeInOutCubic(segment(time, 2.72, 5.85)));
  const act2RotX = lerp(5.0, 0.0, easeOutCubic(segment(time, 2.72, 4.6)));
  const act2Scale = lerp(0.88, 1.0, easeOutExpo(segment(time, 2.72, 4.1))) * lerp(1, 1.06, 1 - act2Out);
  const act2HeroTextIn = easeOutCubic(segment(time, 3.05, 3.85));
  const act2StatsIn = easeOutCubic(segment(time, 3.45, 4.35));
  const act2CountProg = easeOutCubic(segment(time, 3.35, 5.1));
  const act2OrbitSweep = lerp(-0.2, 1.2, easeInOutCubic(segment(time, 3.6, 5.4)));

  // =========================================================================
  // ACT III (6.20s - 9.50s): 4-Step Launch Studio
  // =========================================================================
  const act3In = easeOutCubic(segment(time, 5.95, 6.55));
  const act3Out = 1 - easeInOutCubic(segment(time, 9.1, 9.6));
  const act3Opacity = act3In * act3Out;
  const act3Scale = lerp(0.92, 1.0, easeOutExpo(segment(time, 5.95, 7.2))) * lerp(1, 0.96, 1 - act3Out);
  const act3RotY = lerp(5.5, -1.0, easeInOutCubic(segment(time, 5.95, 9.2)));

  const typedTitleFull = 'Klyro Genesis';
  const typedCount = Math.floor(lerp(0, typedTitleFull.length, segment(time, 6.35, 7.25)));
  const typedTitle = typedTitleFull.slice(0, typedCount);

  const typedDescFull = 'Fair-launch bonding curve · Zero creator tax · Instant liquidity.';
  const typedDescCount = Math.floor(lerp(0, typedDescFull.length, segment(time, 6.9, 7.85)));
  const typedDesc = typedDescFull.slice(0, typedDescCount);

  const wizardStep =
    time < 7.05 ? 1 : time < 7.85 ? 2 : time < 8.55 ? 3 : 4;
  const buttonPress =
    time >= 8.48 && time <= 8.78
      ? 1 - 0.045 * Math.sin(((time - 8.48) / 0.3) * Math.PI)
      : 1;
  const curveDrawProg = easeInOutCubic(segment(time, 7.35, 8.75));
  const publishedBadgeIn = easeOutCubic(segment(time, 8.62, 9.05));

  // =========================================================================
  // ACT IV (9.50s - 12.80s): Discover Grid & Creator Dashboard
  // =========================================================================
  const act4In = easeOutCubic(segment(time, 9.25, 9.8));
  const act4Out = 1 - easeInOutCubic(segment(time, 12.45, 12.95));
  const act4Opacity = act4In * act4Out;
  const act4Slide = easeInOutQuart(segment(time, 10.75, 11.45));
  const act4DiscoverX = lerp(0, -1180, act4Slide);
  const act4DashX = lerp(1180, 0, act4Slide);
  const act4ChartDraw = easeInOutCubic(segment(time, 11.2, 12.35));
  const act4PeakPop = easeOutExpo(segment(time, 12.0, 12.45));
  const act4DashCount = easeOutCubic(segment(time, 11.05, 12.2));

  // =========================================================================
  // ACT V (12.80s - 15.00s): Final Architectural Lockup
  // =========================================================================
  const act5In = easeOutCubic(segment(time, 12.7, 13.5));
  const act5Scale = lerp(0.93, 1.0, easeOutExpo(segment(time, 12.7, 14.3)));
  const act5Sweep = lerp(-0.3, 1.3, easeInOutCubic(segment(time, 13.25, 14.35)));
  const act5TextIn = easeOutCubic(segment(time, 13.55, 14.35));

  const showAct1 = time < 3.2;
  const showAct2 = time >= 2.65 && time <= 6.4;
  const showAct3 = time >= 5.9 && time <= 9.7;
  const showAct4 = time >= 9.2 && time <= 13.05;
  const showAct5 = time >= 12.65;

  // Chart path length for deterministic SVG stroke-dashoffset
  const chartPathLen = 580;

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black overflow-hidden select-none"
    >
      <div
        style={{
          width: VIRTUAL_W,
          height: VIRTUAL_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
        className="relative bg-black text-white overflow-hidden"
      >
        {/* Subtle top-center studio key light backdrop (never neon, pure silver/white falloff) */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 72% 48% at 50% 0%, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.015) 45%, rgba(0,0,0,0) 78%)',
          }}
        />

        {/* ===============================================================
            ACT I: 0-3s — LOGO REVEAL
           =============================================================== */}
        {showAct1 && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{
              opacity: act1Opacity,
              transform: `scale(${act1Scale})`,
            }}
          >
            {/* Moving studio light beam plane behind & across the K */}
            <div className="relative flex items-center justify-center w-[420px] h-[270px]">
              <KlyroHeroMark
                className="w-[380px] h-[250px]"
                lightSweep={act1Sweep}
                brightness={lerp(0.55, 1.12, act1In)}
              />

              {/* Crisp razor light beam traveling over dark space */}
              {act1Sweep > -0.3 && act1Sweep < 1.3 && (
                <div
                  aria-hidden="true"
                  className="absolute inset-y-[-120px] w-[2px] pointer-events-none"
                  style={{
                    left: `${act1Sweep * 100}%`,
                    transform: 'rotate(22deg)',
                    background:
                      'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)',
                    boxShadow: '0 0 28px 4px rgba(255,255,255,0.18)',
                    opacity: Math.sin(clamp((act1Sweep + 0.3) / 1.6) * Math.PI),
                  }}
                />
              )}
            </div>

            {/* KLYRO Architectural Wordmark */}
            <div
              className="mt-4 flex flex-col items-center"
              style={{
                opacity: act1WordmarkIn,
                transform: `translateY(${lerp(12, 0, act1WordmarkIn)}px)`,
              }}
            >
              <div
                className="h-[1px] bg-gradient-to-r from-transparent via-zinc-400/70 to-transparent mb-5"
                style={{width: `${lerp(0, 88, act1WordmarkIn)}px`}}
              />
              <span className="text-[22px] font-semibold tracking-[0.42em] text-zinc-100 pl-[0.42em]">
                KLYRO
              </span>
            </div>
          </div>
        )}

        {/* ===============================================================
            ACT II: 3.0-6.2s — OBSIDIAN GLASS HERO PLATFORM
           =============================================================== */}
        {showAct2 && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              opacity: act2Opacity,
              perspective: '1600px',
            }}
          >
            <div
              className="w-[1088px] h-[612px] rounded-[22px] obsidian-glass flex flex-col justify-between px-11 py-8 relative overflow-hidden"
              style={{
                transform: `scale(${act2Scale}) rotateY(${act2RotY}deg) rotateX(${act2RotX}deg)`,
                transformStyle: 'preserve-3d',
              }}
            >
              {/* Subtle metallic sheen sweep along top edge */}
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-[1px]"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 48%, transparent 100%)',
                }}
              />

              {/* Internal Top Navigation Bar */}
              <div className="flex items-center justify-between border-b border-white/[0.07] pb-5">
                <div className="flex items-center gap-2.5">
                  <KlyroMiniMark className="w-6 h-6" />
                  <span className="text-[17px] font-semibold tracking-tight text-white">Klyro</span>
                </div>

                <div className="flex items-center gap-8 text-[13px] font-medium text-zinc-400">
                  <span className="text-white border-b border-white pb-0.5">Discover</span>
                  <span>Launch</span>
                  <span>Studio</span>
                  <span>Community</span>
                  <span>Learn</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full border border-white/10 bg-white/[0.04] flex items-center justify-center text-zinc-400">
                    <Search className="w-3.5 h-3.5" />
                  </div>
                  <div className="px-4 py-2 rounded-full bg-white text-black text-[12px] font-semibold flex items-center gap-1.5">
                    <span>Get Started</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>

              {/* Hero Split */}
              <div className="grid grid-cols-12 items-center gap-8 my-auto py-4">
                <div
                  className="col-span-6 space-y-5"
                  style={{
                    opacity: act2HeroTextIn,
                    transform: `translateY(${lerp(16, 0, act2HeroTextIn)}px)`,
                  }}
                >
                  <h2 className="text-[54px] leading-[1.04] font-semibold tracking-[-0.03em] text-white">
                    Everything starts with an <span className="silver-text">idea.</span>
                  </h2>
                  <p className="text-[16px] leading-relaxed text-zinc-400 max-w-[430px]">
                    Launch creator tokens, rally communities, and scale fair-curve markets in seconds.
                  </p>
                  <div className="flex items-center gap-3 pt-2">
                    <div className="px-5 py-2.5 rounded-full bg-white text-black text-[13px] font-semibold flex items-center gap-2">
                      <span>Explore Launches</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                    <div className="px-5 py-2.5 rounded-full obsidian-subglass text-zinc-200 text-[13px] font-medium">
                      Create Token
                    </div>
                  </div>
                </div>

                {/* Right Sculptural Orbital K */}
                <div className="col-span-6 relative flex items-center justify-center h-[320px]">
                  <svg
                    viewBox="0 0 460 280"
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    fill="none"
                  >
                    <defs>
                      <linearGradient id="silver-orbit" x1="0" y1="0" x2="460" y2="280" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.04)" />
                        <stop offset="35%" stopColor="rgba(255,255,255,0.55)" />
                        <stop offset="65%" stopColor="rgba(161,161,170,0.22)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
                      </linearGradient>
                    </defs>
                    <ellipse
                      cx="230"
                      cy="146"
                      rx="198"
                      ry="68"
                      transform="rotate(-17 230 146)"
                      stroke="url(#silver-orbit)"
                      strokeWidth="1.6"
                    />
                  </svg>
                  <KlyroHeroMark className="w-[300px] h-[200px]" lightSweep={act2OrbitSweep} />
                </div>
              </div>

              {/* Bottom Proof Strip */}
              <div
                className="grid grid-cols-4 border-t border-white/[0.08] pt-5"
                style={{opacity: act2StatsIn}}
              >
                <div>
                  <div className="text-[22px] font-semibold tracking-tight tabular-nums text-white">
                    {Math.round(lerp(120, 1000, act2CountProg)) === 1000
                      ? '1M+'
                      : `${Math.round(lerp(120, 990, act2CountProg))}K+`}
                  </div>
                  <div className="text-[12px] text-zinc-500 mt-0.5">Tokens Launched</div>
                </div>
                <div className="border-l border-white/[0.07] pl-6">
                  <div className="text-[22px] font-semibold tracking-tight tabular-nums text-white">
                    {Math.round(lerp(40, 500, act2CountProg))}K+
                  </div>
                  <div className="text-[12px] text-zinc-500 mt-0.5">Creators</div>
                </div>
                <div className="border-l border-white/[0.07] pl-6">
                  <div className="text-[22px] font-semibold tracking-tight tabular-nums text-white">
                    {Math.round(lerp(12, 100, act2CountProg))}+
                  </div>
                  <div className="text-[12px] text-zinc-500 mt-0.5">Communities</div>
                </div>
                <div className="border-l border-white/[0.07] pl-6 flex items-center gap-3">
                  <Shield className="w-4 h-4 text-zinc-300 shrink-0" />
                  <div>
                    <div className="text-[14px] font-semibold text-white">Fast &amp; Verified</div>
                    <div className="text-[12px] text-zinc-500">Audited bonding curves</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===============================================================
            ACT III: 6.2-9.5s — 4-STEP LAUNCH STUDIO
           =============================================================== */}
        {showAct3 && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              opacity: act3Opacity,
              perspective: '1600px',
            }}
          >
            <div
              className="w-[1040px] h-[590px] rounded-[22px] obsidian-glass px-11 py-9 flex flex-col justify-between relative overflow-hidden"
              style={{
                transform: `scale(${act3Scale}) rotateY(${act3RotY}deg)`,
              }}
            >
              {/* Top Mini Header + 4-Step Progress Bar */}
              <div className="flex items-center justify-between border-b border-white/[0.07] pb-6">
                <div className="flex items-center gap-2.5">
                  <KlyroMiniMark className="w-5 h-5" />
                  <span className="text-[15px] font-semibold text-white">Klyro Studio</span>
                </div>

                <div className="flex items-center gap-4">
                  {[
                    {num: 1, name: 'Details'},
                    {num: 2, name: 'Tokenomics'},
                    {num: 3, name: 'Preview'},
                    {num: 4, name: 'Publish'},
                  ].map((s, idx) => {
                    const active = wizardStep === s.num;
                    const done = wizardStep > s.num;
                    return (
                      <React.Fragment key={s.num}>
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-full text-[12px] font-mono font-medium flex items-center justify-center transition-colors ${
                              active || done
                                ? 'bg-white text-black'
                                : 'bg-white/[0.06] text-zinc-500 border border-white/10'
                            }`}
                          >
                            {done ? <Check className="w-3.5 h-3.5" /> : s.num}
                          </div>
                          <span
                            className={`text-[13px] font-medium ${
                              active || done ? 'text-white' : 'text-zinc-500'
                            }`}
                          >
                            {s.name}
                          </span>
                        </div>
                        {idx < 3 && (
                          <div
                            className={`w-10 h-[1px] ${
                              done ? 'bg-white/70' : 'bg-white/10'
                            }`}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                <div className="text-[12px] font-mono text-zinc-400 tabular-nums">
                  {publishedBadgeIn > 0.2 ? 'Ready on Solana' : 'Draft Mode'}
                </div>
              </div>

              {/* Studio Body: Form + Live Preview Card */}
              <div className="grid grid-cols-12 gap-10 items-center my-auto">
                <div className="col-span-7 space-y-5">
                  <div>
                    <h3 className="text-[32px] font-semibold tracking-tight text-white">
                      Launch Your Project
                    </h3>
                    <p className="text-[14px] text-zinc-400 mt-1">
                      Configure your creator token, supply curve, and community identity.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-[12px] text-zinc-400 mb-1.5">
                        <span>Project Name</span>
                        <span className="font-mono text-zinc-300">$KLYR</span>
                      </div>
                      <div className="h-12 rounded-xl obsidian-subglass px-4 flex items-center justify-between text-[15px] text-white">
                        <span>
                          {typedTitle}
                          {typedCount < typedTitleFull.length && (
                            <span className="inline-block w-[1.5px] h-4 bg-white ml-0.5 align-middle" />
                          )}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-500">VERIFIED HANDLE</span>
                      </div>
                    </div>

                    <div>
                      <div className="text-[12px] text-zinc-400 mb-1.5">Thesis &amp; Curve</div>
                      <div className="h-24 rounded-xl obsidian-subglass p-4 text-[14px] leading-relaxed text-zinc-300">
                        {typedDesc}
                        {typedDescCount > 0 && typedDescCount < typedDescFull.length && (
                          <span className="inline-block w-[1.5px] h-4 bg-white ml-0.5 align-middle" />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-1">
                      <div className="rounded-xl obsidian-subglass p-3">
                        <div className="text-[11px] text-zinc-500">Total Supply</div>
                        <div className="text-[15px] font-mono font-medium text-white mt-0.5 tabular-nums">
                          1,000,000,000
                        </div>
                      </div>
                      <div className="rounded-xl obsidian-subglass p-3">
                        <div className="text-[11px] text-zinc-500">Creator Fee</div>
                        <div className="text-[15px] font-mono font-medium text-white mt-0.5 tabular-nums">
                          0.50%
                        </div>
                      </div>
                      <div className="rounded-xl obsidian-subglass p-3">
                        <div className="text-[11px] text-zinc-500">Migration Cap</div>
                        <div className="text-[15px] font-mono font-medium text-white mt-0.5 tabular-nums">
                          $69,000
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-1">
                    <div
                      className="w-full h-12 rounded-full bg-white text-black text-[14px] font-semibold flex items-center justify-center gap-2 transition-transform"
                      style={{transform: `scale(${buttonPress})`}}
                    >
                      <span>{wizardStep === 4 ? 'Publish Launch' : 'Continue'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Live Preview Card */}
                <div className="col-span-5">
                  <div className="rounded-2xl obsidian-subglass p-5 space-y-4 relative overflow-hidden">
                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                      <span>LIVE PREVIEW</span>
                      <span>STEP {wizardStep} / 4</span>
                    </div>

                    {/* Monochrome artwork canvas */}
                    <div className="h-[190px] rounded-xl bg-black border border-white/[0.08] relative flex items-center justify-center overflow-hidden">
                      <div
                        aria-hidden="true"
                        className="absolute inset-0"
                        style={{
                          background:
                            'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.12) 0%, rgba(0,0,0,0) 70%)',
                        }}
                      />
                      <KlyroHeroMark
                        className="w-48 h-32"
                        lightSweep={lerp(-0.2, 1.2, segment(time, 7.0, 8.7))}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-black border border-white/15 flex items-center justify-center">
                          <KlyroMiniMark className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 text-[15px] font-semibold text-white">
                            <span>{typedTitle || 'Klyro Genesis'}</span>
                            <CheckCircle2 className="w-3.5 h-3.5 text-zinc-300" />
                          </div>
                          <div className="text-[12px] text-zinc-400">Create. Launch. Own.</div>
                        </div>
                      </div>
                      <span className="text-[12px] font-mono text-zinc-300">$KLYR</span>
                    </div>

                    {/* Mini bonding curve preview */}
                    <div className="pt-2 border-t border-white/[0.07]">
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-2">
                        <span>Bonding Curve Projection</span>
                        <span className="font-mono text-white tabular-nums">
                          {Math.round(curveDrawProg * 100)}% Sync
                        </span>
                      </div>
                      <svg viewBox="0 0 280 54" className="w-full h-12" fill="none">
                        <path
                          d="M 4 48 C 70 46, 135 38, 195 22 C 230 13, 255 8, 276 5"
                          stroke="rgba(255,255,255,0.12)"
                          strokeWidth="1.5"
                        />
                        <path
                          d="M 4 48 C 70 46, 135 38, 195 22 C 230 13, 255 8, 276 5"
                          stroke="#FFFFFF"
                          strokeWidth="2"
                          strokeDasharray="310"
                          strokeDashoffset={310 * (1 - curveDrawProg)}
                        />
                      </svg>
                    </div>

                    {publishedBadgeIn > 0.05 && (
                      <div
                        className="rounded-xl bg-white text-black px-4 py-2.5 text-[12px] font-semibold flex items-center justify-between"
                        style={{
                          opacity: publishedBadgeIn,
                          transform: `translateY(${lerp(8, 0, publishedBadgeIn)}px)`,
                        }}
                      >
                        <span>Contract Deployed</span>
                        <span className="font-mono">0x7f...KLYR</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===============================================================
            ACT IV: 9.5-12.8s — DISCOVER GRID & CREATOR DASHBOARD
           =============================================================== */}
        {showAct4 && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{opacity: act4Opacity}}
          >
            {/* Beat 1: Discover Marketplace */}
            <div
              className="absolute w-[1088px] h-[612px] rounded-[22px] obsidian-glass px-11 py-9 flex flex-col justify-between"
              style={{
                transform: `translateX(${act4DiscoverX}px)`,
                opacity: 1 - act4Slide,
              }}
            >
              <div className="flex items-center justify-between border-b border-white/[0.07] pb-5">
                <div className="flex items-center gap-2.5">
                  <KlyroMiniMark className="w-5 h-5" />
                  <span className="text-[16px] font-semibold text-white">Klyro</span>
                </div>
                <div className="flex items-center gap-7 text-[13px] text-zinc-400">
                  <span className="text-white font-medium">Discover</span>
                  <span>Launch</span>
                  <span>Studio</span>
                  <span>Community</span>
                </div>
                <div className="text-[12px] font-mono text-zinc-400">SOLANA MAINNET</div>
              </div>

              <div className="space-y-2 mt-4">
                <h3 className="text-[34px] font-semibold tracking-tight text-white">Discover</h3>
                <p className="text-[14px] text-zinc-400">
                  Explore trending launches, creator ecosystems, and live bonding curves.
                </p>
              </div>

              {/* Filter tabs */}
              <div className="flex items-center justify-between my-4">
                <div className="flex items-center gap-2">
                  {['All', 'Creators', 'Culture', 'AI', 'Design', 'Gaming'].map((tab, i) => (
                    <span
                      key={tab}
                      className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium ${
                        i === 0
                          ? 'bg-white text-black'
                          : 'obsidian-subglass text-zinc-400'
                      }`}
                    >
                      {tab}
                    </span>
                  ))}
                </div>
                <span className="text-[12px] text-zinc-300 font-medium px-3.5 py-1.5 rounded-full obsidian-subglass">
                  Trending
                </span>
              </div>

              {/* 3 Monochrome Launch Cards */}
              <div className="grid grid-cols-3 gap-6 flex-1 items-stretch pb-1">
                {[
                  {
                    name: 'Nova Studio',
                    ticker: '$NOVA',
                    desc: 'Create. Innovate. Share.',
                    holders: '128K',
                    vol: '$4.2M',
                    motif: 'star',
                  },
                  {
                    name: 'Zenith',
                    ticker: '$ZNTH',
                    desc: 'Next-gen design collective.',
                    holders: '98K',
                    vol: '$2.9M',
                    motif: 'wave',
                  },
                  {
                    name: 'Orbit AI',
                    ticker: '$ORBT',
                    desc: 'Autonomous creator agents.',
                    holders: '72K',
                    vol: '$1.8M',
                    motif: 'triangle',
                  },
                ].map((card) => (
                  <div
                    key={card.name}
                    className="rounded-2xl obsidian-subglass p-4 flex flex-col justify-between"
                  >
                    <div className="h-40 rounded-xl bg-black border border-white/[0.08] flex items-center justify-center overflow-hidden relative">
                      {card.motif === 'star' && (
                        <Sparkles className="w-14 h-14 text-zinc-200 stroke-[1.2]" />
                      )}
                      {card.motif === 'wave' && (
                        <svg viewBox="0 0 220 100" className="w-full h-full" fill="none">
                          <path
                            d="M-10 65 C40 25, 95 85, 145 45 C180 18, 210 55, 235 35"
                            stroke="rgba(255,255,255,0.65)"
                            strokeWidth="2.5"
                          />
                          <path
                            d="M-10 78 C55 40, 105 95, 165 55 C195 35, 220 65, 240 50"
                            stroke="rgba(255,255,255,0.2)"
                            strokeWidth="1.5"
                          />
                        </svg>
                      )}
                      {card.motif === 'triangle' && (
                        <svg viewBox="0 0 120 100" className="w-24 h-24" fill="none">
                          <path
                            d="M60 14 L102 86 H18 L60 14 Z"
                            stroke="#E4E4E7"
                            strokeWidth="7"
                          />
                          <path d="M60 44 L78 76 H42 L60 44 Z" fill="#E4E4E7" />
                        </svg>
                      )}
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[16px] font-semibold text-white">
                          <span>{card.name}</span>
                          <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" />
                        </div>
                        <span className="text-[11px] font-mono text-zinc-400">{card.ticker}</span>
                      </div>
                      <p className="text-[12px] text-zinc-400 mt-1">{card.desc}</p>
                    </div>

                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/[0.06] text-[12px] font-mono tabular-nums text-zinc-300">
                      <span>{card.holders} holders</span>
                      <span>{card.vol}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Beat 2: Creator Dashboard & Project Analytics */}
            <div
              className="absolute w-[1088px] h-[612px] rounded-[22px] obsidian-glass px-11 py-9 flex flex-col justify-between"
              style={{
                transform: `translateX(${act4DashX}px)`,
                opacity: act4Slide,
              }}
            >
              <div className="flex items-center justify-between border-b border-white/[0.07] pb-5">
                <div>
                  <h3 className="text-[30px] font-semibold tracking-tight text-white">
                    Welcome back
                  </h3>
                  <p className="text-[13px] text-zinc-400 mt-0.5">
                    Real-time performance across your launched tokens and creator pools.
                  </p>
                </div>
                <div className="px-4 py-2 rounded-full bg-white text-black text-[12px] font-semibold flex items-center gap-1.5">
                  <span>Create New</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* 4 KPI Cards */}
              <div className="grid grid-cols-4 gap-5 my-5">
                {[
                  {label: 'Active Launches', val: `${Math.round(lerp(2, 12, act4DashCount))}`},
                  {label: 'Total Views', val: `${Math.round(lerp(180, 842, act4DashCount))}K`},
                  {label: 'Token Holders', val: `${Math.round(lerp(24, 128, act4DashCount))}K`},
                  {label: 'Followers', val: `${Math.round(lerp(4, 24, act4DashCount))}K`},
                ].map((kpi) => (
                  <div key={kpi.label} className="rounded-2xl obsidian-subglass p-5">
                    <div className="text-[12px] text-zinc-400">{kpi.label}</div>
                    <div className="text-[30px] font-semibold tracking-tight tabular-nums text-white mt-1.5">
                      {kpi.val}
                    </div>
                  </div>
                ))}
              </div>

              {/* Project Analytics Spline Chart */}
              <div className="rounded-2xl obsidian-subglass p-6 flex-1 flex flex-col justify-between relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <TrendingUp className="w-4 h-4 text-zinc-300" />
                    <span className="text-[15px] font-semibold text-white">Project Analytics</span>
                  </div>
                  <span className="text-[12px] font-mono text-zinc-400">LAST 30 DAYS</span>
                </div>

                <div className="relative h-[195px] w-full mt-3">
                  {/* Y-axis subtle guides */}
                  <div className="absolute inset-0 flex flex-col justify-between text-[11px] font-mono text-zinc-600 pointer-events-none">
                    <div className="border-b border-white/[0.04] pb-1">200K</div>
                    <div className="border-b border-white/[0.04] pb-1">100K</div>
                    <div className="border-b border-white/[0.06] pb-1">0</div>
                  </div>

                  <svg viewBox="0 0 920 180" className="w-full h-full relative z-10" fill="none">
                    <defs>
                      <linearGradient id="klyro-chart-fill" x1="0" y1="0" x2="0" y2="180" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0.0)" />
                      </linearGradient>
                    </defs>

                    {/* Soft fill under curve */}
                    <path
                      d="M 48 158 C 125 152, 165 112, 235 124 C 310 136, 350 76, 435 88 C 515 100, 560 44, 650 38 C 740 32, 815 95, 895 72 L 895 178 L 48 178 Z"
                      fill="url(#klyro-chart-fill)"
                      style={{opacity: act4ChartDraw}}
                    />

                    {/* Crisp Silver Main Line */}
                    <path
                      d="M 48 158 C 125 152, 165 112, 235 124 C 310 136, 350 76, 435 88 C 515 100, 560 44, 650 38 C 740 32, 815 95, 895 72"
                      stroke="#FFFFFF"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeDasharray={chartPathLen * 1.7}
                      strokeDashoffset={chartPathLen * 1.7 * (1 - act4ChartDraw)}
                    />

                    {/* Peak Dot */}
                    <circle
                      cx="650"
                      cy="38"
                      r="5.5"
                      fill="#FFFFFF"
                      stroke="#09090B"
                      strokeWidth="3"
                      style={{opacity: act4PeakPop}}
                    />
                  </svg>

                  {/* Signature White Callout Badge matching reference */}
                  <div
                    className="absolute top-[2px] left-[632px] -translate-x-1/2 px-3.5 py-1 rounded-full bg-white text-black text-[12px] font-semibold font-mono tabular-nums shadow-lg"
                    style={{
                      opacity: act4PeakPop,
                      transform: `translate(-50%, ${lerp(8, 0, act4PeakPop)}px)`,
                    }}
                  >
                    178K volume
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===============================================================
            ACT V: 12.8-15.0s — FINALE LOCKUP
           =============================================================== */}
        {showAct5 && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{
              opacity: act5In,
              transform: `scale(${act5Scale})`,
            }}
          >
            <KlyroHeroMark
              className="w-[330px] h-[215px]"
              lightSweep={act5Sweep}
              brightness={1.08}
            />

            <div
              className="mt-5 flex flex-col items-center text-center"
              style={{
                opacity: act5TextIn,
                transform: `translateY(${lerp(12, 0, act5TextIn)}px)`,
              }}
            >
              <span className="text-[28px] font-semibold tracking-[0.42em] text-white pl-[0.42em]">
                KLYRO
              </span>
              <span className="text-[14px] text-zinc-400 tracking-[0.14em] mt-3">
                Create. Launch. Own.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
