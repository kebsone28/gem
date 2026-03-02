/**
 * AuthGuard.js — Frontend Role-Based Access Control
 * Checks user authentication and permissions before allowing page access.
 * Handles centralized login redirection and dynamic UI filtering.
 */
(function () {
    'use strict';

    // Configuration des accès
    const PUBLIC_PAGES = ['login.html'];

    const ROLE_PERMISSIONS = {
        'admin': ['*'],
        'logistique': [
            'index.html',
            'logistique.html',
            'terrain.html',
            'charges.html',
            'rapports.html',
            'bordereau.html',
            'cahier-equipes.html',
            'simulation.html',
            'aide.html'
        ],
        'terrain': [
            'index.html',
            'terrain.html',
            'aide.html'
        ],
        'public': [
            'index.html',
            'aide.html'
        ]
    };

    // Pages autorisant l'accès anonyme restreint (Aide par ex)
    const ANONYMOUS_PAGES = ['aide.html'];

    class AuthGuard {
        constructor() {
            // Délay de 500ms pour laisser ApiService et le localStorage se charger
            setTimeout(() => this.init(), 500);
        }

        init() {
            // Check immediately for early redirection
            const filename = this.getCurrentFilename();

            // Allow public pages (like login.html)
            if (PUBLIC_PAGES.includes(filename)) return;

            // Check if user is logged in
            const user = this.getCurrentUser();

            if (!user && !ANONYMOUS_PAGES.includes(filename)) {
                console.warn('[AuthGuard] Non authentifié. Redirection vers login...');
                this.redirectToLogin();
                return;
            }

            if (user && !this.hasPermission(user.role, filename)) {
                console.error(`[AuthGuard] Accès refusé pour le rôle ${user.role} sur ${filename}`);
                this.showAccessDenied();
                return;
            }

            // Page is allowed, render UI when DOM is ready
            document.addEventListener('DOMContentLoaded', () => {
                this.renderUserMenu();
                this.applyMenuFilter();
            });
        }

        getCurrentFilename() {
            const path = window.location.pathname;
            const filename = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
            return filename;
        }

        getCurrentUser() {
            try {
                const userJson = localStorage.getItem('auth_user');
                if (userJson) return JSON.parse(userJson);

                // Fallback: try to decode JWT token to obtain user info
                const token = localStorage.getItem('auth_token');
                if (token) {
                    try {
                        const parts = token.split('.');
                        if (parts.length === 3) {
                            const payload = JSON.parse(atob(parts[1]));
                            return {
                                id: payload.id,
                                email: payload.email || null,
                                name: payload.name || null,
                                role: payload.role ? String(payload.role).toLowerCase() : null
                            };
                        }
                    } catch (e) {
                        // ignore decoding errors
                    }
                }

                return null;
            } catch (e) {
                return null;
            }
        }

        hasPermission(role, filename) {
            if (!role) return false;
            // normalize role to lowercase for lookup
            const allowed = ROLE_PERMISSIONS[role.toLowerCase()] || [];
            if (allowed.includes('*')) return true;
            return allowed.includes(filename);
        }

        redirectToLogin() {
            const current = this.getCurrentFilename();
            window.location.href = `login.html?redirect=${encodeURIComponent(current)}`;
        }

        showAccessDenied() {
            if (window.Swal) {
                Swal.fire({
                    icon: 'error',
                    title: 'Accès refusé',
                    text: 'Votre profil ne permet pas d\'accéder à cette section.',
                    confirmButtonText: 'Retour'
                }).then(() => {
                    window.location.href = 'index.html';
                });
            } else {
                alert('Accès refusé.');
                window.location.href = 'index.html';
            }
        }

        /**
         * Dynamic Navbar Filtering
         * Hides menu links that the user doesn't have permission for
         */
        applyMenuFilter() {
            const user = this.getCurrentUser();
            const role = user?.role || 'public';

            const navLinks = document.querySelectorAll('nav a, header a, .nav-link, #authStatusHeader a');
            navLinks.forEach(link => {
                const href = link.getAttribute('href');
                if (!href || href === '#' || href.startsWith('javascript:')) return;

                const targetFile = href.split('/').pop().split('?')[0] || 'index.html';

                if (!this.hasPermission(role, targetFile)) {
                    link.style.display = 'none';
                    // Optional: hide parent containers like <li>
                    const parent = link.closest('li, .menu-item');
                    if (parent) parent.style.display = 'none';
                } else {
                    link.style.display = '';
                }
            });

            this.renderUserMenu();
        }

        renderUserMenu() {
            const user = this.getCurrentUser();
            const nav = document.querySelector('nav .flex.items-center.space-x-4') ||
                document.querySelector('header .flex.items-center.space-x-3') ||
                document.getElementById('authStatusHeader');

            if (!nav) return;

            const existing = document.getElementById('userNavbarMenu');
            if (existing) existing.remove();

            const menu = document.createElement('div');
            menu.id = 'userNavbarMenu';
            menu.className = 'flex items-center gap-3 border-l pl-4 ml-4 border-gray-200';

            if (user) {
                menu.innerHTML = `
                    <div class="flex flex-col items-end mr-2">
                        <span class="text-xs font-bold text-gray-700 dark:text-gray-200">${user.username}</span>
                        <span class="text-[10px] text-gray-400 uppercase tracking-wider">${user.role}</span>
                    </div>
                    <button onclick="window.authGuard.logout()" class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center" title="Déconnexion">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>
                `;
            } else {
                menu.innerHTML = `
                    <a href="login.html" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md transition-all active:scale-95">
                        <i class="fas fa-lock mr-2"></i> Connexion
                    </a>
                `;
            }
            nav.appendChild(menu);

            // Clean up old login buttons if they exist outside this menu
            const oldLogin = document.getElementById('loginServerBtn');
            if (oldLogin) oldLogin.style.display = 'none';
        }

        logout() {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
            window.location.href = 'login.html?logout=true';
        }
    }

    window.authGuard = new AuthGuard();
})();
