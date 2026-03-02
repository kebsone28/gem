/**
 * GrappeAssignmentController - Orchestrates the module.
 */
class GrappeAssignmentController {
    constructor({ model, service, view, config }) {
        this.model = model;
        this.service = service;
        this.view = view;
        this.config = config;

        this.view.setTeamTypes(this.model.TEAM_TYPES);

        // Memoization cache
        this._assignmentCache = new Map();
    }

    /**
     * render - Main entry point for the module UI.
     */
    async render(filters = { region: '', status: 'all' }) {
        console.time('GrappeModule.render');

        const sousGrappes = this.config.sous_grappes || [];

        // Filter logic using the Model
        const filtered = this.model.filterSubGrappes(
            sousGrappes,
            filters,
            (id) => this._getCachedAssignments(id)
        );

        // Render using the View
        this.view.render(
            filtered,
            (id) => this._getCachedAssignments(id),
            (asgn) => this.model.computeCompleteness(asgn),
            (sg, asgn) => this.handleCardClick(sg, asgn)
        );

        console.timeEnd('GrappeModule.render');
        return filtered;
    }

    /**
     * _getCachedAssignments - Memoization helper.
     */
    _getCachedAssignments(sgId) {
        if (!this._assignmentCache.has(sgId)) {
            this._assignmentCache.set(sgId, this.service.getAssignments(sgId));
        }
        return this._assignmentCache.get(sgId);
    }

    clearCache() {
        this._assignmentCache.clear();
    }

    /**
     * handleCardClick - Internal event handling.
     */
    handleCardClick(sg, asgn) {
        console.log('Industrial Controller: Card Clicked', sg.id);
        // Delegate to modal logic (existing singleton for now)
        if (window.GrappeAssignmentUI && window.GrappeAssignmentUI.openModal) {
            window.GrappeAssignmentUI.openModal(sg.id);
        }
    }
}

export default GrappeAssignmentController;
