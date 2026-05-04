import type { Mission } from './MissionList';

export const mockMissions: Mission[] = [
  {
    id: 'm-2026-001',
    title: 'MISSION-2026-ALPHA',
    location: 'Dakar',
    status: 'online',
    createdAt: '2026-03-12T10:15:00Z',
    updatedAt: '2026-04-01T08:00:00Z',
    history: [
      { when: '2026-03-12T10:15:00Z', by: 'admin', action: 'Création', note: 'Import initial' },
      {
        when: '2026-04-01T08:00:00Z',
        by: 'ops',
        action: 'Mise à jour',
        note: 'Changement de zone',
      },
    ],
  },
  {
    id: 'm-2025-101',
    title: 'MISSION-2025-BETA',
    location: 'Saint-Louis',
    status: 'dft',
    createdAt: '2025-06-20T12:00:00Z',
    history: [{ when: '2025-06-20T12:00:00Z', by: 'importer', action: 'Création' }],
  },
  {
    id: 'm-2024-009',
    title: 'MISSION-2024-DELTA',
    location: 'Ziguinchor',
    status: 'off',
    createdAt: '2024-11-02T09:30:00Z',
  },
  {
    id: 'm-2026-002',
    title: 'Brouillon: Destination à préciser',
    location: 'Dakar',
    status: 'draft',
    createdAt: '2026-04-25T14:20:00Z',
    history: [
      {
        when: '2026-04-25T14:20:00Z',
        by: 'user:mehdi',
        action: 'Création',
        note: 'Brouillon initial',
      },
    ],
  },
];

export default mockMissions;
