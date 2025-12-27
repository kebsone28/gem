/**
 * import_normalizer.js
 * Heuristiques pour normaliser les colonnes d'un fichier d'import
 * - détecte/vérifie `region`, `department`, `commune`, `village`
 * - infère depuis un champ `adresse` si possible
 * - détecte coordonnées GPS et les parse proprement
 * Expose `ImportNormalizer.normalizeLocation(props, finder)`
 */
(function () {
    const COMMON_REGION_KEYS = ['region', 'region_name', 'région', 'province', 'prefecture'];
    const COMMON_DEPT_KEYS = ['departement', 'dept', 'dep', 'département', 'department', 'district'];
    const COMMON_COMMUNE_KEYS = ['commune', 'com', 'municipality', 'commune_name'];
    const COMMON_VILLAGE_KEYS = ['village', 'quartier', 'localite', 'site', 'neighbourhood', 'address'];

    function parseCoordinate(value) {
        if (value === null || value === undefined) return null;
        if (typeof value === 'number') return value;
        const s = String(value).trim().replace(/\s+/g, '');
        if (s === '') return null;
        // Replace comma decimal
        const normalized = s.replace(',', '.').replace(/[^\n0-9.\-+eE]/g, '');
        const v = parseFloat(normalized);
        return Number.isFinite(v) ? v : null;
    }

    // Default finder: direct property access
    function defaultFinder(obj, patterns) {
        if (!obj) return null;
        for (const p of patterns) {
            // if p is regex, test keys
            if (p instanceof RegExp) {
                for (const k of Object.keys(obj)) {
                    if (p.test(String(k).toLowerCase())) return obj[k];
                }
            } else {
                // direct key match (case-insensitive, trim)
                const key = Object.keys(obj).find(k => String(k).trim().toLowerCase() === String(p).trim().toLowerCase());
                if (key) return obj[key];
                // Also try substring match
                const sub = Object.keys(obj).find(k => String(k).toLowerCase().includes(String(p).toLowerCase()));
                if (sub) return obj[sub];
            }
        }
        return null;
    }

    function tryParseFromAddress(address) {
        if (!address || typeof address !== 'string') return {};
        // Split by comma and try to map last parts to commune/department/region
        const parts = address.split(',').map(p => p.trim()).filter(Boolean);
        const len = parts.length;
        const res = {};
        if (len >= 1) res.village = parts[0];
        if (len >= 2) res.commune = parts[Math.max(0, len - 2)];
        if (len >= 3) res.department = parts[Math.max(0, len - 3)];
        if (len >= 4) res.region = parts[Math.max(0, len - 4)];
        return res;
    }

    function normalizeLocation(props = {}, finder = null) {
        const find = finder || ((row, patterns) => defaultFinder(row, patterns));
        const warnings = [];

        // 1. Try explicit fields
        const regionRaw = find(props, COMMON_REGION_KEYS) || find(props, ['region', 'reg', /^region/]);
        const deptRaw = find(props, COMMON_DEPT_KEYS) || find(props, ['departement', 'dept', /^dep/]);
        const communeRaw = find(props, COMMON_COMMUNE_KEYS) || find(props, ['commune', 'com', /^commune/]);
        const villageRaw = find(props, COMMON_VILLAGE_KEYS) || find(props, ['village', 'quartier', 'adresse', 'address']);

        // 2. Coordinates: try multiple common keys
        const latRaw = find(props, [/^(latitude|lat|gps_lat|y)$/i]) || find(props, ['latitude', 'lat']);
        const lonRaw = find(props, [/^(longitude|lon|lng|gps_lon|x)$/i]) || find(props, ['longitude', 'lon', 'lng']);

        const lat = parseCoordinate(latRaw);
        const lon = parseCoordinate(lonRaw);

        let coordinates = null;
        if (lat !== null && lon !== null) {
            coordinates = { latitude: lat, longitude: lon };
        } else {
            // Try to parse coordinates from single field (eg: "12.34, -1.23")
            const singleCoord = find(props, ['coords', 'geolocation', 'gps', 'location', 'coordonnees', 'coord']);
            if (singleCoord && typeof singleCoord === 'string' && singleCoord.includes(',')) {
                const [a, b] = singleCoord.split(',').map(s => s.trim());
                const pa = parseCoordinate(a);
                const pb = parseCoordinate(b);
                if (pa !== null && pb !== null) {
                    // Heuristic: if first looks like lon/lat, try both orders
                    // If latitude looks between -90 and 90, accept as lat
                    if (Math.abs(pa) <= 90 && Math.abs(pb) <= 180) {
                        coordinates = { latitude: pa, longitude: pb };
                    } else if (Math.abs(pb) <= 90 && Math.abs(pa) <= 180) {
                        coordinates = { latitude: pb, longitude: pa };
                    }
                }
            }
        }

        // 3. If any of admin fields missing try to infer from an address-like field
        let region = regionRaw || null;
        let department = deptRaw || null;
        let commune = communeRaw || null;
        let village = villageRaw || null;

        if ((!region || !department || !commune) && !villageRaw) {
            const addressField = find(props, ['address', 'adresse', 'adresse_complete', 'adresse_complete_']);
            if (addressField) {
                const inferred = tryParseFromAddress(String(addressField));
                region = region || inferred.region;
                department = department || inferred.department;
                commune = commune || inferred.commune;
                village = village || inferred.village;
                if (Object.keys(inferred).length > 0) warnings.push('Inferred location from address field');
            }
        }

        // Normalize empty strings
        const clean = (v) => (v === undefined || v === null || String(v).trim() === '') ? null : String(v).trim();
        region = clean(region);
        department = clean(department);
        commune = clean(commune);
        village = clean(village);

        // If still missing, set explicit fallback but add warning
        if (!region) { region = 'Non Renseigné'; warnings.push('region missing'); }
        if (!department) { department = 'Non Renseigné'; warnings.push('department missing'); }
        if (!commune) { commune = 'Non Renseigné'; warnings.push('commune missing'); }
        if (!village) { village = ''; }

        return {
            region,
            department,
            commune,
            village,
            coordinates,
            warnings
        };
    }

    const ImportNormalizer = { normalizeLocation, parseCoordinate };

    if (typeof window !== 'undefined') window.ImportNormalizer = ImportNormalizer;
    if (typeof module !== 'undefined' && module.exports) module.exports = ImportNormalizer;

})();
