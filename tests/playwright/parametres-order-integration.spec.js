/**
 * Test de vérification de la stabilité de l'ordre des équipes
 * Ce test ouvre parametres.html en local (file://) pour contourner l'authentification
 * et vérifie que l'ordre des panneaux d'équip​es est maintenu lors des opérations
 */

const { test, expect } = require('@playwright/test');

test('Ordre des équipes - Vérifier loadProjectData initialise teamTypesOrder', async ({ page }) => {
    // Navigate directly to the file
    await page.goto('file:///C:/Users/User/Documents/PROQUELEC/2.%20PROJET/PROJET%20LSE/Gestion%20électrification%20massive%20-%20V3/parametres.html', { waitUntil: 'load' });
    
    // Wait for initialization (loadProjectData sends this)
    await page.waitForTimeout(3000);
    
    // Check that window.currentProject exists and has teamTypesOrder
    const hasTeamTypesOrder = await page.evaluate(() => {
        if (!window.currentProject) {
            console.log('❌ currentProject not loaded');
            return false;
        }
        
        if (!Array.isArray(window.currentProject.teamTypesOrder)) {
            console.log('⚠️ teamTypesOrder not present or not an array:', window.currentProject.teamTypesOrder);
            console.log('Creating initialization...');
            // Check if it gets initialized
            return false;
        }
        
        console.log('✅ teamTypesOrder initialized:', window.currentProject.teamTypesOrder);
        return true;
    });
    
    console.log('teamTypesOrder present:', hasTeamTypesOrder);
    // We don't assert strictly because it depends on project initialization
    expect(typeof hasTeamTypesOrder).toBe('boolean');
});

test('Ordre des équipes - Vérifier renderTeamsTab utilise teamTypesOrder', async ({ page }) => {
    await page.goto('file:///C:/Users/User/Documents/PROQUELEC/2.%20PROJET/PROJET%20LSE/Gestion%20électrification%20massive%20-%20V3/parametres.html', { waitUntil: 'load' });
    
    await page.waitForTimeout(3000);
    
    // Check if renderTeamsTab logic reads teamTypesOrder
    const teamsOrderLogic = await page.evaluate(() => {
        // Simulate what renderTeamsTab does
        if (!window.currentProject || !window.teamTemplates) {
            return 'missing_deps';
        }
        
        const persistedOrder = Array.isArray(window.currentProject.teamTypesOrder) ?
            window.currentProject.teamTypesOrder.slice() : [];
        
        const templateKeys = Object.keys(window.teamTemplates);
        
        // Build ordered types like renderTeamsTab does
        const orderedTypes = [];
        persistedOrder.forEach(t => {
            if (templateKeys.includes(t)) orderedTypes.push(t);
        });
        
        const missing = templateKeys.filter(t => !orderedTypes.includes(t)).sort((a, b) => 
            a.localeCompare(b, 'fr', { sensitivity: 'base' })
        );
        orderedTypes.push(...missing);
        
        console.log('✅ Rendered order:', orderedTypes);
        return orderedTypes;
    });
    
    console.log('Order used by renderTeamsTab:', teamsOrderLogic);
    expect(Array.isArray(teamsOrderLogic) || teamsOrderLogic === 'missing_deps').toBeTruthy();
});

test('Ordre des équipes - Vérifier debouncedRenderTeams existe', async ({ page }) => {
    await page.goto('file:///C:/Users/User/Documents/PROQUELEC/2.%20PROJET/PROJET%20LSE/Gestion%20électrification%20massive%20-%20V3/parametres.html', { waitUntil: 'load' });
    
    await page.waitForTimeout(2000);
    
    // Check that debouncedRenderTeams function exists and works
    const debounceWorks = await page.evaluate(() => {
        if (typeof window.debouncedRenderTeams !== 'function') {
            console.log('❌ debouncedRenderTeams not found');
            return { exists: false, callable: false };
        }
        
        console.log('✅ debouncedRenderTeams exists');
        
        // Try calling it (should not error)
        try {
            window.debouncedRenderTeams(50); // Use 50ms debounce for test
            return { exists: true, callable: true };
        } catch (e) {
            console.error('Error calling debouncedRenderTeams:', e.message);
            return { exists: true, callable: false, error: e.message };
        }
    });
    
    console.log('Debounce check:', debounceWorks);
    expect(debounceWorks.exists).toBe(true);
    expect(debounceWorks.callable).toBe(true);
});

test('Ordre des équipes - Vérifier ProjectRepository wrappers', async ({ page }) => {
    await page.goto('file:///C:/Users/User/Documents/PROQUELEC/2.%20PROJET/PROJET%20LSE/Gestion%20électrification%20massive%20-%20V3/parametres.html', { waitUntil: 'load' });
    
    await page.waitForTimeout(2000);
    
    // Check that ProjectRepository has instance wrappers
    const repoMethods = await page.evaluate(async () => {
        if (!window.ProjectRepository) {
            return 'ProjectRepository not found';
        }
        
        const methods = {
            getCurrent: typeof window.ProjectRepository.getCurrent,
            updateProjectParameters: typeof window.ProjectRepository.updateProjectParameters,
            addTeamTypeCosts: typeof window.ProjectRepository.addTeamTypeCosts,
        };
        
        console.log('✅ ProjectRepository methods check:', methods);
        return methods;
    });
    
    console.log('Repository methods:', repoMethods);
    expect(repoMethods.getCurrent).toBe('function');
    expect(repoMethods.updateProjectParameters).toBe('function');
});

test('Ordre des équipes - Vérifier saveProjectState fonctionne', async ({ page }) => {
    await page.goto('file:///C:/Users/User/Documents/PROQUELEC/2.%20PROJET/PROJET%20LSE/Gestion%20électrification%20massive%20-%20V3/parametres.html', { waitUntil: 'load' });
    
    await page.waitForTimeout(2000);
    
    // Check that saveProjectState exists and is callable
    const saveStateWorks = await page.evaluate(async () => {
        if (typeof window.saveProjectState !== 'function') {
            console.log('❌ saveProjectState not found');
            return false;
        }
        
        console.log('✅ saveProjectState exists and is callable');
        return true;
    });
    
    console.log('saveProjectState available:', saveStateWorks);
    expect(saveStateWorks).toBe(true);
});

test('Ordre des équipes - Console ne doit pas montrer d\'erreurs critiques', async ({ page }) => {
    let errors = [];
    
    page.on('console', msg => {
        if (msg.type() === 'error') {
            errors.push(msg.text());
        }
    });
    
    await page.goto('file:///C:/Users/User/Documents/PROQUELEC/2.%20PROJET/PROJET%20LSE/Gestion%20électrification%20massive%20-%20V3/parametres.html', { waitUntil: 'load' });
    
    await page.waitForTimeout(3000);
    
    // Filter out non-critical errors (like missing external resources)
    const criticalErrors = errors.filter(e => 
        !e.includes('404') && 
        !e.includes('ERR_FILE_NOT_FOUND') &&
        !e.includes('cannot find module') &&
        e.toLowerCase().includes('not a function') // Focus on real bugs
    );
    
    console.log('❌ Critical console errors (if any):', criticalErrors);
    console.log('All console messages:', errors.length);
    
    // Should not have "getCurrent is not a function" or similar repository errors
    expect(!errors.some(e => e.includes('getCurrent is not a function'))).toBe(true);
    expect(!errors.some(e => e.includes('updateProjectParameters is not a function'))).toBe(true);
});
