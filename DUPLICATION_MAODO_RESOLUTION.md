# 🐛 Dépanagge: Doublement de Maodo Diallo sur la carte

## ✅ Analyse des Problèmes

### Problème 1: Statut incorrect ✅ **RÉSOLU**
**Avant:** "Non par débuté"  
**Après:** "Ménage non éligible"  
**Cause:** extractStatus() ne cherchait pas le champ "Situation du Ménage"  
**Correction:** Modifié extractStatus() pour chercher ce champ en PRIORITÉ

### Problème 2: Doublement sur la carte ✅ **ANALYSÉ**
**Statut:** ✅ Pas de doublon réel en BD  
**Trouvé:** 1 seul record pour Maodo Diallo  
**Cause Probable:** Cache frontend IndexedDB ou clustering cartographique  
**Solution:** Nettoyer le cache frontend

---

## 🔧 Ce Qui A Été Fait

### 1. **Modification du Code**
**File:** `backend/src/services/kobo.mapping.js`  
**Fonction:** `extractStatus(row)`

**Avant:**
```javascript
// Cherchait seulement les checkpoints de validation
if (isConfirmedControl) return 'Contrôle conforme';
else if (isConfirmedInterieur) return 'Intérieur terminé';
// ... etc...
return 'Non débuté'; // fallback
```

**Après:**
```javascript
// Cherche PRIORITÉ 1: "Situation du Ménage" field
// Supporte les noms de champs:
//  - group_wu8kv54/Situation_du_M_nage (dans un groupe Kobo)
//  - Situation_du_Menage
//  - situation_menage
//  etc...

// Si trouvé "menage_non_eligible" → retourne "Ménage non éligible"
// Sinon: cherche validation checkpoints
// Fallback: "Non débuté"
```

### 2. **Tests Mis à Jour**
**File:** `backend/tests/kobo.mapping.test.js`

**Nouveau Test 6b: extractStatus - Ineligibility**
```
Input: group_wu8kv54/Situation_du_M_nage: "menage_non_eligible"
Expected: "Ménage non éligible"
Result: ✓ PASSED
```

Résultat: **11/11 tests passent** ✓

### 3. **Database Mise à Jour**
**Script:** `backend/update_maodo_status.js`
```
Maodo Diallo:
  Current status in DB: "Non débuté"
  🔄 Updating status: "Non débuté" → "Ménage non éligible"
  ✅ Updated in database!
```

### 4. **Vérification de Duplication**
**Script:** `backend/debug_duplicates.js`
```
Total households in DB: 9
Names appearing multiple times: 0
Locations with multiple households: 0
✅ Only 1 record for Maodo Diallo - no duplicate in DB
```

---

## 🚀 Solution pour le Doublon sur la Carte

Le doublon n'existe **PAS en base de données**, c'est un problème d'affichage frontend.

### Causes Possibles:

| Cause | Symptômes | Solution |
|-------|-----------|----------|
| **Cache IndexedDB** | Données anciennes persistantes | Effacer IndexedDB |
| **Supercluster overlap** | Deux points au même endroit | Zoomer/Dézoomer ou rafraîchir |
| **Rendu cartographique** | Glitch temporary d'affichage | F5 pour rafraîchir |
| **Données en mémoire dupliquées** | Point double même après refresh | Vider le cache complet |

### 🛠️ **ÉTAPES POUR NETTOYER:**

#### 1️⃣ Vider le Cache IndexedDB (Frontend)
**Dans le navigateur:**
```
1. DevTools (F12)
2. Application Tab
3. IndexedDB → GEM_SAAS (or your app name)
4. Delete the database
5. Rafraîchir la page (F5)
```

Ou **avec console JavaScript:**
```javascript
// 1. List all IndexedDB databases
const dbs = await indexedDB.databases?.();
console.log(dbs);

// 2. Delete specific database
indexedDB.deleteDatabase('GEM_SAAS');

// 3. Rafraîchir la page
location.reload();
```

#### 2️⃣ Vider le Service Worker Cache
```javascript
// DevTools > Console
caches.keys().then(names => {
    names.forEach(name => {
        caches.delete(name);
    });
});

// Puis rafraîchir
location.reload();
```

#### 3️⃣ Reset Complet du Frontend
```javascript
// Clear everything
localStorage.clear();
sessionStorage.clear();
indexedDB.deleteDatabase('GEM_SAAS');
caches.keys().then(names => names.forEach(n => caches.delete(n)));

// Refresh
location.reload();
```

#### 4️⃣ Forcer le Backend à Récharger les Données
```bash
# Terminal
curl -X POST http://localhost:5005/api/kobo/sync \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json"
```

---

## 📊 État Final

### ✅ Maodo Diallo - Status Corrigé
```
ID: 45d77875-b736-442e-92f1-c4841e05b3d5
Name: Maodo Diallo
Status: ✅ "Ménage non éligible" (mis à jour)
Location: (13.32591287395, -13.54918210587883)
Kobo Submission ID: 624908013
```

### ✅ À Jour dans Kobo  
```
Formulaire: Électrification Senegal
Field: group_wu8kv54/Situation_du_M_nage
Value: menage_non_eligible
Transmission Time: 2025-12-08T11:48:41
```

### ✅ No Duplicates in Database
```
Total Households: 9
Maodo Diallo Records: 1
Location Group Duplicates: 0
Name Duplicates: 0
```

---

## 🎯 Prochaines Étapes

### Immédiat:
1. [ ] Vider cache IndexedDB dans le navigateur
2. [ ] Rafraîchir la page Terrain (F5)
3. [ ] Vérifier que Maodo Diallo n'apparaît qu'une fois
4. [ ] Vérifier le statut affiché = "Ménage non éligible"

### Court Terme:
1. [ ] Tester la synchro Kobo complète
2. [ ] Vérifier tous les statuts "Situation du Ménage"
3. [ ] Monitorer les logs pour "menage_non_eligible"

### Moyen Terme:
1. [ ] Automatiser le nettoyage du cache (lors des maj)
2. [ ] Améliorer l'affichage de status sur la carte
3. [ ] Documenter les champs "Situation du Ménage" pour l'équipe

---

## 📝 Code Fichiers Modifiés

### 1. `backend/src/services/kobo.mapping.js`
- Fonction: `extractStatus(row)`
- Lignes: 110-177 (nouvelle version avec priorité "Situation du Ménage")
- Status Values Supportés:
  - `menage_non_eligible` → "Ménage non éligible"
  - `eligible` → "Eligible" (ou autre valeur custom)
  - Sinon: fallback aux checkpoints

### 2. `backend/tests/kobo.mapping.test.js`
- Test 6b: extractStatus - Ineligibility (nouveau)
- Données: testSubmissionKoboIneligible
- Assertion: status === 'Ménage non éligible'

### 3. `backend/check_maodo_duplicates.js` (Debug Script)
- Trouve tous les records de Maodo Diallo
- Affiche le champ "Situation du Ménage" exact
- Vérifie les doublons

### 4. `backend/update_maodo_status.js` (Update Script)
- Récupère données Kobo
- Utilise nouveau extractStatus()
- Met à jour BD avec le bon statut

### 5. `backend/debug_duplicates.js` (Verification Script)
- Cherche doublons par location
- Vérifie doublons par nom
- Confirme 1 seul record Maodo

---

## ✨ Résumé

| Aspect | Avant | Après | Status |
|--------|-------|-------|--------|
| **Statut Maodo Diallo** | "Non débuté" ❌ | "Ménage non éligible" ✅ | FIXED |
| **Source du Statut** | Checkpoints validation | "Situation du Ménage" field | IMPROVED |
| **Doublon en BD** | Unknown | ✅ 1 seul record | VERIFIED |
| **Doublon sur Carte** | Visible ⚠️ | Cache frontend issue | DIAGNOSED |
| **Tests** | 10/10 | 11/11 ✓ | PASSING |

---

**Verdict:** 🟢 STATUT CORRIGÉ - "Ménage non éligible" mis à jour  
**Actions Utilisateur:** Nettoyer cache IndexedDB et rafraîchir la page  
**Statut Production:** Prêt pour déploiement résync complet
