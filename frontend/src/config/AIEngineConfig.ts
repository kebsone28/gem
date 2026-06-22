 
export type AIProvider = 'PUBLIC_POLLINATIONS' | 'OPENAI' | 'ANTHROPIC';

export class AIEngineConfig {
  private static provider: AIProvider = 'PUBLIC_POLLINATIONS';

  static getProvider(): AIProvider {
    return this.provider;
  }

  static setProvider(provider: AIProvider): void {
    this.provider = provider;
  }

  static setApiKey(provider: AIProvider, key: string): void {
    sessionStorage.setItem(`${provider}_API_KEY`, key);
  }

  static clearApiKey(provider: AIProvider): void {
    sessionStorage.removeItem(`${provider}_API_KEY`);
  }

  static getApiKey(): string | null {
    // Pour l'IA publique, pas de clé API nécessaire
    if (this.provider === 'PUBLIC_POLLINATIONS') {
      return null;
    }

    // Utiliser sessionStorage (non persistant) plutôt que localStorage
    // pour éviter la persistance des clés API sensibles dans le navigateur
    return sessionStorage.getItem(`${this.provider}_API_KEY`);
  }

  static isConfigured(): boolean {
    if (this.provider === 'PUBLIC_POLLINATIONS') {
      return true; // Toujours disponible
    }

    return !!this.getApiKey();
  }
}
