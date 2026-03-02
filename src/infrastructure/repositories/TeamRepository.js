/**
 * Repository pour les équipes
 * Gère la persistance des entités Team
 */
// (function () {
    let _Team, _ValidationError, _TeamType;

    try {
        if (typeof module !== 'undefined' && module.exports) {
            _Team = require('../../domain/entities/Team');
            _ValidationError = require('../../shared/errors/DomainErrors').ValidationError;
            _TeamType = require('../../shared/constants/enums').TeamType;
        }
    } catch (e) {
        // ignore
    }

    if (!_Team && typeof window !== 'undefined') {
        _Team = window.Team;
    }
    if (!_ValidationError && typeof window !== 'undefined') {
        _ValidationError = window.ValidationError;
    }
    if (!_TeamType && typeof window !== 'undefined') {
        _TeamType = window.TeamType;
    }

    const TeamLocal = _Team?.default || _Team?.Team || _Team;
    const ValidationErrorLocal = _ValidationError;
    const TeamTypeLocal = _TeamType;

    export class TeamRepository {
        constructor(database) {
            if (!database) {
                throw new Error('Database is required');
            }
            this.db = database;
        }

        // --- NOUVELLES MÉTHODES STATIQUES (Streamlined) ---
        static async getAll() {
            if (!window.db) throw new Error('Database (db) not initialized');
            return await window.db.teams.toArray();
        }

        static async getById(id) {
            if (!window.db) throw new Error('Database (db) not initialized');
            return await window.db.teams.get(id);
        }

        static async update(team) {
            if (!window.db) throw new Error('Database (db) not initialized');
            return await window.db.teams.update(team.id, team);
        }

        static async resetAssignments(teamId) {
            if (!window.db) throw new Error('Database (db) not initialized');
            const households = await window.db.households.where('teamId').equals(teamId).toArray();
            for (const household of households) {
                await window.db.households.update(household.id, {
                    teamId: null,
                    status: (window.HouseholdStatus?.NON_DEBUTE) || 'Non débuté'
                });
            }
            return households.length;
        }

        static async delete(id) {
            if (!window.db) throw new Error('Database (db) not initialized');
            return await window.db.teams.delete(id);
        }

        static async deleteByType(type) {
            if (!window.db) throw new Error('Database (db) not initialized');

            // 1. Trouver toutes les équipes de ce type
            const teams = await window.db.teams.where('type').equals(type).toArray();
            console.log(`🗑️ Deleting ${teams.length} teams of type: ${type}`);

            // 2. Pour chaque équipe, réinitialiser les assignations
            for (const team of teams) {
                await this.resetAssignments(team.id);
                await window.db.teams.delete(team.id);
            }

            return teams.length;
        }

        static async createDefaultTeams() {
            if (!window.db) throw new Error('Database (db) not initialized');
            const defaultTeams = [
                { name: 'Équipe Maçons Alpha', type: 'Maçon', zoneId: 'Dakar' },
                { name: 'Équipe Maçons Beta', type: 'Maçon', zoneId: 'Thiès' },
                { name: 'Équipe Réseau 1', type: 'Réseau', zoneId: 'Dakar' },
                { name: 'Équipe Intérieur 1', type: 'Intérieur', zoneId: 'Saint-Louis' },
                { name: 'Contrôleurs Nationaux', type: 'Contrôleur', zoneId: 'Global' },
                { name: 'Préparateurs 1', type: 'Préparateur', zoneId: 'Dakar' },
                { name: 'Livreurs 1', type: 'Livreur', zoneId: 'Dakar' }
            ];
            await window.db.teams.bulkAdd(defaultTeams);
            return defaultTeams;
        }

        static async addTeam(team) {
            if (!window.db) throw new Error('Database (db) not initialized');
            return await window.db.teams.add(team);
        }

        static async addTeamType(name, type, capacity, region = 'National', equipment = []) {
            if (!window.db) throw new Error('Database (db) not initialized');
            const newTeam = {
                id: `team-${type.toLowerCase()}-${Date.now()}`,
                name: name,
                type: type,
                zoneId: region,
                capacity: capacity,
                equipment: equipment,
                isActive: true
            };
            await window.db.teams.add(newTeam);
            return newTeam;
        }

        /**
         * Trouve une équipe par son ID
         */
        async findById(id) {
            try {
                const data = await this.db.teams.get(id);
                if (!data) return null;
                return this.hydrate(data);
            } catch (error) {
                console.error('Error finding team by ID:', error);
                throw error;
            }
        }

        /**
         * Trouve toutes les équipes
         */
        async findAll() {
            try {
                const data = await this.db.teams.toArray();
                return data.map(d => this.hydrate(d));
            } catch (error) {
                console.error('Error finding all teams:', error);
                throw error;
            }
        }

        /**
         * Trouve les équipes par type
         */
        async findByType(type) {
            try {
                const data = await this.db.teams
                    .where('type')
                    .equals(type)
                    .toArray();
                return data.map(d => this.hydrate(d));
            } catch (error) {
                console.error('Error finding teams by type:', error);
                throw error;
            }
        }

        /**
         * Trouve les équipes par zone
         */
        async findByZone(zoneId) {
            try {
                const data = await this.db.teams
                    .where('zoneId')
                    .equals(zoneId)
                    .toArray();
                return data.map(d => this.hydrate(d));
            } catch (error) {
                console.error('Error finding teams by zone:', error);
                throw error;
            }
        }

        /**
         * Trouve les équipes par type et zone
         */
        async findByTypeAndZone(type, zoneId) {
            try {
                const data = await this.db.teams
                    .where('[type+zoneId]')
                    .equals([type, zoneId])
                    .toArray();
                return data.map(d => this.hydrate(d));
            } catch (error) {
                console.error('Error finding teams by type and zone:', error);
                throw error;
            }
        }

        /**
         * Sauvegarde une équipe
         */
        async save(team) {
            if (!(team instanceof (TeamLocal || window.Team))) {
                throw new (ValidationErrorLocal || window.ValidationError)('Parameter must be a Team instance');
            }

            try {
                const data = this.dehydrate(team);
                await this.db.teams.put(data);

                if (typeof window !== 'undefined' && window.eventBus) {
                    window.eventBus.emit('team.saved', {
                        teamId: team.id
                    });
                }

                return team;
            } catch (error) {
                console.error('Error saving team:', error);
                throw error;
            }
        }

        /**
         * Sauvegarde plusieurs équipes en batch
         */
        async saveBatch(teams) {
            try {
                const data = teams.map(t => this.dehydrate(t));
                await this.db.teams.bulkPut(data);

                if (typeof window !== 'undefined' && window.eventBus) {
                    window.eventBus.emit('teams.batch.saved', {
                        count: teams.length
                    });
                }

                return teams;
            } catch (error) {
                console.error('Error saving teams batch:', error);
                throw error;
            }
        }

        /**
         * Supprime une équipe
         */
        async delete(id) {
            try {
                await this.db.teams.delete(id);

                if (typeof window !== 'undefined' && window.eventBus) {
                    window.eventBus.emit('team.deleted', {
                        teamId: id
                    });
                }
            } catch (error) {
                console.error('Error deleting team:', error);
                throw error;
            }
        }

        /**
         * Compte les équipes
         */
        async count() {
            try {
                return await this.db.teams.count();
            } catch (error) {
                console.error('Error counting teams:', error);
                throw error;
            }
        }

        /**
         * Compte les équipes par type
         */
        async countByType(type) {
            try {
                return await this.db.teams
                    .where('type')
                    .equals(type)
                    .count();
            } catch (error) {
                console.error('Error counting teams by type:', error);
                throw error;
            }
        }

        /**
         * Obtient des statistiques sur les équipes
         */
        async getStats(zoneId = null) {
            try {
                let collection = this.db.teams;

                if (zoneId) {
                    collection = collection.where('zoneId').equals(zoneId);
                }

                const teams = await collection.toArray();
                const stats = {
                    total: teams.length,
                    byType: {},
                    active: teams.filter(t => t.isActive).length,
                    inactive: teams.filter(t => !t.isActive).length
                };

                const TT = TeamTypeLocal || window.TeamType;
                if (TT) {
                    for (const type of Object.values(TT)) {
                        stats.byType[type] = teams.filter(t => t.type === type).length;
                    }
                }

                return stats;
            } catch (error) {
                console.error('Error getting team stats:', error);
                throw error;
            }
        }

        /**
         * Recherche d'équipes
         */
        async search(criteria) {
            try {
                let collection = this.db.teams;

                if (criteria.type) {
                    collection = collection.where('type').equals(criteria.type);
                }

                if (criteria.zoneId) {
                    collection = collection.where('zoneId').equals(criteria.zoneId);
                }

                let data = await collection.toArray();

                // Filtres additionnels
                if (criteria.isActive !== undefined) {
                    data = data.filter(t => t.isActive === criteria.isActive);
                }

                return data.map(d => this.hydrate(d));
            } catch (error) {
                console.error('Error searching teams:', error);
                throw error;
            }
        }

        /**
         * Convertit les données de la DB en entité Team
         */
        hydrate(data) {
            try {
                return (TeamLocal || window.Team).fromJSON(data);
            } catch (error) {
                console.error('Error hydrating team:', error);
                throw error;
            }
        }

        /**
         * Convertit une entité Team en données pour la DB
         */
        dehydrate(team) {
            try {
                return team.toJSON();
            } catch (error) {
                console.error('Error dehydrating team:', error);
                throw error;
            }
        }
    }

    // Export pour utilisation globale
    if (typeof window !== 'undefined') {
        window.TeamRepository = TeamRepository;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TeamRepository;
    }
// })();
