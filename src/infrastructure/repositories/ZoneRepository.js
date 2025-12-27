/**
 * Repository pour les zones
 * Gère la persistance des entités Zone
 */
(function () {
    let _Zone, _ValidationError;

    try {
        if (typeof module !== 'undefined' && module.exports) {
            _Zone = require('../../domain/entities/Zone');
            _ValidationError = require('../../shared/errors/DomainErrors').ValidationError;
        }
    } catch (e) {
        // ignore
    }

    if (!_Zone && typeof window !== 'undefined') {
        _Zone = window.Zone;
    }
    if (!_ValidationError && typeof window !== 'undefined') {
        _ValidationError = window.ValidationError;
    }

    const ZoneLocal = _Zone?.default || _Zone?.Zone || _Zone;
    const ValidationErrorLocal = _ValidationError;

    class ZoneRepository {
        constructor(database) {
            if (!database) {
                throw new Error('Database is required');
            }
            this.db = database;
        }

        /**
         * Trouve une zone par son ID
         */
        async findById(id) {
            try {
                const data = await this.db.zones.get(id);
                if (!data) return null;
                return this.hydrate(data);
            } catch (error) {
                console.error('Error finding zone by ID:', error);
                throw error;
            }
        }

        /**
         * Trouve toutes les zones
         */
        async findAll() {
            try {
                const data = await this.db.zones.toArray();
                return data.map(d => this.hydrate(d));
            } catch (error) {
                console.error('Error finding all zones:', error);
                throw error;
            }
        }

        /**
         * Trouve les zones par projet
         */
        async findByProject(projectId) {
            try {
                const data = await this.db.zones
                    .where('projectId')
                    .equals(projectId)
                    .toArray();
                return data.map(d => this.hydrate(d));
            } catch (error) {
                console.error('Error finding zones by project:', error);
                throw error;
            }
        }

        /**
         * Trouve une zone par projet et nom
         */
        async findByProjectAndName(projectId, name) {
            try {
                const data = await this.db.zones
                    .where('[projectId+name]')
                    .equals([projectId, name])
                    .first();
                if (!data) return null;
                return this.hydrate(data);
            } catch (error) {
                console.error('Error finding zone by project and name:', error);
                throw error;
            }
        }

        /**
         * Sauvegarde une zone
         */
        async save(zone) {
            if (!(zone instanceof (ZoneLocal || window.Zone))) {
                throw new (ValidationErrorLocal || window.ValidationError)('Parameter must be a Zone instance');
            }

            try {
                const data = this.dehydrate(zone);
                await this.db.zones.put(data);

                if (typeof window !== 'undefined' && window.eventBus) {
                    window.eventBus.emit('zone.saved', {
                        zoneId: zone.id
                    });
                }

                return zone;
            } catch (error) {
                console.error('Error saving zone:', error);
                throw error;
            }
        }

        /**
         * Sauvegarde plusieurs zones en batch
         */
        async saveBatch(zones) {
            try {
                const data = zones.map(z => this.dehydrate(z));
                await this.db.zones.bulkPut(data);

                if (typeof window !== 'undefined' && window.eventBus) {
                    window.eventBus.emit('zones.batch.saved', {
                        count: zones.length
                    });
                }

                return zones;
            } catch (error) {
                console.error('Error saving zones batch:', error);
                throw error;
            }
        }

        /**
         * Supprime une zone
         */
        async delete(id) {
            try {
                await this.db.zones.delete(id);

                if (typeof window !== 'undefined' && window.eventBus) {
                    window.eventBus.emit('zone.deleted', {
                        zoneId: id
                    });
                }
            } catch (error) {
                console.error('Error deleting zone:', error);
                throw error;
            }
        }

        /**
         * Compte les zones
         */
        async count() {
            try {
                return await this.db.zones.count();
            } catch (error) {
                console.error('Error counting zones:', error);
                throw error;
            }
        }

        /**
         * Compte les zones par projet
         */
        async countByProject(projectId) {
            try {
                return await this.db.zones
                    .where('projectId')
                    .equals(projectId)
                    .count();
            } catch (error) {
                console.error('Error counting zones by project:', error);
                throw error;
            }
        }

        /**
         * Obtient des statistiques sur les zones
         */
        async getStats(projectId = null) {
            try {
                let collection = this.db.zones;

                if (projectId) {
                    collection = collection.where('projectId').equals(projectId);
                }

                const zones = await collection.toArray();
                const stats = {
                    total: zones.length,
                    totalHouses: zones.reduce((sum, z) => sum + z.totalHouses, 0),
                    completedHouses: zones.reduce((sum, z) => sum + z.completedHouses, 0),
                    averageProgress: 0,
                    completed: zones.filter(z => z.completedHouses >= z.totalHouses).length
                };

                if (stats.totalHouses > 0) {
                    stats.averageProgress = (stats.completedHouses / stats.totalHouses) * 100;
                }

                return stats;
            } catch (error) {
                console.error('Error getting zone stats:', error);
                throw error;
            }
        }

        /**
         * Recherche de zones
         */
        async search(criteria) {
            try {
                let collection = this.db.zones;

                if (criteria.projectId) {
                    collection = collection.where('projectId').equals(criteria.projectId);
                }

                let data = await collection.toArray();

                // Filtres additionnels
                if (criteria.name) {
                    data = data.filter(z =>
                        z.name.toLowerCase().includes(criteria.name.toLowerCase())
                    );
                }

                if (criteria.minProgress !== undefined) {
                    data = data.filter(z => {
                        const progress = (z.completedHouses / z.totalHouses) * 100;
                        return progress >= criteria.minProgress;
                    });
                }

                if (criteria.maxProgress !== undefined) {
                    data = data.filter(z => {
                        const progress = (z.completedHouses / z.totalHouses) * 100;
                        return progress <= criteria.maxProgress;
                    });
                }

                return data.map(d => this.hydrate(d));
            } catch (error) {
                console.error('Error searching zones:', error);
                throw error;
            }
        }

        /**
         * Convertit les données de la DB en entité Zone
         */
        hydrate(data) {
            try {
                return (ZoneLocal || window.Zone).fromJSON(data);
            } catch (error) {
                console.error('Error hydrating zone:', error);
                throw error;
            }
        }

        /**
         * Convertit une entité Zone en données pour la DB
         */
        dehydrate(zone) {
            try {
                return zone.toJSON();
            } catch (error) {
                console.error('Error dehydrating zone:', error);
                throw error;
            }
        }
    }

    // Export pour utilisation globale
    if (typeof window !== 'undefined') {
        window.ZoneRepository = ZoneRepository;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ZoneRepository;
    }
})();
