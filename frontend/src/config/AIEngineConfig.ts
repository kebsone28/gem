 
export type AIProvider = 'PUBLIC_POLLINATIONS' | 'OPENAI' | 'ANTHROPIC';

export class AIEngineConfig {
  private static provider: AIProvider = 'PUBLIC_POLLINATIONS';

  static getProvider(): AIProvider {
    return this.provider;
  }

  static setProvider(provider: AIProvider): void {
    this.provider = provider;
  }

  static getApiKey(): string | null {
    // Pour l'IA publique, pas de clé API nécessaire
    if (this.provider === 'PUBLIC_POLLINATIONS') {
      return null;
    }

    // Pour les autres providers, récupérer depuis localStorage ou config
    return localStorage.getItem(`${this.provider}_API_KEY`);
  }

  static isConfigured(): boolean {
    if (this.provider === 'PUBLIC_POLLINATIONS') {
      return true; // Toujours disponible
    }

    return !!this.getApiKey();
  }
}
