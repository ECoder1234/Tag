type StepAccent = "normal" | "it";

const BASS_SEQUENCE: readonly number[] = [38, 41, 45, 41, 36, 41, 43, 41];
const LEAD_SEQUENCE: readonly (number | null)[] = [65, null, 69, null, 72, null, 69, null];

const midiToFrequency = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private hasUserGesture = false;
  private muted = false;
  private disposed = false;
  private beatAccumulatorMs = 0;
  private sequenceStep = 0;

  private ensureContext(): boolean {
    if (this.disposed || typeof window === "undefined") {
      return false;
    }

    if (this.context === null) {
      const AudioCtor =
        window.AudioContext ??
        ((window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? null);
      if (AudioCtor === null) {
        return false;
      }

      this.context = new AudioCtor();
      this.masterGain = this.context.createGain();
      this.musicGain = this.context.createGain();
      this.sfxGain = this.context.createGain();

      this.masterGain.gain.value = 0.36;
      this.musicGain.gain.value = 0.35;
      this.sfxGain.gain.value = 0.8;

      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.context.destination);
    }

    if (this.hasUserGesture && this.context.state === "suspended") {
      void this.context.resume().catch(() => undefined);
    }

    return this.context.state !== "closed";
  }

  private triggerTone(
    frequency: number,
    durationMs: number,
    options: {
      gain: number;
      type: OscillatorType;
      detune?: number;
      slideToHz?: number;
      bus: "music" | "sfx";
    }
  ): void {
    if (!this.ensureContext() || this.context === null || this.masterGain === null) {
      return;
    }
    if (this.context.state !== "running") {
      return;
    }

    const output = options.bus === "music" ? this.musicGain : this.sfxGain;
    if (output === null) {
      return;
    }

    const now = this.context.currentTime;
    const durationSec = durationMs / 1000;
    const attackSec = Math.min(0.012, durationSec * 0.2);
    const releaseSec = Math.min(0.14, durationSec * 0.6);

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = options.type;
    osc.frequency.setValueAtTime(Math.max(24, frequency), now);
    if (options.slideToHz !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(24, options.slideToHz), now + durationSec);
    }
    if (options.detune !== undefined) {
      osc.detune.value = options.detune;
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, options.gain), now + attackSec);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + Math.max(attackSec + 0.01, durationSec + releaseSec)
    );

    osc.connect(gain);
    gain.connect(output);
    osc.start(now);
    osc.stop(now + durationSec + releaseSec + 0.02);
  }

  unlock(): void {
    this.hasUserGesture = true;
    if (!this.ensureContext() || this.context === null) {
      return;
    }
    if (this.context.state === "suspended") {
      void this.context.resume().catch(() => undefined);
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.ensureContext() || this.context === null || this.masterGain === null) {
      return;
    }

    const now = this.context.currentTime;
    const target = muted ? 0.0001 : 0.36;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.exponentialRampToValueAtTime(target, now + 0.08);
  }

  update(deltaMs: number, intensity: number): void {
    if (this.muted || !this.hasUserGesture) {
      return;
    }
    if (!this.ensureContext() || this.context === null || this.musicGain === null) {
      return;
    }
    if (this.context.state !== "running") {
      return;
    }

    const clampedIntensity = clamp(intensity, 0.1, 1);
    const tempo = 112 + Math.round(22 * clampedIntensity);
    const stepMs = (60000 / tempo) / 2;
    this.beatAccumulatorMs += deltaMs;

    const now = this.context.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.linearRampToValueAtTime(0.2 + clampedIntensity * 0.18, now + 0.05);

    while (this.beatAccumulatorMs >= stepMs) {
      this.beatAccumulatorMs -= stepMs;
      const bassMidi = BASS_SEQUENCE[this.sequenceStep % BASS_SEQUENCE.length] ?? BASS_SEQUENCE[0] ?? 40;
      const leadMidi = LEAD_SEQUENCE[this.sequenceStep % LEAD_SEQUENCE.length] ?? null;

      this.triggerTone(midiToFrequency(bassMidi), 120, {
        gain: 0.13,
        type: "triangle",
        bus: "music"
      });
      if (leadMidi !== null) {
        this.triggerTone(midiToFrequency(leadMidi), 85, {
          gain: 0.07 + clampedIntensity * 0.02,
          type: "square",
          bus: "music"
        });
      }

      this.sequenceStep = (this.sequenceStep + 1) % 64;
    }
  }

  playJump(): void {
    if (this.muted) {
      return;
    }
    this.triggerTone(320, 70, {
      gain: 0.12,
      type: "triangle",
      slideToHz: 520,
      bus: "sfx"
    });
  }

  playLand(strength = 1): void {
    if (this.muted) {
      return;
    }
    const clamped = clamp(strength, 0.3, 1.8);
    this.triggerTone(170, 80, {
      gain: 0.08 * clamped,
      type: "square",
      slideToHz: 120,
      bus: "sfx"
    });
  }

  playStep(accent: StepAccent): void {
    if (this.muted) {
      return;
    }
    this.triggerTone(accent === "it" ? 210 : 185, 38, {
      gain: accent === "it" ? 0.07 : 0.05,
      type: "square",
      slideToHz: accent === "it" ? 175 : 160,
      bus: "sfx"
    });
  }

  playPickup(): void {
    if (this.muted) {
      return;
    }
    this.triggerTone(660, 65, {
      gain: 0.09,
      type: "triangle",
      bus: "sfx"
    });
    this.triggerTone(820, 85, {
      gain: 0.07,
      type: "triangle",
      bus: "sfx"
    });
  }

  playPowerup(): void {
    if (this.muted) {
      return;
    }
    this.triggerTone(540, 70, {
      gain: 0.1,
      type: "sawtooth",
      slideToHz: 760,
      bus: "sfx"
    });
  }

  playTag(): void {
    if (this.muted) {
      return;
    }
    this.triggerTone(520, 90, {
      gain: 0.15,
      type: "square",
      slideToHz: 320,
      bus: "sfx"
    });
    this.triggerTone(720, 45, {
      gain: 0.09,
      type: "triangle",
      slideToHz: 440,
      bus: "sfx"
    });
  }

  playRoundEnd(): void {
    if (this.muted) {
      return;
    }
    this.triggerTone(392, 180, {
      gain: 0.1,
      type: "triangle",
      bus: "sfx"
    });
    this.triggerTone(494, 220, {
      gain: 0.09,
      type: "triangle",
      bus: "sfx"
    });
    this.triggerTone(588, 280, {
      gain: 0.08,
      type: "triangle",
      bus: "sfx"
    });
  }

  playUiConfirm(): void {
    if (this.muted) {
      return;
    }
    this.triggerTone(460, 50, {
      gain: 0.07,
      type: "square",
      bus: "sfx"
    });
  }

  destroy(): void {
    this.disposed = true;
    if (this.context !== null) {
      void this.context.close().catch(() => undefined);
    }
    this.context = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
  }
}
