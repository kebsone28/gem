/**
 * Store pour la gestion de l'état des projets
 * Implémente le pattern Observer pour les mises à jour réactives
 */
export class ProjectStore {
    constructor(projectService) {
        this.projectService = projectService;
        this._state = {
            currentProject: null,
            projects: [],
            loading: false,
            error: null
        };
        this._listeners = [];
    }

    /**
     * Obtient l'état actuel
     */
    getState() {
        return { ...this._state };
    }

    /**
     * Obtient le projet courant
     */
    getCurrentProject() {
        return this._state.currentProject;
    }

    /**
     * Obtient tous les projets
     */
    getProjects() {
        return [...this._state.projects];
    }

    /**
     * Vérifie si en chargement
     */
    isLoading() {
        return this._state.loading;
    }

    /**
     * Obtient l'erreur
     */
    getError() {
        return this._state.error;
    }

    /**
     * S'abonne aux changements d'état
     */
    subscribe(listener) {
        if (typeof listener !== 'function') {
            throw new Error('Listener must be a function');
        }
        this._listeners.push(listener);

        // Retourner une fonction de désabonnement
        return () => {
            const index = this._listeners.indexOf(listener);
            if (index > -1) {
                this._listeners.splice(index, 1);
            }
        };
    }

    /**
     * Charge tous les projets
     */
    async loadProjects(filters = {}) {
        this._setState({ loading: true, error: null });

        try {
            const projects = await this.projectService.listProjects(filters);
            this._setState({
                projects,
                loading: false
            });
        } catch (error) {
            this._setState({
                error: error.message,
                loading: false
            });
            throw error;
        }
    }

    /**
     * Charge un projet spécifique
     */
    async loadProject(projectId) {
        this._setState({ loading: true, error: null });

        try {
            const { project } = await this.projectService.getProjectWithDetails(projectId);
            this._setState({
                currentProject: project,
                loading: false
            });
        } catch (error) {
            this._setState({
                error: error.message,
                loading: false
            });
            throw error;
        }
    }

    /**
     * Crée un nouveau projet
     */
    async createProject(data) {
        this._setState({ loading: true, error: null });

        try {
            const project = await this.projectService.createProject(data);

            // Ajouter aux projets
            const projects = [...this._state.projects, project];

            this._setState({
                projects,
                currentProject: project,
                loading: false
            });

            return project;
        } catch (error) {
            this._setState({
                error: error.message,
                loading: false
            });
            throw error;
        }
    }

    /**
     * Met à jour le projet courant
     */
    async updateCurrentProject(updates) {
        if (!this._state.currentProject) {
            throw new Error('No current project');
        }

        this._setState({ loading: true, error: null });

        try {
            const project = await this.projectService.updateProject(
                this._state.currentProject.id,
                updates
            );

            // Mettre à jour dans la liste
            const projects = this._state.projects.map(p =>
                p.id === project.id ? project : p
            );

            this._setState({
                currentProject: project,
                projects,
                loading: false
            });

            return project;
        } catch (error) {
            this._setState({
                error: error.message,
                loading: false
            });
            throw error;
        }
    }

    /**
     * Démarre le projet courant
     */
    async startCurrentProject() {
        if (!this._state.currentProject) {
            throw new Error('No current project');
        }

        this._setState({ loading: true, error: null });

        try {
            const project = await this.projectService.startProject(
                this._state.currentProject.id
            );

            const projects = this._state.projects.map(p =>
                p.id === project.id ? project : p
            );

            this._setState({
                currentProject: project,
                projects,
                loading: false
            });

            return project;
        } catch (error) {
            this._setState({
                error: error.message,
                loading: false
            });
            throw error;
        }
    }

    /**
     * Supprime un projet
     */
    async deleteProject(projectId) {
        this._setState({ loading: true, error: null });

        try {
            await this.projectService.deleteProject(projectId);

            // Retirer de la liste
            const projects = this._state.projects.filter(p => p.id !== projectId);

            // Réinitialiser le projet courant si c'est celui supprimé
            const currentProject = this._state.currentProject?.id === projectId
                ? null
                : this._state.currentProject;

            this._setState({
                projects,
                currentProject,
                loading: false
            });
        } catch (error) {
            this._setState({
                error: error.message,
                loading: false
            });
            throw error;
        }
    }

    /**
     * Réinitialise l'état
     */
    reset() {
        this._setState({
            currentProject: null,
            projects: [],
            loading: false,
            error: null
        });
    }

    /**
     * Met à jour l'état et notifie les listeners
     */
    _setState(updates) {
        this._state = { ...this._state, ...updates };
        this._notifyListeners();
    }

    /**
     * Notifie tous les listeners
     */
    _notifyListeners() {
        const state = this.getState();
        for (const listener of this._listeners) {
            try {
                listener(state);
            } catch (error) {
                console.error('Error in store listener:', error);
            }
        }
    }
}

// Export pour utilisation globale
if (typeof window !== 'undefined') {
    window.ProjectStore = ProjectStore;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectStore;
}
