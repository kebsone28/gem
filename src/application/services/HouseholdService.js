/**
 * Service applicatif pour la gestion des ménages
 * Orchestre les opérations sur les ménages
 */
export class HouseholdService {
    constructor(householdRepository, eventBus) {
        this.householdRepo = householdRepository;
        this.eventBus = eventBus;
    }

    /**
     * Crée un nouveau ménage
     */
    async createHousehold(data) {
        try {
            // Créer la localisation
            const coordinates = data.coordinates
                ? new Coordinates(data.coordinates.latitude, data.coordinates.longitude, data.coordinates.precision)
                : null;

            const location = new Location(
                data.location.region,
                data.location.department,
                data.location.commune,
                data.location.village,
                coordinates
            );

            // Créer le ménage
            const household = new Household(
                data.id || `H-${Date.now()}`,
                location,
                data.owner,
                data.status || HouseholdStatus.NON_DEBUTE
            );

            // Sauvegarder
            await this.householdRepo.save(household);

            this.eventBus.emit('household.created', {
                householdId: household.id
            });

            return household;
        } catch (error) {
            console.error('Error creating household:', error);
            throw error;
        }
    }

    /**
     * Met à jour le statut d'un ménage
     */
    async updateHouseholdStatus(householdId, newStatus, updatedBy, reason = null) {
        try {
            return await this.householdRepo.updateStatus(
                householdId,
                newStatus,
                updatedBy,
                reason
            );
        } catch (error) {
            console.error('Error updating household status:', error);
            throw error;
        }
    }

    /**
     * Assigne une équipe à un ménage
     */
    async assignTeamToHousehold(householdId, teamType, teamId) {
        try {
            const household = await this.householdRepo.findById(householdId);
            if (!household) {
                throw new EntityNotFoundError('Household', householdId);
            }

            household.assignTeam(teamType, teamId);
            await this.householdRepo.save(household);

            return household;
        } catch (error) {
            console.error('Error assigning team to household:', error);
            throw error;
        }
    }

    /**
     * Programme une activité pour un ménage
     */
    async scheduleActivity(householdId, activityType, date) {
        try {
            const household = await this.householdRepo.findById(householdId);
            if (!household) {
                throw new EntityNotFoundError('Household', householdId);
            }

            household.scheduleActivity(activityType, date);
            await this.householdRepo.save(household);

            return household;
        } catch (error) {
            console.error('Error scheduling activity:', error);
            throw error;
        }
    }

    /**
     * Enregistre la complétion d'une activité
     */
    async recordActivityCompletion(householdId, activityType, date) {
        try {
            const household = await this.householdRepo.findById(householdId);
            if (!household) {
                throw new EntityNotFoundError('Household', householdId);
            }

            household.recordActivityCompletion(activityType, date);
            await this.householdRepo.save(household);

            return household;
        } catch (error) {
            console.error('Error recording activity completion:', error);
            throw error;
        }
    }

    /**
     * Ajoute une note à un ménage
     */
    async addNote(householdId, content, author) {
        try {
            const household = await this.householdRepo.findById(householdId);
            if (!household) {
                throw new EntityNotFoundError('Household', householdId);
            }

            household.addNote(content, author);
            await this.householdRepo.save(household);

            return household;
        } catch (error) {
            console.error('Error adding note:', error);
            throw error;
        }
    }

    /**
     * Recherche des ménages
     */
    async searchHouseholds(criteria) {
        try {
            return await this.householdRepo.search(criteria);
        } catch (error) {
            console.error('Error searching households:', error);
            throw error;
        }
    }

    /**
     * Obtient les statistiques des ménages
     */
    async getStats(zoneId = null) {
        try {
            return await this.householdRepo.getStats(zoneId);
        } catch (error) {
            console.error('Error getting household stats:', error);
            throw error;
        }
    }

    /**
     * Importe des ménages en batch
     */
    async importHouseholds(householdsData) {
        try {
            const households = [];

            for (const data of householdsData) {
                const coordinates = data.gps_lat && data.gps_lon
                    ? new Coordinates(data.gps_lat, data.gps_lon, data.gps_precision)
                    : null;

                const location = new Location(
                    data.region,
                    data.departement,
                    data.commune,
                    data.quartier_village,
                    coordinates
                );

                const normalize = (typeof window !== 'undefined' && window.normalizeStatus) ? window.normalizeStatus : (s => s);
                const household = new Household(
                    data.id || `H-${Date.now()}-${Math.random()}`,
                    location,
                    {
                        name: data.nom_prenom_chef,
                        phone: data.telephone,
                        cin: data.cin
                    },
                    normalize(data.statut || HouseholdStatus.NON_DEBUTE)
                );

                households.push(household);
            }

            // Sauvegarder en batch
            await this.householdRepo.saveBatch(households);

            this.eventBus.emit('households.imported', {
                count: households.length
            });

            return households;
        } catch (error) {
            console.error('Error importing households:', error);
            throw error;
        }
    }

    /**
     * Obtient les ménages avec retard
     */
    async getDelayedHouseholds(activityType, maxDelayDays = 7) {
        try {
            const allHouseholds = await this.householdRepo.findAll();
            const delayed = [];

            for (const household of allHouseholds) {
                const delay = household.getDelay(activityType);
                if (delay !== null && delay > maxDelayDays) {
                    delayed.push({
                        household,
                        delay
                    });
                }
            }

            // Trier par délai décroissant
            delayed.sort((a, b) => b.delay - a.delay);

            return delayed;
        } catch (error) {
            console.error('Error getting delayed households:', error);
            throw error;
        }
    }
}

// Export pour utilisation globale
if (typeof window !== 'undefined') {
    window.HouseholdService = HouseholdService;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = HouseholdService;
}
