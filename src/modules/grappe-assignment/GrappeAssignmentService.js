/**
 * GrappeAssignmentService - Handles persistence and interaction with ProjectService/Repository.
 */
class GrappeAssignmentService {
    /**
     * @param {Object} projectService - The global project service instance.
     */
    constructor(projectService) {
        this.projectService = projectService;
    }

    /**
     * getAssignments - Retrieves current assignments for a sub-grappe.
     */
    getAssignments(sgId) {
        return this.projectService.getAssignments(sgId);
    }

    /**
     * updateAssignment - Updates team assignment and persists.
     */
    async updateAssignment(projectId, sgId, tradeKey, teamIds) {
        const project = await this.projectService.project; // Ensure we have latest
        if (!project) throw new Error("No active project");

        // Update in-memory service state (or use its methods)
        // Note: We use the existing logic inside projectService for consistency
        await this.projectService.updateAssignment(sgId, tradeKey, teamIds);

        // Re-sync global project instance if needed
        if (window.GrappeAssignmentUI) {
            // Backward compat for current UI sync until full swap
        }

        return true;
    }

    /**
     * saveProject - Final save to repository.
     */
    async saveProject() {
        return await this.projectService.save();
    }
}

export default GrappeAssignmentService;
