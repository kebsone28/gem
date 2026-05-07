/**
 * AudioService (Axe 4 — Plan d'Amélioration Continue GEM-SAAS)
 * Fournit des feedbacks sonores subtils pour améliorer l'immersion et la réactivité.
 */

// Note: Sound synthesis is done via AudioContext API below
import logger from '../utils/logger';

class AudioService {
  private context: AudioContext | null = null;
  private unlockListenersAttached = false;
  private unlocked = false;
  private readonly unlockHandler = () => {
    void this.resumeFromGesture();
  };

  constructor() {
    this.attachUnlockListeners();
  }

  private initContext() {
    if (typeof window === 'undefined') return;
    if (!this.context) {
      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextCtor) return;

      this.context = new AudioContextCtor();
    }
  }

  private attachUnlockListeners() {
    if (this.unlockListenersAttached || typeof window === 'undefined') return;

    window.addEventListener('pointerdown', this.unlockHandler, { passive: true });
    window.addEventListener('keydown', this.unlockHandler);
    window.addEventListener('touchstart', this.unlockHandler, { passive: true });
    this.unlockListenersAttached = true;
  }

  private detachUnlockListeners() {
    if (!this.unlockListenersAttached || typeof window === 'undefined') return;

    window.removeEventListener('pointerdown', this.unlockHandler);
    window.removeEventListener('keydown', this.unlockHandler);
    window.removeEventListener('touchstart', this.unlockHandler);
    this.unlockListenersAttached = false;
  }

  private async resumeFromGesture() {
    try {
      this.initContext();
      if (!this.context) return false;

      if (this.context.state === 'suspended') {
        await this.context.resume();
      }

      this.unlocked = this.context.state === 'running';
      if (this.unlocked) {
        this.detachUnlockListeners();
      }

      return this.unlocked;
    } catch (e) {
      logger.debug('[audioService] Audio unlock failed', e);
      return false;
    }
  }

  private isReadyToPlay() {
    this.attachUnlockListeners();
    // Do NOT create/init the AudioContext here — creating it without a user
    // gesture can trigger browser policies that block playback. Require an
    // explicit unlock() (triggered by a user gesture) before playing.
    if (!this.context) return false;
    if (this.context.state !== 'running' || !this.unlocked) return false;
    return true;
  }

  public async unlock() {
    // Ensure context exists and try to resume — this should be called from a
    // user gesture (click/tap) to satisfy browser autoplay policies.
    this.initContext();
    return this.resumeFromGesture();
  }

  /**
   * Joue un "Ping" doux (Type SaaS Premium)
   */
  public playPing() {
    try {
      if (!this.isReadyToPlay()) return;
      const context = this.context;
      if (!context) return;

      const osc = context.createOscillator();
      const gain = context.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, context.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(440, context.currentTime + 0.5);

      gain.gain.setValueAtTime(0.1, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(context.destination);

      osc.start();
      osc.stop(context.currentTime + 0.5);
    } catch (e) {
      logger.debug('[audioService] Audio feedback failed', e);
    }
  }

  /**
   * Joue un son de "Validation" (double beep montant)
   */
  public playSuccess() {
    try {
      if (!this.isReadyToPlay()) return;
      const context = this.context;
      if (!context) return;

      const osc = context.createOscillator();
      const gain = context.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, context.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, context.currentTime + 0.1); // E5

      gain.gain.setValueAtTime(0.08, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(context.destination);

      osc.start();
      osc.stop(context.currentTime + 0.3);
    } catch (e) {
      logger.debug('[audioService] Audio feedback failed', e);
    }
  }
}

export const audioService = new AudioService();
