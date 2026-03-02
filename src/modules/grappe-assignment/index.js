/**
 * GrappeAssignment Module - Enterprise SaaS Entry Point.
 */

import GrappeAssignmentModel from './GrappeAssignmentModel.js';
import GrappeAssignmentService from './GrappeAssignmentService.js';
import GrappeAssignmentView from './GrappeAssignmentView.js';
import GrappeAssignmentController from './GrappeAssignmentController.js';

// Factory function to initialize the module
export function createModule(projectService, config, teamTypes) {
    const model = new GrappeAssignmentModel({ TEAM_TYPES: teamTypes });
    const service = new GrappeAssignmentService(projectService);
    const view = new GrappeAssignmentView('grappeCardGrid');

    const controller = new GrappeAssignmentController({
        model,
        service,
        view,
        config
    });

    return controller;
}

// Export pour utilisation globale (compatibilité legacy)
export const GrappeModule = {
    create: createModule
};

if (typeof window !== 'undefined') {
    window.GrappeModule = GrappeModule;
    window.GrappeAssignmentModel = GrappeAssignmentModel;
    console.log('✅ GrappeAssignmentModel attached to window.GrappeAssignmentModel');
}

export default GrappeAssignmentModel;
