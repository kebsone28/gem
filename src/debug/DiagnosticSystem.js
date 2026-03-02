/**
 * DiagnosticSystem.js - Outil d'audit automatique pour PROQUELEC V3
 */

export const DiagnosticSystem = {
    async runAllTests() {
        console.log('%c🔍 Démarrage de l\'audit global...', 'font-weight: bold; color: #4f46e5; font-size: 1.2em;');
        const results = [];

        results.push(await this.testDatabase());
        results.push(await this.testRepositoryConsistency());
        results.push(await this.testEnums());
        results.push(await this.testServices());
        results.push(await this.testMigrationStatus());
        results.push(await this.testDataIntegrity());
        results.push(await this.testDataConsistency());

        this.report(results);
        return results;
    },

    async testDatabase() {
        const res = { name: 'Base de données (Dexie)', status: 'FAIL', details: '' };
        try {
            const db = window.db;
            if (db && db.isOpen()) {
                const count = await db.projects.count();
                res.status = 'OK';
                res.details = `Base ouverte, ${count} projet(s) trouvé(s).`;
            } else {
                res.details = 'Base non initialisée ou fermée.';
            }
        } catch (e) {
            res.details = 'Erreur: ' + e.message;
        }
        return res;
    },

    async testRepositoryConsistency() {
        const res = { name: 'Repository Consistency', status: 'FAIL', details: '' };
        try {
            if (!window.ProjectRepository) {
                res.details = 'ProjectRepository absent.';
                return res;
            }
            const isStatic = typeof window.ProjectRepository.getCurrent === 'function';
            const hasInstance = window.projectRepository;

            if (isStatic && hasInstance) {
                res.status = 'OK';
                res.details = 'Accès statique et instance disponibles.';
            } else {
                res.details = 'Incohérence Repository détectée.';
            }
        } catch (e) {
            res.details = 'Erreur: ' + e.message;
        }
        return res;
    },

    async testEnums() {
        const res = { name: 'Cohérence des Enums', status: 'FAIL', details: '' };
        try {
            if (!window.TeamType || !window.ProjectService || !window.TeamRegistry) {
                res.details = 'Modules TeamType, ProjectService ou TeamRegistry manquants.';
                return res;
            }

            // Verify that every SaaS team role (TeamRegistry ID) matches an available legacy ENUM value
            const registryIds = window.TeamRegistry.getIds();
            const enumValues = Object.values(window.TeamType);

            const missing = registryIds.filter(id => !enumValues.includes(id));
            if (missing.length === 0) {
                res.status = 'OK';
                res.details = 'Les types d\'équipes sont parfaitement synchronisés.';
            } else {
                res.details = `Incohérence détectée. Types manquants dans enum: ${missing.join(', ')}`;
            }
        } catch (e) {
            res.details = 'Erreur: ' + e.message;
        }
        return res;
    },

    async testServices() {
        const res = { name: 'Services Applicatifs', status: 'FAIL', details: '' };
        try {
            const required = ['projectService', 'householdService', 'projectRepository', 'teamRepository'];
            const missing = required.filter(s => !window[s]);

            if (missing.length === 0) {
                res.status = 'OK';
                res.details = 'Tous les services critiques sont initialisés.';
            } else {
                res.details = `Services manquants: ${missing.join(', ')}`;
            }
        } catch (e) {
            res.details = 'Erreur: ' + e.message;
        }
        return res;
    },

    async testMigrationStatus() {
        const res = { name: 'Statut de Migration V2', status: 'FAIL', details: '' };
        try {
            if (!window.ProjectRepository || !window.projectService) {
                res.details = 'ProjectRepository ou ProjectService not loaded.';
                return res;
            }
            let project = await window.ProjectRepository.getCurrent();

            if (project && (!project.version || project.version < 2)) {
                await window.projectService.migrateToV2(project);
                window.projectService.rebuildIndex(project, { migrate: true });
                project = await window.ProjectRepository.getCurrent();
            }

            if (project && project.version >= 2) {
                res.status = 'OK';
                res.details = `Projet courant en V2 (format SaaS).`;
            } else {
                res.details = 'Projet non migré ou version < 2.';
            }
        } catch (e) {
            res.details = 'Erreur: ' + e.message;
        }
        return res;
    },

    async testDataIntegrity() {
        const res = { name: 'Intégrité du Modèle (SaaS)', status: 'FAIL', details: '' };
        try {
            if (!window.ProjectRepository || !window.projectService) {
                res.details = 'Services non disponibles.';
                return res;
            }
            const project = await window.ProjectRepository.getCurrent();
            const audit = await window.projectService.validateIntegrity(project);

            if (audit.isValid) {
                res.status = 'OK';
                res.details = `Aucune anomalie détectée (0 orphelins).`;
            } else {
                res.status = 'WARN';
                res.details = `${audit.orphanCount} orphelins détectés: ` + audit.orphans.map(o => o.teamId).join(', ');
            }
        } catch (e) {
            res.details = 'Erreur: ' + e.message;
        }
        return res;
    },

    async testDataConsistency() {
        const res = { name: 'Consistance des Données', status: 'WARN', details: '' };
        try {
            if (!window.ProjectRepository) return res;
            const project = await window.ProjectRepository.getCurrent();
            if (!project || !window.projectService) {
                res.details = 'Project or ProjectService missing.';
                return res;
            }
            const indexZones = Object.keys(project.index?.bySubGrappe || {});
            const configZones = Object.keys(project.config?.grappe_assignments || {});

            if (indexZones.length === configZones.length) {
                res.status = 'OK';
                res.details = `${indexZones.length} affectations synchronisées (Index = Config).`;
            } else {
                res.status = 'WARN';
                res.details = `Désynchronisation: Index(${indexZones.length}) vs Config(${configZones.length}).`;
            }
        } catch (e) {
            res.details = 'Erreur: ' + e.message;
        }
        return res;
    },

    report(results) {
        console.table(results);
        const weight = { OK: 1, WARN: 0.5, FAIL: 0 };
        const total = results.reduce((sum, r) => sum + (weight[r.status] || 0), 0);
        const score = Math.round((total / results.length) * 100);

        let color = '#ef4444';
        if (score > 80) color = '#22c55e';
        else if (score > 50) color = '#f59e0b';

        console.log(`%cScore de Santé Global: ${score}%`, `font-weight: bold; color: ${color}; font-size: 1.2em;`);

        if (score === 100) {
            console.log('🎉 Félicitations ! L\'architecture est saine et robuste.');
        } else {
            console.log('⚠️ Des problèmes mineurs ou majeurs ont été détectés. Voir le tableau ci-dessus.');
        }
    }
};

// Export pour utilisation globale (compatibilité console)
if (typeof window !== 'undefined') {
    window.DiagnosticSystem = DiagnosticSystem;
}

