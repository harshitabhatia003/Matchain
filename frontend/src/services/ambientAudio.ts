// Ambient audio synthesis using Web Audio API for an Overworld-style sonic experience

class AmbientAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private isPlaying = false;

  public init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
  }

  public toggle(): boolean {
    if (!this.ctx) this.init();
    if (!this.ctx || !this.masterGain) return false;

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    if (this.isPlaying) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }

  private start() {
    if (!this.ctx || !this.masterGain) return;
    this.stop(); // Clear any existing oscillators

    // Frequencies for a serene deep space drone (D minor chord: D2, A2, D3, F3, A3)
    const baseFreqs = [73.42, 110.00, 146.83, 174.61, 220.00];

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, this.ctx.currentTime);
    filter.Q.setValueAtTime(3, this.ctx.currentTime);
    filter.connect(this.masterGain);

    this.oscillators = baseFreqs.map((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const oscGain = this.ctx!.createGain();

      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      // Subtle detune for rich celestial beating
      osc.frequency.setValueAtTime(freq + (Math.random() * 0.4 - 0.2), this.ctx!.currentTime);

      const gainVal = 0.04 / (idx + 1);
      oscGain.gain.setValueAtTime(gainVal, this.ctx!.currentTime);

      osc.connect(oscGain);
      oscGain.connect(filter);
      osc.start();
      return osc;
    });

    // Smooth fade in
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(0.35, this.ctx.currentTime + 2.5);
    this.isPlaying = true;
  }

  private stop() {
    if (!this.ctx || !this.masterGain) return;
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.2);

    setTimeout(() => {
      this.oscillators.forEach((osc) => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {}
      });
      this.oscillators = [];
      this.isPlaying = false;
    }, 1300);
  }

  public getStatus(): boolean {
    return this.isPlaying;
  }
}

export const ambientAudio = new AmbientAudioEngine();
