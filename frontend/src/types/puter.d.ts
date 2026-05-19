// Type declarations for Puter.js SDK
// This allows TypeScript to recognize window.puter.ai.chat()

declare global {
  interface Window {
    puter?: {
      ai: {
        chat: (model: string, message: string) => Promise<string>;
      };
    };
  }
}

export {};
