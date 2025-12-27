/**
 * Repository pour les ménages
 * Gère la persistance des entités Household
 */
(function () {
    let _Household, _ValidationError, _Location, _HouseholdStatus;

    try {
        if (typeof module !== 'undefined' && module.exports) {
            _Household = require('../../domain/entities/Household');
            _ValidationError = require('../../shared/errors/DomainErrors').ValidationError;
            const enums = require('../../shared/constants/enums');
            _HouseholdStatus = enums.HouseholdStatus;
        }
    } catch (e) {
        // ignore
    }

    if (!_Household && typeof window !== 'undefined') {
        _Household = window.Household;
    }
    if (!_ValidationError && typeof window !== 'undefined') {
        _ValidationError = window.ValidationError;
    }
    if (!_HouseholdStatus && typeof window !== 'undefined') {
        _HouseholdStatus = window.HouseholdStatus;
    }

    const HouseholdLocal = _Household?.default || _Household?.Household || _Household;
    const ValidationErrorLocal = _ValidationError;
    const HouseholdStatusLocal = _HouseholdStatus;

    class HouseholdRepository {
        constructor(database) {
            if (!database) {
                throw new Error('Database is required');
            }
            this.db = database;
        }

        // --- NOUVELLES MÉTHODES STATIQUES (Streamlined) ---
        static async getAll() {
            if (!window.db) throw new Error('Database (db) not initialized');
            return await window.db.households.toArray();
        }

        static async update(household) {
            if (!window.db) throw new Error('Database (db) not initialized');
            return await window.db.households.update(household.id, household);
        }

        static async generateHouseholdsByRegion() {
            if (!window.db) throw new Error('Database (db) not initialized');
            const regions = [
                { name: "Dakar", households: 15000 },
                { name: "Thiès", households: 12000 },
                { name: "Diourbel", households: 8000 },
                { name: "Saint-Louis", households: 10000 },
                { name: "Tambacounda", households: 6000 },
                { name: "Kolda", households: 7000 },
                { name: "Ziguinchor", households: 5000 },
                { name: "Kaolack", households: 9000 },
                { name: "Fatick", households: 4000 },
                { name: "Kaffrine", households: 3000 },
                { name: "Sédhiou", households: 3500 },
                { name: "Kédougou", households: 2000 },
                { name: "Matam", households: 4500 },
                { name: "Louga", households: 6500 }
            ];

            const batchSize = 5000;
            let totalCreated = 0;

            for (const region of regions) {
                const regionHouseholds = Array.from({ length: region.households }, (_, i) => ({
                    owner: { name: `Propriétaire ${i + 1} (${region.name})` },
                    zone: region.name,
                    region: region.name,
                    status: 'Attente démarrage',
                    delay: 0,
                    cost: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }));

                // Bulk add in chunks to avoid memory issues
                for (let i = 0; i < regionHouseholds.length; i += batchSize) {
                    const chunk = regionHouseholds.slice(i, i + batchSize);
                    await window.db.households.bulkAdd(chunk);
                    totalCreated += chunk.length;
                    console.log(`Génération: ${totalCreated} ménages créés...`);
                }
            }
            return totalCreated;
        }

        /**
         * Trouve un ménage par son ID
         */
        async findById(id) {
            try {
                const data = await this.db.households.get(id);
                if (!data) return null;
                return this.hydrate(data);
            } catch (error) {
                console.error('Error finding household by ID:', error);
                throw error;
            }
        }

        /**
         * Trouve tous les ménages
         */
        async findAll() {
            try {
                const data = await this.db.households.toArray();
                return data.map(d => this.hydrate(d));
            } catch (error) {
                console.error('Error finding all households:', error);
                throw error;
            }
        }

        /**
         * Trouve les ménages par zone
         */
        async findByZone(zoneId) {
            try {
                const data = await this.db.households
                    .where('zoneId')
                    .equals(zoneId)
                    .toArray();
                return data.map(d => this.hydrate(d));
            } catch (error) {
                console.error('Error finding households by zone:', error);
                throw error;
            }
        }

        /**
         * Trouve les ménages par statut
         */
        async findByStatus(status) {
            try {
                const data = await this.db.households
                    .where('status')
                    .equals(status)
                    .toArray();
                return data.map(d => this.hydrate(d));
            } catch (error) {
                console.error('Error finding households by status:', error);
                throw error;
            }
        }

        /**
         * Trouve les ménages par zone et statut
         */
        async findByZoneAndStatus(zoneId, status) {
            try {
                const data = await this.db.households
                    .where('[zoneId+status]')
                    .equals([zoneId, status])
                    .toArray();
                return data.map(d => this.hydrate(d));
            } catch (error) {
                console.error('Error finding households by zone and status:', error);
                throw error;
            }
        }

        /**
         * Sauvegarde un ménage
         */
        async save(household) {
            if (!(household instanceof (HouseholdLocal || window.Household))) {
                throw new (ValidationErrorLocal || window.ValidationError)('Parameter must be a Household instance');
            }

            try {
                const data = this.dehydrate(household);
                await this.db.households.put(data);

                if (typeof window !== 'undefined' && window.eventBus) {
                    window.eventBus.emit('household.saved', {
                        householdId: household.id,
                        zoneId: household.location?.zoneId
                    });
                }

                return household;
            } catch (error) {
                console.error('Error saving household:', error);
                throw error;
            }
        }

        /**
         * Sauvegarde plusieurs ménages en batch
         */
        async saveBatch(households) {
            try {
                const data = households.map(h => this.dehydrate(h));
                await this.db.households.bulkPut(data);

                if (typeof window !== 'undefined' && window.eventBus) {
                    window.eventBus.emit('households.batch.saved', {
                        count: households.length
                    });
                }

                return households;
            } catch (error) {
                console.error('Error saving households batch:', error);
                throw error;
            }
        }

        /**
         * Met à jour le statut d'un ménage
         */
        async updateStatus(householdId, newStatus, updatedBy, reason = null) {
            try {
                const household = await this.findById(householdId);
                if (!household) {
                    throw new Error(`Household not found: ${householdId}`);
                }

                // Note: household.updateStatus logic should be in the entity
                // Here we just save the updated entity if we modified it
                // Assuming the caller modifies the entity or we do it here if the entity has the method
                // For now, let's assume the entity has a method or we just update the field if simple
                // But better to let the service handle domain logic.
                // This repository method might be redundant if we use save(), but useful for quick updates.

                // Let's rely on save() for now to keep it simple and consistent
                // But if we need to implement this:
                household._status = newStatus; // Direct access or via setter
                // household.addStatusHistory(...)

                return await this.save(household);
            } catch (error) {
                console.error('Error updating household status:', error);
                throw error;
            }
        }

        /**
         * Supprime un ménage
         */
        async delete(id) {
            try {
                await this.db.households.delete(id);

                if (typeof window !== 'undefined' && window.eventBus) {
                    window.eventBus.emit('household.deleted', {
                        householdId: id
                    });
                }
            } catch (error) {
                console.error('Error deleting household:', error);
                throw error;
            }
        }

        /**
         * Compte les ménages
         */
        async count() {
            try {
                return await this.db.households.count();
            } catch (error) {
                console.error('Error counting households:', error);
                throw error;
            }
        }

        /**
         * Compte les ménages par statut
         */
        async countByStatus(status) {
            try {
                return await this.db.households
                    .where('status')
                    .equals(status)
                    .count();
            } catch (error) {
                console.error('Error counting households by status:', error);
                throw error;
            }
        }

        /**
         * Obtient des statistiques sur les ménages
         */
        async getStats(zoneId = null) {
            try {
                let collection = this.db.households;

                if (zoneId) {
                    collection = collection.where('zoneId').equals(zoneId);
                }

                const households = await collection.toArray();
                const stats = {
                    total: households.length,
                    byStatus: {}
                };

                const HS = HouseholdStatusLocal || window.HouseholdStatus;
                if (HS) {
                    for (const status of Object.values(HS)) {
                        stats.byStatus[status] = households.filter(h => h.status === status).length;
                    }
                }

                return stats;
            } catch (error) {
                console.error('Error getting household stats:', error);
                throw error;
            }
        }

        /**
         * Recherche de ménages
         */
        async search(criteria) {
            try {
                let collection = this.db.households;

                if (criteria.zoneId) {
                    collection = collection.where('zoneId').equals(criteria.zoneId);
                }

                if (criteria.status) {
                    collection = collection.where('status').equals(criteria.status);
                }

                let data = await collection.toArray();

                // Filtres additionnels en mémoire
                if (criteria.ownerName) {
                    data = data.filter(h =>
                        h.owner.name.toLowerCase().includes(criteria.ownerName.toLowerCase())
                    );
                }

                if (criteria.phone) {
                    data = data.filter(h =>
                        h.owner.phone && h.owner.phone.includes(criteria.phone)
                    );
                }

                return data.map(d => this.hydrate(d));
            } catch (error) {
                console.error('Error searching households:', error);
                throw error;
            }
        }

        /**
         * Convertit les données de la DB en entité Household
         */
        hydrate(data) {
            try {
                return (HouseholdLocal || window.Household).fromJSON(data);
            } catch (error) {
                console.error('Error hydrating household:', error);
                throw error;
            }
        }

        /**
         * Convertit une entité Household en données pour la DB
         */
        dehydrate(household) {
            try {
                return household.toJSON();
            } catch (error) {
                console.error('Error dehydrating household:', error);
                throw error;
            }
        }
    }

    // Export pour utilisation globale
    if (typeof window !== 'undefined') {
        window.HouseholdRepository = HouseholdRepository;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = HouseholdRepository;
    }
})();
