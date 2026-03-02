/**
 * API Service Layer - Frontend
 * Gère toutes les requêtes HTTP vers le backend Express
 */

const API_URL = process.env.API_URL || window.location.origin;

class APIClient {
  constructor() {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  /**
   * Fonction générique d'appel API
   */
  async request(method, endpoint, data = null) {
    const url = `${API_URL}${endpoint}`;

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    // Ajouter token JWT si présent
    if (this.accessToken) {
      options.headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);

      // Token expiré → essayer refresh
      if (response.status === 401) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry la requête avec nouveau token
          return this.request(method, endpoint, data);
        } else {
          // Refresh échoué → rediriger login
          this.logout();
          throw new Error('Session expirée');
        }
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error [${method} ${endpoint}]:`, error.message);
      throw error;
    }
  }

  // ============ AUTHENTICATION ============

  async login(email, password) {
    const data = await this.request('POST', '/api/auth/login', { email, password });
    
    // Stocker les tokens
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));

    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;

    return data;
  }

  async logout() {
    // Révoquer le token côté serveur
    if (this.refreshToken) {
      try {
        await this.request('POST', '/api/auth/logout', {
          refreshToken: this.refreshToken
        });
      } catch (error) {
        // Continuer même si erreur
      }
    }

    // Nettoyer le local storage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');

    this.accessToken = null;
    this.refreshToken = null;

    // Rediriger vers login
    window.location.href = '/login.html';
  }

  async refreshAccessToken() {
    try {
      const data = await this.request('POST', '/api/auth/refresh', {
        refreshToken: this.refreshToken
      });

      localStorage.setItem('accessToken', data.accessToken);
      this.accessToken = data.accessToken;
      return true;
    } catch (error) {
      console.error('Refresh token failed:', error);
      return false;
    }
  }

  async getCurrentUser() {
    return this.request('GET', '/api/auth/me');
  }

  // ============ KPI ============

  async getProjectKPI(projectId) {
    return this.request('GET', `/api/kpi/project/${projectId}`);
  }

  async createKPISnapshot(projectId) {
    return this.request('POST', `/api/kpi/project/${projectId}/snapshot`, {});
  }

  async getKPIHistory(projectId) {
    return this.request('GET', `/api/kpi/project/${projectId}/history`);
  }

  async getKPISummary() {
    return this.request('GET', '/api/kpi/summary');
  }

  // ============ PROJECTS ============

  async getProjects() {
    return this.request('GET', '/api/projects');
  }

  async getProject(projectId) {
    return this.request('GET', `/api/projects/${projectId}`);
  }

  async createProject(projectData) {
    return this.request('POST', '/api/projects', projectData);
  }

  async updateProject(projectId, projectData) {
    return this.request('PATCH', `/api/projects/${projectId}`, projectData);
  }

  // ============ TEAMS ============

  async getTeams(projectId = null) {
    const url = projectId ? `/api/teams?projectId=${projectId}` : '/api/teams';
    return this.request('GET', url);
  }

  async createTeam(teamData) {
    return this.request('POST', '/api/teams', teamData);
  }

  // ============ HOUSEHOLDS ============

  async getHouseholds(projectId = null, status = null) {
    let url = '/api/households';
    const params = new URLSearchParams();
    
    if (projectId) params.append('projectId', projectId);
    if (status) params.append('status', status);

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    return this.request('GET', url);
  }

  async createHousehold(householdData) {
    return this.request('POST', '/api/households', householdData);
  }

  async updateHousehold(householdId, householdData) {
    return this.request('PATCH', `/api/households/${householdId}`, householdData);
  }

  // ============ UTILS ============

  getStoredUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  isAuthenticated() {
    return !!this.accessToken;
  }

  getUserRole() {
    const user = this.getStoredUser();
    return user?.role || null;
  }

  hasRole(requiredRole) {
    const role = this.getUserRole();
    return role === requiredRole || role === 'ADMIN';
  }
}

// Export singleton
export const apiClient = new APIClient();

export default apiClient;
