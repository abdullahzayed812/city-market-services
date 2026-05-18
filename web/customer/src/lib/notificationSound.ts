/**
 * Plays a soft notification "ding" using the Web Audio API.
 * No audio file dependency — works offline.
 * Silently fails if autoplay is blocked or audio is unsupported.
 */
export function playNotificationSound(): void {
  try {
    const ctx = new AudioContext();

    const playTone = (
      frequency: number,
      startTime: number,
      duration: number,
      gain: number,
    ) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, startTime);

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Two-tone ascending ding: D5 → A5
    const now = ctx.currentTime;
    playTone(587.33, now, 0.25, 0.28);       // D5
    playTone(880.0, now + 0.1, 0.4, 0.22);   // A5

    // Close the AudioContext after the sounds finish to free resources
    setTimeout(() => ctx.close(), 700);
  } catch {
    // Silently ignore — autoplay policy or unsupported browser
  }
}
