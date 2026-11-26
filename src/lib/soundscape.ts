/**
 * Minimalist procedural Web Audio studio soundscape for the 15s KLYRO film.
 * Muted by default; activates cleanly on explicit user gesture.
 */
export class StudioSoundscape {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private padOsc1: OscillatorNode | null = null;
  private padOsc2: OscillatorNode | null = null;
  private padGain: GainNode | null = null;
  private enabled = false;
  private lastTriggeredBeat = -1;

  public isEnabled(): boolean {
    return this.enabled;
  }

  public toggle(): boolean {
    if (!this.enabled) {
      this.initAndEnable();
      return true;
    } else {
      this.disable();
      return false;
    }
  }

  private initAndEnable(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.0;
      this.masterGain.connect(this.ctx.destination);

      // Subtle dark studio sub-harmonic pad (A1 + E2)
      this.padGain = this.ctx.createGain();
      this.padGain.gain.value = 0.08;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 260;

      this.padOsc1 = this.ctx.createOscillator();
      this.padOsc1.type = 'sine';
      this.padOsc1.frequency.value = 55; // A1

      this.padOsc2 = this.ctx.createOscillator();
      this.padOsc2.type = 'triangle';
      this.padOsc2.frequency.value = 82.41; // E2

      this.padOsc1.connect(filter);
      this.padOsc2.connect(filter);
      filter.connect(this.padGain);
      this.padGain.connect(this.masterGain);

      this.padOsc1.start();
      this.padOsc2.start();
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    this.enabled = true;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(0.6, this.ctx.currentTime, 0.15);
    }
  }

  public disable(): void {
    this.enabled = false;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    }
  }

  public setPlaying(isPlaying: boolean): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    this.masterGain.gain.setTargetAtTime(isPlaying ? 0.6 : 0.08, this.ctx.currentTime, 0.12);
  }

  public syncTime(time: number, isPlaying: boolean): void {
    if (!this.enabled || !isPlaying || !this.ctx || !this.masterGain) return;

    // Trigger subtle precision audio cues at key architectural beats
    const cues = [
      {time: 0.9, type: 'shimmer' as const, id: 1},
      {time: 3.05, type: 'whoosh' as const, id: 2},
      {time: 6.25, type: 'whoosh' as const, id: 3},
      {time: 7.2, type: 'tick' as const, id: 4},
      {time: 8.1, type: 'tick' as const, id: 5},
      {time: 8.7, type: 'confirm' as const, id: 6},
      {time: 9.55, type: 'whoosh' as const, id: 7},
      {time: 12.85, type: 'lockup' as const, id: 8},
    ];

    if (time < 0.2) {
      this.lastTriggeredBeat = -1;
    }

    for (const cue of cues) {
      if (Math.abs(time - cue.time) < 0.06 && this.lastTriggeredBeat !== cue.id) {
        this.lastTriggeredBeat = cue.id;
        this.playCue(cue.type);
        break;
      }
    }
  }

  private playCue(type: 'shimmer' | 'whoosh' | 'tick' | 'confirm' | 'lockup'): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    if (type === 'shimmer') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.9);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.055, now + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 1.25);
    } else if (type === 'whoosh') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.38);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.45);
    } else if (type === 'tick') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.03);
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'confirm' || type === 'lockup') {
      const freqs = type === 'lockup' ? [220, 329.63, 440] : [440, 659.25];
      freqs.forEach((f, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.04);
        gain.gain.setValueAtTime(0.001, now + idx * 0.04);
        gain.gain.linearRampToValueAtTime(0.045, now + idx * 0.04 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.04 + 1.1);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 1.15);
      });
    }
  }

  public dispose(): void {
    try {
      this.padOsc1?.stop();
      this.padOsc2?.stop();
      void this.ctx?.close();
    } catch {
      // ignore cleanup errors
    }
  }
}
