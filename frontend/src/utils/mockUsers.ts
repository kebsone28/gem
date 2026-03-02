import type { UserRole } from './types';

/**
 * ⚠️ DEMO ONLY — These accounts are stored client-side for demonstration.
 * In production, authentication MUST be handled server-side with bcrypt-hashed passwords.
 * Move this to the backend before deploying to production.
 */
export interface MockUser {
    username: string;
    password: string;
    role: UserRole;
    name: string;
    teamId?: string;
    requires2FA?: boolean;
    secret2FAQuestion?: string;
    secret2FAAnswer?: string; // stored lowercase for comparison
}

export const MOCK_USERS: MockUser[] = [
    {
        username: 'maçongem',
        password: 'GEMMA2026',
        role: 'CHEF_EQUIPE',
        name: 'Chef Maçons',
        teamId: 'team_macons',
    },
    {
        username: 'maçongem'.normalize('NFD').replace(/[\u0300-\u036f]/g, ''), // 'macongem' alias
        password: 'GEMMA2026',
        role: 'CHEF_EQUIPE',
        name: 'Chef Maçons',
        teamId: 'team_macons',
    },
    {
        username: 'reseaugem',
        password: 'GEMRE2026',
        role: 'CHEF_EQUIPE',
        name: 'Chef Réseau',
        teamId: 'team_reseau',
    },
    {
        username: 'electriciengem',
        password: 'GEMELEC2026',
        role: 'CHEF_EQUIPE',
        name: 'Chef Électricien',
        teamId: 'team_interieur',
    },
    {
        username: 'livreurgem',
        password: 'gemliv2026',
        role: 'CHEF_EQUIPE',
        name: 'Chef Livreur',
        teamId: 'team_livraison',
    },
    {
        username: 'dggem',
        password: 'GEMDG2026',
        role: 'DG_PROQUELEC',
        name: 'DG PROQUELEC',
    },
    {
        username: 'gemlse',
        password: 'LSEGEM2026',
        role: 'CLIENT_LSE',
        name: 'Client LSE',
    },
    {
        username: 'admingem',
        password: '1995@PROQUELEC@2026',
        role: 'ADMIN_PROQUELEC',
        name: 'Administrateur PROQUELEC',
        requires2FA: true,
        secret2FAQuestion: 'Quel est ton secret ?',
        secret2FAAnswer: 'coran', // comparison done lowercase
    },
];

/**
 * Authenticate a user by username + password.
 * Returns the matched user or null.
 */
export function authenticateMock(username: string, password: string): MockUser | null {
    const normalized = username.trim().toLowerCase();
    const user = MOCK_USERS.find(
        u => u.username.toLowerCase() === normalized && u.password === password
    );
    return user ?? null;
}

/**
 * Verify the 2FA answer for admin (case-insensitive).
 */
export function verify2FA(user: MockUser, answer: string): boolean {
    if (!user.requires2FA) return true;
    return user.secret2FAAnswer?.toLowerCase() === answer.trim().toLowerCase();
}
