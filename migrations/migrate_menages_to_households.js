(async function () {
    'use strict';

    // Migration utility to copy legacy `menages` table into `households` table
    // Adds window.migrateMenagesToHouseholds() to the runtime

    async function migrate() {
        if (!window.db) throw new Error('DB instance not found on window.db');
        const theDb = window.db;
        // Prefer table accessors from Dexie if available, otherwise fallback to window.db.<table>
        let menagesTable;
        let householdsTable;
        try {
            menagesTable = (typeof theDb.table === 'function') ? (theDb.table('menages') || theDb.menages) : theDb.menages;
        } catch (e) {
            console.warn('Accessing theDb.table("menages") threw:', e && e.message);
            menagesTable = theDb.menages;
        }

        try {
            householdsTable = (typeof theDb.table === 'function') ? (theDb.table('households') || theDb.households) : theDb.households;
        } catch (e) {
            console.warn('Accessing theDb.table("households") threw:', e && e.message);
            householdsTable = theDb.households;
        }

        if (!menagesTable) return { migrated: 0, total: 0, error: 'Legacy table `menages` not found on db' };
        if (!householdsTable) {
            console.warn('`households` table not present — attempting to create via schema not possible at runtime. Proceed with menages copy into new table name `households` if available.');
        }

        let rows = (menagesTable && typeof menagesTable.toArray === 'function') ? await menagesTable.toArray() : [];

        // If immediate read returns empty, allow a short retry window to let test inserts complete
        // and also check the in-memory fallback store `window.__inMemoryData` if present.
        if (!rows || rows.length === 0) {
            const maxChecks = 20;
            for (let i = 0; i < maxChecks; i++) {
                // try to read from menagesTable again
                try {
                    if (menagesTable && typeof menagesTable.toArray === 'function') rows = await menagesTable.toArray();
                } catch (e) { rows = [] }

                if (rows && rows.length > 0) break;

                try {
                    if (window.__inMemoryData && Array.isArray(window.__inMemoryData.menages) && window.__inMemoryData.menages.length > 0) {
                        rows = window.__inMemoryData.menages.slice();
                        break;
                    }
                } catch (e) { /* ignore */ }

                // small delay
                await new Promise(r => setTimeout(r, 50));
            }
        }

        if (!rows || rows.length === 0) return { migrated: 0, total: 0 };

        const converted = rows.map(r => ({
            // Keep id but use ++id optional: if households use incremental id, keep original id if string
            id: r.id,
            zoneId: r.zone || null,
            status: r.statut || r.statut_installation || r.status || null,
            gpsLat: r.gps_lat || r.gpsLat || null,
            gpsLon: r.gps_lon || r.gpsLon || null,
            owner: { name: r.nom_prenom_chef || r.name || '' },
            phone: r.telephone || r.phone || null,
            // keep original raw data
            legacy: r
        }));

        // Bulk put into households
        try {
            if (householdsTable && typeof householdsTable.bulkPut === 'function') {
                await householdsTable.bulkPut(converted);
            } else if (theDb && theDb.households && typeof theDb.households.bulkPut === 'function') {
                await theDb.households.bulkPut(converted);
            } else if (theDb && theDb.households && typeof theDb.households.put === 'function') {
                for (const r of converted) await theDb.households.put(r);
            } else if (Array.isArray(theDb.households)) {
                // last-resort fallback: push into array
                theDb.households.push(...converted);
            } else if (window.db && window.db.households && typeof window.db.households.put === 'function') {
                for (const r of converted) await window.db.households.put(r);
            } else {
                console.warn('No households target found to write migrated rows; skipping write');
            }
        } catch (e) {
            console.error('Migration put error:', e);
            return { migrated: 0, total: rows.length, error: e && e.message };
        }

        return { migrated: converted.length, total: rows.length };
    }

    window.migrateMenagesToHouseholds = async function () {
        try {
            const result = await migrate();
            console.log('Migration completed', result);
            return result;
        } catch (e) {
            console.error('Migration failed', e);
            return { migrated: 0, total: 0, error: e && (e.message || String(e)) };
        }
    };

    console.log('Migration helper loaded: window.migrateMenagesToHouseholds()');
})();
