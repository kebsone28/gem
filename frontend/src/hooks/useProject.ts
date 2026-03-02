import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import type { Project } from '../utils/types';

export function useProject() {
    const project = useLiveQuery(async () => {
        const p = await db.projects.toArray();
        if (p.length === 0) {
            // Default project if none exists (should be handled by sync/init)
            return {
                id: 'default',
                name: 'Projet Proquelec',
                duration: 180,
                config: {
                    logistics_workshop: { kitsLoaded: 0 },
                    staffConfig: {
                        'macon': { amount: 150000, mode: 'daily' },
                        'network': { amount: 200000, mode: 'daily' },
                        'interior': { amount: 120000, mode: 'daily' },
                        'controller': { amount: 250000, mode: 'daily' },
                    },
                    costs: {
                        vehicleRental: {
                            'pickup': 50000,
                            'truck': 150000,
                        }
                    }
                }
            } as Project;
        }
        return p[0] as Project;
    });

    const updateProject = async (updates: Partial<Project>) => {
        const p = await db.projects.toArray();
        if (p.length > 0) {
            await db.projects.update(p[0].id, updates);
        } else {
            await db.projects.add({ ...updates, id: 'default', organizationId: 'default' });
        }
    };

    return { project, updateProject, isLoading: project === undefined };
}
