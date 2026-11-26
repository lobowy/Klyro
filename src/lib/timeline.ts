export const DEMO_DURATION = 15;

export interface Chapter {
  id: string;
  index: string;
  label: string;
  start: number;
  end: number;
  summary: string;
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'reveal',
    index: '01',
    label: 'Reveal',
    start: 0,
    end: 3.0,
    summary: 'Polished silver Klyro mark emerges with diagonal studio light sweep.',
  },
  {
    id: 'platform',
    index: '02',
    label: 'Platform',
    start: 3.0,
    end: 6.2,
    summary: 'Obsidian glass hero surface and creator token ecosystem thesis.',
  },
  {
    id: 'launch',
    index: '03',
    label: 'Launch',
    start: 6.2,
    end: 9.5,
    summary: 'Four-step launch studio with live tokenomics and metallic card preview.',
  },
  {
    id: 'analytics',
    index: '04',
    label: 'Analytics',
    start: 9.5,
    end: 12.8,
    summary: 'Discover marketplace and real-time creator growth telemetry.',
  },
  {
    id: 'finale',
    index: '05',
    label: 'Finale',
    start: 12.8,
    end: 15.0,
    summary: 'Architectural Klyro lockup and studio rim reflection.',
  },
];

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Normalized progress [0, 1] across a [start, end] window */
export function segment(time: number, start: number, end: number): number {
  if (end <= start) return time >= end ? 1 : 0;
  return clamp((time - start) / (end - start), 0, 1);
}

export function easeOutCubic(t: number): number {
  const x = clamp(t);
  return 1 - Math.pow(1 - x, 3);
}

export function easeOutExpo(t: number): number {
  const x = clamp(t);
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

export function easeInOutCubic(t: number): number {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function easeInOutQuart(t: number): number {
  const x = clamp(t);
  return x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2;
}

export function getActiveChapter(time: number): Chapter {
  for (let i = CHAPTERS.length - 1; i >= 0; i--) {
    if (time >= CHAPTERS[i].start) return CHAPTERS[i];
  }
  return CHAPTERS[0];
}
