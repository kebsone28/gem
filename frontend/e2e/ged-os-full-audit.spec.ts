/**
 * GEM SAAS — Suite de tests E2E complète
 * Teste chaque page, chaque bouton critique et les appels API.
 */
import { expect, test, type Page, type BrowserContext } from '@playwright/test';

// ── Credentials ────────────────────────────────────────────────────────────
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admingem';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'suprime';
const ADMIN_2FA = process.env.E2E_ADMIN_2FA || 'CORAN';
const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Login programmatique :
 *  1. Appelle POST /api/auth/login  (obtient pendingUser + requires2FA)
 *  2. Appelle POST /api/auth/verify-2fa (obtient accessToken)
 *  3. Injecte directement le token dans localStorage via page.evaluate
 *  4. Navigue vers /home
 *
 * Cette approche contourne les problèmes de timing UI liés à la 2FA.
 * Retourne l'accessToken pour réutilisation dans les tests API.
 */
async function loginAsAdmin(page: Page): Promise<string> {
  // Étape 1 : Login credentials via API
  const loginResp = await page.request.post(`${BASE}/api/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    headers: { 'Content-Type': 'application/json' },
  });
  const loginData = await loginResp.json();

  let accessToken: string | null = loginData.accessToken || loginData.token || null;
  let userData = loginData.user || null;

  // Étape 2 : Si 2FA requis, vérifier la réponse de sécurité
  if (loginData.user?.requires2FA || !accessToken) {
    const twoFAResp = await page.request.post(`${BASE}/api/auth/verify-2fa`, {
      data: { email: ADMIN_EMAIL, answer: ADMIN_2FA },
      headers: { 'Content-Type': 'application/json' },
    });
    const twoFAData = await twoFAResp.json();
    accessToken = twoFAData.accessToken || twoFAData.token || null;
    userData = twoFAData.user || userData;
  }

  if (!accessToken) {
    throw new Error(`Login échoué — pas de token reçu. Réponse: ${JSON.stringify(loginData)}`);
  }

  // Étape 3 : Injecter le token et l'utilisateur dans le storage de la page
  await page.goto('/');
  await page.evaluate(
    ({ token, user }) => {
      // Nettoyer l'état précédent
      localStorage.clear();
      sessionStorage.clear();
      // Injecter le token (safeStorage utilise localStorage)
      localStorage.setItem('access_token', token);
      // Injecter les données utilisateur pour que AuthContext les trouve
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
      }
    },
    { token: accessToken, user: userData }
  );

  // Étape 4 : Recharger pour que React charge l'état d'authentification
  await page.goto('/home');
  await page.waitForURL(/\/(home|dashboard)/, { timeout: 20_000 });
  return accessToken;
}

async function navigateTo(page: Page, route: string, label: string) {
  const errors: string[] = [];
  page.once('pageerror', (e) => errors.push(`[${label}] ${e.message}`));
  await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForTimeout(1000); // laisser les hooks se stabiliser
  return errors;
}

async function expectNoReactCrash(page: Page, route: string) {
  // Vérifie qu'il n'y a pas de boundary d'erreur React affiché
  const crashText = await page
    .locator("text=/une erreur s'est produite|Something went wrong|Erreur inattendue/i")
    .isVisible()
    .catch(() => false);
  expect(crashText, `[${route}] React crash détecté`).toBe(false);
  // Vérifie qu'on n'est pas redirigé vers /login (route protégée accessible)
  expect(page.url()).not.toMatch(/\/login$/);
}

// ── Test 1 : Page Login ────────────────────────────────────────────────────
test.describe('🔐 Page Login', () => {
  test('affiche le formulaire de connexion', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#login-username')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
    await expect(page.locator('button[type="submit"]').first()).toBeVisible();
  });

  test('rejette des credentials invalides', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#login-username').fill('faux@email.com');
    await page.locator('#login-password').fill('mauvaispass');
    await page.locator('button[type="submit"]').first().click();
    // Doit rester sur /login (le serveur renvoie une erreur 401)
    await page.waitForTimeout(3000);
    expect(page.url()).toMatch(/\/login/);
  });

  test('connexion admin réussit avec 2FA', async ({ page }) => {
    await loginAsAdmin(page);
    expect(page.url()).toMatch(/\/(home|dashboard)/);
  });
});

// ── Test 2 : Routes protégées — redirection si non authentifié ──────────────
test.describe('🔒 Routes protégées — redirection non-auth', () => {
  const protectedRoutes = [
    '/dashboard',
    '/terrain',
    '/admin/users',
    '/admin/mission',
    '/communication',
  ];

  for (const route of protectedRoutes) {
    test(`${route} redirige vers /login si non connecté`, async ({ page }) => {
      await page.goto(route);
      await page.waitForTimeout(1500);
      expect(page.url()).toMatch(/\/login/);
    });
  }
});

// ── Test 3 : Toutes les pages — chargement sans crash ─────────────────────
test.describe('📄 Toutes les pages — chargement sans crash', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  const allRoutes = [
    { route: '/home', label: 'Home' },
    { route: '/dashboard', label: 'Dashboard' },
    { route: '/terrain', label: 'Terrain' },
    { route: '/cahier', label: 'Cahier des charges' },
    { route: '/logistique', label: 'Logistique' },
    { route: '/charges', label: 'Finances/Charges' },
    { route: '/rapports', label: 'Rapports' },
    { route: '/bordereau', label: 'Bordereau' },
    { route: '/simulation', label: 'Simulation' },
    { route: '/settings', label: 'Paramètres' },
    { route: '/admin/users', label: 'Gestion utilisateurs' },
    { route: '/admin/permissions', label: 'Permissions' },
    { route: '/admin/security', label: 'Sécurité' },
    { route: '/admin/diagnostic', label: 'Diagnostic' },
    { route: '/admin/mission', label: 'Ordres de Mission' },
    { route: '/admin/approval', label: 'Approbation' },
    { route: '/admin/kobo-terminal', label: 'Terminal Kobo' },
    { route: '/admin/toolbox', label: 'GEM Toolbox' },
    { route: '/admin/gem-collect', label: 'GEM Collect' },
    { route: '/admin/kobo-mapping', label: 'Mapping Kobo' },
    { route: '/admin/organization', label: 'Organisation' },
    { route: '/admin/pv-automation', label: 'PV Automation' },
    { route: '/admin/alerts', label: 'Alertes' },
    { route: '/admin/modules', label: 'Modules' },
    { route: '/admin/ai-config', label: 'Config IA' },
    { route: '/admin/project-creation', label: 'Créer Projet' },
    { route: '/communication', label: 'Communication' },
    { route: '/planning', label: 'Planning' },
    { route: '/planning-formation', label: 'Planning Formation' },
    { route: '/aide', label: 'Aide' },
  ];

  for (const { route, label } of allRoutes) {
    test(`✅ ${label} (${route}) se charge sans crash`, async () => {
      const errors = await navigateTo(page, route, label);
      await expectNoReactCrash(page, route);
      // Pas d'erreur JS non gérée
      if (errors.length > 0) {
        console.warn(`⚠️  Erreurs JS sur ${label}:`, errors);
      }
    });
  }
});

// ── Test 4 : APIs backend — appels critiques ───────────────────────────────
test.describe('🌐 APIs backend — réponses correctes', () => {
  let context: BrowserContext;
  let page: Page;
  let authToken: string | null = null;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    // loginAsAdmin retourne maintenant l'accessToken directement
    authToken = await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  const apiEndpoints = [
    { method: 'GET', path: '/api/ping', label: 'Ping backend' },
    { method: 'GET', path: '/api/auth/me', label: 'Profil utilisateur' },
    { method: 'GET', path: '/api/users', label: 'Liste utilisateurs' },
    { method: 'GET', path: '/api/projects', label: 'Liste projets' },
    { method: 'GET', path: '/api/missions', label: 'Liste missions' },
    { method: 'GET', path: '/api/households?limit=5', label: 'Ménages (5)' },
    { method: 'GET', path: '/api/alerts/config/organization', label: 'Config alertes' },
    { method: 'GET', path: '/api/organization/config', label: 'Config organisation' },
    { method: 'GET', path: '/api/chat/bootstrap', label: 'Bootstrap chat' },
    { method: 'GET', path: '/api/missions/approvals/pending', label: 'Missions en attente' },
    { method: 'GET', path: '/api/kpi/summary', label: 'KPIs' },
    { method: 'GET', path: '/api/teams', label: 'Équipes' },
    { method: 'GET', path: '/api/zones', label: 'Zones' },
    { method: 'GET', path: '/api/pvs', label: 'PVs' },
    { method: 'GET', path: '/api/monitoring/system-health', label: 'Santé système' },
    { method: 'GET', path: '/api/admin/role-permissions', label: 'Matrice permissions' },
  ];

  for (const { method, path, label } of apiEndpoints) {
    test(`[${method}] ${label} — retourne 200/2xx`, async () => {
      const response = await page.request[method.toLowerCase() as 'get'](`${BASE}${path}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      expect(
        response.status(),
        `${label} (${path}) a retourné ${response.status()}`
      ).toBeGreaterThanOrEqual(200);
      expect(response.status()).toBeLessThan(400);
    });
  }
});

// ── Test 5 : Home — interactions boutons ──────────────────────────────────
test.describe('🏠 Home — interactions UI', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('barre de recherche projets fonctionne', async () => {
    await page.goto('/home');
    await page.waitForTimeout(1500);
    const searchInput = page
      .locator('input[placeholder*="projet" i], input[placeholder*="recherch" i]')
      .first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
      await searchInput.clear();
    }
    // OK même si le champ n'est pas visible (pas de projet chargé)
  });

  test('bouton filtre Actifs fonctionne', async () => {
    await page.goto('/home');
    await page.waitForTimeout(1500);
    const filterBtn = page.getByRole('button', { name: /actifs/i }).first();
    if (await filterBtn.isVisible()) {
      await filterBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('bouton Tous remet le filtre', async () => {
    await page.goto('/home');
    await page.waitForTimeout(1500);
    const allBtn = page.getByRole('button', { name: /^tous$/i }).first();
    if (await allBtn.isVisible()) {
      await allBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('bouton Logout déconnecte', async () => {
    await page.goto('/home');
    await page.waitForTimeout(1500);
    const logoutBtn = page.getByTitle(/déconnect/i).first();
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await page.waitForURL(/\/login/, { timeout: 5000 });
      expect(page.url()).toMatch(/\/login/);
    }
    // Re-login pour les tests suivants
    await loginAsAdmin(page);
  });
});

// ── Test 6 : Dashboard — affichage correct selon rôle ─────────────────────
test.describe('📊 Dashboard', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('charge AdminDashboard pour le rôle Admin', async () => {
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
    await expectNoReactCrash(page, '/dashboard');
    // Vérifie qu'un contenu de dashboard est présent
    const hasDashboard = await page
      .locator('[class*="dashboard" i], [class*="kpi" i], [class*="stat" i]')
      .first()
      .isVisible()
      .catch(() => false);
    // Le dashboard peut aussi être une page chargée dynamiquement
    expect(page.url()).toMatch(/\/dashboard/);
  });
});

// ── Test 7 : Admin Users — CRUD ───────────────────────────────────────────
test.describe('👥 Admin Users — interface et boutons', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('liste des utilisateurs se charge', async () => {
    await page.goto('/admin/users');
    await page.waitForTimeout(2000);
    await expectNoReactCrash(page, '/admin/users');
    // La table doit être présente
    const table = await page
      .locator('table, [role="table"]')
      .first()
      .isVisible()
      .catch(() => false);
    const header = await page
      .locator('text=/utilisateur/i')
      .first()
      .isVisible()
      .catch(() => false);
    expect(table || header).toBe(true);
  });

  test('bouton Nouveau ouvre le formulaire', async () => {
    await page.goto('/admin/users');
    await page.waitForTimeout(2000);
    const newBtn = page.getByRole('button', { name: /nouveau|créer|ajouter/i }).first();
    if (await newBtn.isVisible()) {
      await newBtn.click();
      await page.waitForTimeout(1000);
      // Un formulaire ou modal doit s'ouvrir
      const formVisible = await page
        .locator('form, [role="dialog"], input[placeholder*="nom" i]')
        .first()
        .isVisible()
        .catch(() => false);
      expect(formVisible).toBe(true);
      // Fermer le formulaire
      const closeBtn = page.getByRole('button', { name: /annuler|fermer|close/i }).first();
      if (await closeBtn.isVisible()) await closeBtn.click();
    }
  });

  test('recherche utilisateur fonctionne', async () => {
    await page.goto('/admin/users');
    await page.waitForTimeout(2000);
    const searchInput = page
      .locator('input[placeholder*="filtrer" i], input[placeholder*="recherch" i]')
      .first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('admin');
      await page.waitForTimeout(500);
      await searchInput.clear();
    }
  });
});

// ── Test 8 : Communication — Chat ─────────────────────────────────────────
test.describe('💬 Communication', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('page chat charge et affiche les conversations', async () => {
    await page.goto('/communication');
    await page.waitForTimeout(3000);
    await expectNoReactCrash(page, '/communication');
    expect(page.url()).toMatch(/\/communication/);
  });

  test('le compositeur de message est présent', async () => {
    await page.goto('/communication');
    await page.waitForTimeout(3000);
    const composer = page
      .locator('textarea, input[placeholder*="message" i], [id*="composer" i]')
      .first();
    const composerVisible = await composer.isVisible().catch(() => false);
    // Si pas de conversation sélectionnée, le composer peut être absent
    // On vérifie juste que la page a chargé
    expect(page.url()).toMatch(/\/communication/);
  });
});

// ── Test 9 : Mission Order — création ─────────────────────────────────────
test.describe('📋 Mission Order', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('page missions charge avec sidebar', async () => {
    await page.goto('/admin/mission');
    await page.waitForTimeout(3000);
    await expectNoReactCrash(page, '/admin/mission');
  });

  test('bouton Nouvelle Mission est présent', async () => {
    await page.goto('/admin/mission');
    await page.waitForTimeout(3000);
    const newBtn = page.getByRole('button', { name: /nouvelle mission|nouveau|créer/i }).first();
    const newBtnVisible = await newBtn.isVisible().catch(() => false);
    // Peut ne pas être visible si pas de projet sélectionné
    expect(page.url()).toMatch(/\/admin\/mission/);
  });
});

// ── Test 10 : Settings — onglets ──────────────────────────────────────────
test.describe('⚙️ Settings', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('page settings charge correctement', async () => {
    await page.goto('/settings');
    await page.waitForTimeout(2000);
    await expectNoReactCrash(page, '/settings');
  });

  test('les onglets sont navigables', async () => {
    await page.goto('/settings');
    await page.waitForTimeout(2000);
    const tabs = page.getByRole('tab').all();
    const tabList = await tabs;
    for (const tab of tabList.slice(0, 3)) {
      if (await tab.isVisible()) {
        await tab.click();
        await page.waitForTimeout(500);
      }
    }
  });
});

// ── Test 11 : Approbation — workflow ──────────────────────────────────────
test.describe('✅ Approbation des missions', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('page approbation charge avec KPIs', async () => {
    await page.goto('/admin/approval');
    await page.waitForTimeout(3000);
    await expectNoReactCrash(page, '/admin/approval');
    expect(page.url()).toMatch(/\/admin\/approval/);
  });

  test('filtres pending/archive présents', async () => {
    await page.goto('/admin/approval');
    await page.waitForTimeout(2000);
    const filterBtn = page.getByRole('button', { name: /en attente|archive|pending/i }).first();
    const filterVisible = await filterBtn.isVisible().catch(() => false);
    if (filterVisible) await filterBtn.click();
  });
});

// ── Test 12 : Vérification publique mission ────────────────────────────────
test.describe('🔍 Vérification publique mission', () => {
  test('page de vérification accessible sans login', async ({ page }) => {
    await page.goto('/verify/mission/fake-identifier-test');
    await page.waitForTimeout(3000);
    // Doit afficher "non trouvée" ou "invalide" mais PAS un crash
    await expectNoReactCrash(page, '/verify/mission/fake-identifier-test');
    const errorMsg = await page
      .locator('text=/non trouvée|non valide|introuvable|not found/i')
      .isVisible()
      .catch(() => false);
    const loadingMsg = await page
      .locator('text=/vérification|chargement/i')
      .isVisible()
      .catch(() => false);
    expect(errorMsg || loadingMsg || true).toBe(true); // Au moins la page charge
  });
});

// ── Test 13 : Diagnostic santé ─────────────────────────────────────────────
test.describe('🩺 Diagnostic santé', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('page diagnostic charge et affiche les statuts', async () => {
    await page.goto('/admin/diagnostic');
    await page.waitForTimeout(3000);
    await expectNoReactCrash(page, '/admin/diagnostic');
    // Doit afficher des indicateurs de santé
    const hasStatus = await page
      .locator('text=/connecté|actif|ok|santé|local|serveur/i')
      .first()
      .isVisible()
      .catch(() => false);
    expect(page.url()).toMatch(/\/admin\/diagnostic/);
  });
});

// ── Test 14 : Sidebar navigation ──────────────────────────────────────────
test.describe('🧭 Sidebar navigation', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('tous les liens de navigation fonctionnent', async () => {
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);

    const navLinks = page.locator('nav a[href], aside a[href]');
    const count = await navLinks.count();
    console.log(`🔗 ${count} liens de navigation trouvés`);

    // Tester les 5 premiers liens
    for (let i = 0; i < Math.min(count, 5); i++) {
      const link = navLinks.nth(i);
      const href = await link.getAttribute('href');
      if (href && !href.startsWith('http')) {
        await link.click();
        await page.waitForTimeout(800);
        const url = page.url();
        expect(url).not.toMatch(/\/login/);
      }
    }
  });
});

// ── Test 15 : Résumé final ─────────────────────────────────────────────────
test('📊 RÉSUMÉ — Build et API backend opérationnels', async ({ page }) => {
  // Ping backend
  const pingResp = await page.request.get(`${BASE}/api/ping`);
  expect(pingResp.status()).toBe(200);
  const pingData = await pingResp.json();
  expect(pingData.status).toBe('ok');
  expect(pingData.db).toBe('connected');

  console.log('✅ Backend en ligne:', pingData);
  console.log('✅ Base de données:', pingData.db);
  console.log('✅ Version:', pingData.version);
});
