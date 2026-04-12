import React, { useState } from 'react';
import { MissionSageService } from '../services/MissionSageService';
import type { User, AppState } from '../services/MissionSageService';

interface MissionSageChatProps {
  user?: User;
  state?: AppState;
}

export const MissionSageChat: React.FC<MissionSageChatProps> = ({ user, state }) => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const sageService = MissionSageService.getInstance();
      const result = await sageService.processQuery(query, user, state);
      setResponse(result);
    } catch (error) {
      setResponse('Erreur lors de la communication avec MissionSage.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mission-sage-chat p-4 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">MissionSage - Assistant IA GEM-MINT</h2>

      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Posez votre question sur GEM-MINT..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '...' : 'Demander'}
          </button>
        </div>
      </form>

      {response && (
        <div className="response-container p-4 bg-gray-50 rounded-md">
          <h3 className="font-semibold mb-2">Réponse de MissionSage:</h3>
          <div className="whitespace-pre-wrap text-sm">{response}</div>
        </div>
      )}

      {user && (
        <div className="user-info mt-4 p-2 bg-blue-50 rounded text-sm">
          <strong>Utilisateur:</strong> {user.displayName || user.name} ({user.role})
        </div>
      )}
    </div>
  );
};