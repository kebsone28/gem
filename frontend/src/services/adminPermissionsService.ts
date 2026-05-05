import apiClient from '../api/client';

export const adminPermissionsService = {
  async getRolePermissions() {
    const resp = await apiClient.get('/admin/role-permissions');
    return resp.data;
  },

  async updateRolePermissions(role: string, permissions: string[]) {
    const resp = await apiClient.post(`/admin/role-permissions/${encodeURIComponent(role)}`, {
      permissions,
    });
    return resp.data;
  },
  async exportRolePermissions() {
    const resp = await apiClient.get('/admin/role-permissions/export');
    return resp.data;
  },

  async importRolePermissions(payload: { roles: Array<{ role: string; permissions: string[] }> }) {
    const resp = await apiClient.post('/admin/role-permissions/import', payload);
    return resp.data;
  },
};

export default adminPermissionsService;
