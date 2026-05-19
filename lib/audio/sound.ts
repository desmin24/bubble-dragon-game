export type SoundCue = "shoot" | "settle" | "clear" | "drop" | "gameOver";

type WebAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

export const STORAGE_SOUND_ENABLED_KEY = "bubble-dragon-sound-enabled";

export class BubbleDragonSound {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicOscillators: OscillatorNode[] = [];
  private musicTimer: number | null = null;
  private enabled = true;
  private unlocked = false;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;

    if (!enabled) {
      this.stopMusic();
      return;
    }

    if (this.unlocked) {
      void this.unlock();
    }
  }

  async unlock() {
    if (!this.enabled) {
      return;
    }

    const context = this.getContext();

    if (!context) {
      return;
    }

    if (context.state === "suspended") {
      await context.resume();
    }

    this.unlocked = true;
    this.startMusic();
  }

  play(cue: SoundCue) {
    if (!this.enabled) {
      return;
    }

    const context = this.getContext();

    if (!context) {
      return;
    }

    const now = context.currentTime;

    if (cue === "shoot") {
      this.playSweep(now, 520, 760, 0.09, "triangle", 0.12);
      this.playNoise(now, 0.05, 0.04, 1200);
    }

    if (cue === "settle") {
      this.playTone(now, 360, 0.08, "sine", 0.08);
      this.playTone(now + 0.025, 520, 0.07, "triangle", 0.055);
    }

    if (cue === "clear") {
      this.playTone(now, 660, 0.11, "triangle", 0.1);
      this.playTone(now + 0.045, 880, 0.13, "sine", 0.12);
      this.playTone(now + 0.09, 1180, 0.15, "triangle", 0.09);
      this.playNoise(now, 0.12, 0.035, 2600);
    }

    if (cue === "drop") {
      this.playSweep(now, 430, 170, 0.26, "sine", 0.1);
      this.playNoise(now + 0.03, 0.18, 0.028, 650);
    }

    if (cue === "gameOver") {
      this.playSweep(now, 360, 180, 0.32, "triangle", 0.12);
      this.playTone(now + 0.22, 140, 0.22, "sine", 0.09);
    }
  }

  dispose() {
    this.stopMusic();
    void this.context?.close();
    this.context = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
  }

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") {
      return null;
    }

    if (this.context) {
      return this.context;
    }

    const AudioContextConstructor = window.AudioContext ?? (window as WebAudioWindow).webkitAudioContext;

    if (!AudioContextConstructor) {
      return null;
    }

    const context = new AudioContextConstructor();
    const masterGain = context.createGain();
    const sfxGain = context.createGain();
    const musicGain = context.createGain();

    masterGain.gain.value = 0.82;
    sfxGain.gain.value = 0.78;
    musicGain.gain.value = 0.09;

    sfxGain.connect(masterGain);
    musicGain.connect(masterGain);
    masterGain.connect(context.destination);

    this.context = context;
    this.masterGain = masterGain;
    this.sfxGain = sfxGain;
    this.musicGain = musicGain;

    return context;
  }

  private playTone(
    startTime: number,
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ) {
    const context = this.context;
    const output = this.sfxGain;

    if (!context || !output) {
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.connect(gain);
    gain.connect(output);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
  }

  private playSweep(
    startTime: number,
    fromFrequency: number,
    toFrequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ) {
    const context = this.context;
    const output = this.sfxGain;

    if (!context || !output) {
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(fromFrequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, toFrequency), startTime + duration);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.016);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.connect(gain);
    gain.connect(output);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
  }

  private playNoise(startTime: number, duration: number, volume: number, filterFrequency: number) {
    const context = this.context;
    const output = this.sfxGain;

    if (!context || !output) {
      return;
    }

    const bufferSize = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < bufferSize; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / bufferSize);
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();

    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = filterFrequency;
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    source.start(startTime);
  }

  private playMusicPluck(startTime: number, frequency: number, duration: number, volume: number) {
    const context = this.context;
    const output = this.musicGain;

    if (!context || !output) {
      return;
    }

    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(frequency, startTime);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1850, startTime);
    filter.Q.value = 0.7;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.03);
  }

  private playMusicBell(startTime: number, frequency: number, duration: number, volume: number) {
    const context = this.context;
    const output = this.musicGain;

    if (!context || !output) {
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.connect(gain);
    gain.connect(output);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.03);
  }

  private startMusic() {
    const context = this.context;
    const output = this.musicGain;

    if (!this.enabled || !context || !output || this.musicOscillators.length > 0) {
      return;
    }

    const bass = context.createOscillator();
    const bassGain = context.createGain();

    bass.type = "triangle";
    bassGain.gain.value = 0.0001;

    bass.connect(bassGain);
    bassGain.connect(output);

    bass.start();
    this.musicOscillators = [bass];

    const pattern: Array<{ bass: number; melody?: number; bell?: number; accent?: boolean; bassHit?: boolean }> = [
      { bass: 130.81, melody: 659.25, bell: 1318.51, accent: true, bassHit: true },
      { bass: 130.81 },
      { bass: 196, melody: 783.99, bassHit: true },
      { bass: 196, melody: 880 },
      { bass: 146.83 },
      { bass: 146.83, melody: 783.99, bassHit: true },
      { bass: 220, melody: 659.25 },
      { bass: 220 },
      { bass: 164.81, melody: 880, accent: true, bassHit: true },
      { bass: 164.81 },
      { bass: 246.94, melody: 987.77, bell: 1567.98 },
      { bass: 246.94 },
      { bass: 196, melody: 783.99, bassHit: true },
      { bass: 196 },
      { bass: 220, melody: 659.25 },
      { bass: 246.94 },
      { bass: 261.63, melody: 1046.5, accent: true, bassHit: true },
      { bass: 261.63 },
      { bass: 196, melody: 987.77 },
      { bass: 196, melody: 880, bassHit: true },
      { bass: 220 },
      { bass: 220, melody: 783.99 },
      { bass: 246.94, melody: 880, bell: 1760 },
      { bass: 246.94 },
      { bass: 196, melody: 987.77, accent: true, bassHit: true },
      { bass: 196 },
      { bass: 164.81, melody: 783.99 },
      { bass: 164.81 },
      { bass: 146.83, melody: 659.25, bassHit: true },
      { bass: 146.83 },
      { bass: 220, melody: 739.99 },
      { bass: 246.94 },
    ];
    let stepIndex = 0;

    const updateMusic = () => {
      if (!this.context || this.musicOscillators.length < 1) {
        return;
      }

      const note = pattern[stepIndex % pattern.length];
      const now = this.context.currentTime;
      const isDownbeat = note.accent === true;
      const shouldPulseBass = note.bassHit === true;

      this.musicOscillators[0].frequency.setTargetAtTime(note.bass, now, 0.018);
      bassGain.gain.cancelScheduledValues(now);
      bassGain.gain.setValueAtTime(isDownbeat ? 0.18 : shouldPulseBass ? 0.08 : 0.0001, now);
      bassGain.gain.exponentialRampToValueAtTime(0.026, now + 0.2);

      if (note.melody) {
        this.playMusicPluck(now, note.melody, isDownbeat ? 0.19 : 0.15, isDownbeat ? 0.28 : 0.2);
      }

      if (note.bell) {
        this.playMusicBell(now + 0.045, note.bell, 0.17, 0.085);
      }

      stepIndex += 1;
    };

    updateMusic();
    this.musicTimer = window.setInterval(updateMusic, 245);
  }

  private stopMusic() {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }

    for (const oscillator of this.musicOscillators) {
      try {
        oscillator.stop();
      } catch {
        // The oscillator may already be stopped if the AudioContext is closing.
      }
    }

    this.musicOscillators = [];
  }
}
