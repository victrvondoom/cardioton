/**
 * Streaming PCM16 player. Schedules incoming audio chunks back-to-back on a Web
 * Audio context so the assistant's speech plays gaplessly, and supports instant
 * "barge-in" interruption (stop everything when the user starts talking).
 */
export class PCMPlayer {
  private readonly ctx: AudioContext;
  private readonly sampleRate: number;
  private readonly gain: GainNode;
  private nextStartTime = 0;
  private active = new Set<AudioBufferSourceNode>();

  constructor(ctx: AudioContext, sampleRate: number) {
    this.ctx = ctx;
    this.sampleRate = sampleRate;
    this.gain = ctx.createGain();
    this.gain.connect(ctx.destination);
  }

  /** Queue a PCM16 chunk for playback. */
  enqueue(int16: Int16Array): void {
    if (int16.length === 0) return;

    const float = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float[i] = int16[i] / 0x8000;
    }

    const buffer = this.ctx.createBuffer(1, float.length, this.sampleRate);
    buffer.copyToChannel(float, 0);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gain);

    const startAt = Math.max(this.ctx.currentTime, this.nextStartTime);
    source.start(startAt);
    this.nextStartTime = startAt + buffer.duration;

    this.active.add(source);
    source.onended = () => this.active.delete(source);
  }

  /** Stop and discard all queued audio immediately (barge-in). */
  clear(): void {
    for (const source of this.active) {
      try {
        source.onended = null;
        source.stop();
      } catch {
        // already stopped
      }
    }
    this.active.clear();
    this.nextStartTime = 0;
  }

  get isPlaying(): boolean {
    return this.active.size > 0;
  }

  /** Resolve once all queued audio has finished playing. */
  async waitUntilDone(): Promise<void> {
    while (this.active.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}
