
function normalizeValue(value, dictionary) {
    if (!value) return null;
    const v = String(value).toLowerCase().trim();
    return dictionary[v] || "UNKNOWN";
}

function computeGlobalStatus(data) {
    if (!data) return "NON_DEMARRE";
    if (data.interiorStatus === "COMPLETE" || data.installation === "COMPLETED") return "TERMINE";
    if (data.networkStatus === "COMPLETE" || data.networkStatus === "IN_PROGRESS" || data.problems?.some(p => p.domain === 'network')) return "BRANCHEMENT";
    if (data.wallType === "STANDARD" || data.wallType === "CHIMNEY") return "MUR";
    if (data.kit?.status === "COMPLETE") return "LIVRE";
    return "NON_DEMARRE";
}

// Mock mapping logic
function mockMap(kobo) {
    let result = { problems: [], meta: {} };
    
    if (kobo['etape_interieur/etat_installation_interieur'] || kobo['etat_installation_interieur']) {
        result.interiorStatus = normalizeValue(kobo['etape_interieur/etat_installation_interieur'] || kobo['etat_installation_interieur'], {
            "terminee": "COMPLETE", "non_terminee": "IN_PROGRESS", "probleme": "ERROR"
        });
    }
    if (kobo['etape_reseau/etat_branchement_reseau'] || kobo['etat_branchement_reseau']) {
        result.networkStatus = normalizeValue(kobo['etape_reseau/etat_branchement_reseau'] || kobo['etat_branchement_reseau'], {
            "termine": "COMPLETE", "en_cours": "IN_PROGRESS", "probleme": "ERROR"
        });
    }
    if (kobo['username']) result.installerTeam = kobo['username'];
    
    return result;
}

// TEST CASES
const mockKobo = {
    "etape_interieur/etat_installation_interieur": "terminee",
    "username": "equipe_saliou"
};

console.log("--- TEST 1: TEAM & STATUS MAPPING ---");
const mapped = mockMap(mockKobo);
console.log(JSON.stringify(mapped, null, 2));

console.log("\n--- TEST 2: GLOBAL STATUS DERIVATION ---");
const status = computeGlobalStatus(mapped);
console.log("Global Status:", status);
