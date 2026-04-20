/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
/**
 * AudioService (Axe 4 — Plan d'Amélioration Continue GEM-SAAS)
 * Fournit des feedbacks sonores subtils pour améliorer l'immersion et la réactivité.
 */

// Note: Sound synthesis is done via AudioContext API below

class AudioService {
  private context: AudioContext | null = null;

  private initContext() {
    if (!this.context) {
      this.context = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: AudioContext }).webkitAudioContext
      )();
    }
  }

  /**
   * Joue un "Ping" doux (Type SaaS Premium)
   */
  public playPing() {
    try {
      this.initContext();
      if (!this.context) return;

      const osc = this.context.createOscillator();
      const gain = this.context.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.context.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(440, this.context.currentTime + 0.5);

      gain.gain.setValueAtTime(0.1, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(this.context.destination);

      osc.start();
      osc.stop(this.context.currentTime + 0.5);
    } catch (e) {
      console.warn('Audio feedback failed:', e);
    }
  }

  /**
   * Joue un son de "Validation" (double beep montant)
   */
  public playSuccess() {
    try {
      this.initContext();
      if (!this.context) return;

      const osc = this.context.createOscillator();
      const gain = this.context.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, this.context.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, this.context.currentTime + 0.1); // E5

      gain.gain.setValueAtTime(0.08, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(this.context.destination);

      osc.start();
      osc.stop(this.context.currentTime + 0.3);
    } catch (e) {
      console.warn('Audio feedback failed:', e);
    }
  }
}

export const audioService = new AudioService();
