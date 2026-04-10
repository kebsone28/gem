# Test du Kobo Sync avec numeroordre Matching

## 📋 Objective  
Vérifier que la synchronisation Kobo fonctionne correctement avec le matching par `numeroordre` (clé métier unique) pour éviter les doublons.

## ✅ Prerequisites 

- [x] Migration Prisma appliquée (`numeroordre` colonne ajoutée à la BD)
- [x] Module de mapping créé (`backend/src/services/kobo.mapping.js`)
- [x] Service Kobo modifié pour utiliser le module de mapping
- [ ] Backend démarré sur le port 5005

## 🚀 Étapes de Test

### Step 1: Démarrer le Backend

```bash
cd backend
npm start
```

Attendez le message:
```
✅ Server running on port 5005
```

### Step 2: Tester le Kobo Sync (Incremental)

Déclenchez un sync Kobo avec un token d'authentification valide:

```bash
curl -X POST http://localhost:5005/api/kobo/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "zoneId": "your-zone-id-here"
  }'
```

### Step 3: Vérifier les Logs de Sync

Dans les logs du serveur, vous devriez voir:

**✅ SUCCÈS** - Ménage existant updated (pas de doublon créé):
```
[KOBO-SYNC] 🔄 UPDATE existing household: {household.id} with Kobo submission {submission._id}
```

**❌ PROBLÈME** - Si tous les ménages sont en création:
```
[KOBO-SYNC] 🆕 CRÉATION: Nouveau ménage (upsert par koboSubmissionId)
```

### Step 4: Vérifier en Base de Données

Vérifiez que le ménage avec `numeroordre=4526` (Maodo Diallo) a:
- [x] Exactement **1 enregistrement** dans la BD (pas de doublon)
- [x] Champ `numeroordre` rempli avec `"4526"`
- [x] Champ `koboSubmissionId` rempli (l'ID Kobo du submission)
- [x] Statut mis à jour avec les dernières données Kobo

```sql
SELECT id, name, numeroordre, koboSubmissionId, status, updatedAt 
FROM "Household" 
WHERE numeroordre = '4526'
LIMIT 5;
```

### Step 5: Tester un Submission Dupliqué

1. Dans Kobo, soumettez à nouveau le même formulaire avec `numeroordre=4526`
2. Déclenchez à nouveau le sync
3. Vérifiez qu'il y a toujours **1 seul enregistrement** dans la BD (UPDATE, pas CREATE)
4. Le champ `updatedAt` doit être plus récent

```sql
SELECT id, name, numeroordre, updatedAt, koboData->'_submission_time' as last_submission
FROM "Household" 
WHERE numeroordre = '4526';
```

## 🐛 Troubleshooting

### Issue 1: Ménages non trouvés (numeroordre = NULL)

**Symptôme:** Tous les ménages sont créés comme nouveaux

**Causes possibles:**
- Le module de mapping n'extrait pas le `numeroordre` correctement
- Le Kobo form n'a pas de champ `numeroordre/numero_ordre/Numero_ordre/id_menage`
- La validation du mapping rejette les rows

**Solution:**
1. Vérifiez les noms des champs Kobo dans votre form
2. Mettez à jour `extractNumeroOrdre()` dans `kobo.mapping.js` si nécessaire
3. Ajoutez du log: `console.log('numeroordre extrait:', household.numeroOrdre);`

### Issue 2: Duplication de Ménages

**Symptôme:** Même ménage créé 2-3 fois

**Cause probable:** 
- Le matching par `numeroordre` ne fonctionne pas
- La colonne `numeroordre` n'est pas UNIQUE en BD

**Solution:**
```bash
# Vérifier l'état de la migration
npx prisma migrate status

# Réappliquer si nécessaire
npx prisma migrate deploy
```

### Issue 3: Erreurs "Invalid UUID format"

**Symptôme:** 
```
Error: Invalid UUID format for household.id
```

**Cause:**
- L'ancienne logique cherchait `household.id` qui n'existe pas au démarrage

**Solution:** ✅ Déjà corrigée dans la version actuelle

## 📊 Expected Test Output

```
[KOBO-SYNC] 🔄 Starting sync for org abc123def456, since: null
[KOBO-SYNC] Fetching submissions from Kobo...
[KOBO-SYNC] 🔄 UPDATE existing household: h-uuid-12345 with Kobo submission 9876543210
[KOBO-SYNC] 🔄 UPDATE existing household: h-uuid-67890 with Kobo submission 9876543211
[KOBO-SYNC] 🆕 CRÉATION: Nouveau ménage (numéro=4527) with submission 9876543212
[KOBO-SYNC] ✅ Sync complete: applied=2, skipped=0, errors=0, total=3
```

## 🎯 Success Criteria

- ✅ No "Invalid UUID format" errors
- ✅ Existing households are UPDATEd (not duplicated)
- ✅ `numeroordre` column populated for all households
- ✅ Database shows exactly 1 record per numeroordre
- ✅ Sync log shows "🔄 UPDATE" for existing, "🆕 CRÉATION" for new
- ✅ No MapLibre null-safe errors on frontend after backend restart

## 📝 Next Steps

After successful test:
1. [ ] Verify frontend Terrain page displays all households correctly
2. [ ] Test with full production Kobo dataset
3. [ ] Monitor sync logs for any errors
4. [ ] Create automated sync scheduler (every N hours/days)
5. [ ] Document field mapping for data team

---

**Test Date:** [Your Date]  
**Tester:** [Your Name]  
**Result:** ✅ PASSED / ❌ FAILED
