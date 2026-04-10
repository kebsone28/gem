# ✅ Fix Kobo Sync UPDATE Issue - Complete Solution

## Problem You Reported
"J'ai changé le nombre de ménage sur kobo serveur en 1 ménage, mais après synchronisation rien n'est mise à jour sur le ménage concerné j'ai chargé manuellement."

## Root Cause
The old Kobo UPSERT logic used Kobo's internal submission ID (`_id`) as the lookup key. When you:
1. **Manually imported** a household → It got a **random UUID** (e.g., `a10cf1b0-9ea3...`)
2. **Submitted same household via Kobo** → It had a **different Kobo _id**
3. **Sync tried UPSERT** → `WHERE { id: kobo._id }` didn't find the manual import
4. **Result**: Created NEW household instead of UPDATING existing one

## ✅ Solution Implemented

### New Matching Strategy
The sync now matches households by **phone + region** (common identifiers between both sources):

```javascript
// 1. Check if household with same phone + region exists
const existingHousehold = await prisma.household.findFirst({
    where: {
        phone: household.phone,
        region: household.region,
        organizationId: organizationId
    }
});

// 2. If found → UPDATE using existing ID
//    If not found → CREATE using Kobo _id
const upsertId = existingHousehold ? existingHousehold.id : household.id;

// 3. UPSERT with matched ID
await prisma.household.upsert({
    where: { id: upsertId },
    update: { /* updates manual import with Kobo data */ },
    create: { /* creates new household */ }
});
```

### What Changed in Code
**File**: `backend/src/services/kobo.service.js`

**Changes**:
1. Added pre-UPSERT lookup by `phone + region` (lines ~256-278)
2. Determine `upsertId` based on match (existing ID vs new Kobo ID)
3. Use `upsertId` in WHERE clause, not `household.id`
4. Mark UPDATED records with `source: 'Kobo'`
5. Fixed `validateGPSRegion()` bug (undefined variable reference)
6. Added logging for debugging (✏️ UPDATE vs ✅ CREATE)

**Bug Fixed**:
- `validateGPSRegion()` was referencing `submission` variable that didn't exist in its scope
- Now properly accepts `submissionId` parameter

## How to Test

### Test Case 1: Manual → Kobo Update (Your Scenario)

**Step 1**: Manually import 1 household via CSV with:
- **Phone**: `701234567` (must be unique)
- **Region**: `Tambacounda`
- **Any other fields**: name, etc.

**Step 2**: Submit same household via Kobo form with:
- **telephone**: `701234567` (SAME phone)
- **region**: `Tambacounda` (SAME region)
- **Some changed field**: e.g., status = `COMPLETED`

**Step 3**: Trigger Kobo sync (via UI: DataHub → "Synchroniser avec Kobo")

**Step 4**: Verify in DB:
```bash
# Should show 1 household (not 2)
SELECT COUNT(*) FROM "Household";  -- Result: 1 (or original + 1)

# Should be marked as Kobo
SELECT id, phone, region, source, status FROM "Household" WHERE phone = '701234567';
-- Result: source='Kobo', status='COMPLETED' (updated)
```

### Test Case 2: Duplicate Prevention
1. Sync same Kobo submission twice
2. Household count should NOT increase
3. Logs should show "✏️ Updating existing household..." not "✅ Creating new household..."

## Expected Behavior AFTER Fix

### Scenario: Manual Import Exists  
```
Manual Import:   id=uuid1, phone=701234567, region=Tambacounda, source=null
Kobo Submission: _id=624908013, phone=701234567, region=Tambacounda, status=COMPLETED

SYNC RESULT:
- Lookup: Found household with phone=701234567 + region=Tambacounda
- Action: UPDATE (use uuid1 as upsertId)
- Final DB: id=uuid1, phone=701234567, region=Tambacounda, source='Kobo', status='COMPLETED'
- Count: NO CHANGE (still 1 household) ✅
```

### Scenario: No Manual Import Exists
```
Kobo Submission: _id=624908013, phone=701234567, region=Tambacounda

SYNC RESULT:
- Lookup: No household with phone=701234567 + region=Tambacounda
- Action: CREATE (new household with _id)
- Final DB: id=624908013, phone=701234567, region=Tambacounda, source='Kobo'
- Count: +1 (new record created) ✅
```

## Logs to Watch For

### ✏️ UPDATING existing household (good sign!)
```
[KOBO-SYNC] ✏️ Updating existing household phone=701234567 region=Tambacounda (id=a10cf1b0...)
[KOBO-SYNC] ✅ Done — Applied: 1, Skipped: 0, Errors: 0
```

### ✅ CREATING new household (also good)
```
[KOBO-SYNC] ✅ Creating new household phone=701234567 region=Tambacounda
[KOBO-SYNC] ✅ Done — Applied: 1, Skipped: 0, Errors: 0
```

### ⚠️ GPS-Region mismatch (warning, still processes)
```
[KOBO-SYNC] ⚠️ GPS-REGION MISMATCH - ID: 624908013, Region: Tambacounda, GPS: [13.32, -13.54]
```

## Edge Cases

| Scenario | Phone | Region | Result |
|----------|-------|--------|--------|
| Manual + Kobo match | Same | Same | **UPDATE** ✏️ |
| New Kobo submission | New | New | **CREATE** ✅ |
| Kobo, no phone field | null | Same | **CREATE** ✅ (can't match without phone) |
| Multiple same phone | 701234567 | Tambacounda | Updates FIRST match (should be rare) |

## Files Modified
- `backend/src/services/kobo.service.js` - UPSERT strategy + bug fix

## Files Created (For Reference)
- `KOBO_UPSERT_STRATEGY.md` - Strategy documentation
- `backend/test_kobo_sync_real.js` - Test script

## ⚠️ Important Notes

1. **Phone field is critical**: Your Kobo form MUST have a `telephone` or `phone` field
2. **Region field is critical**: Your Kobo form MUST have a `region` or `region_key` field
3. **Source tracking**: Synced households are marked with `source = 'Kobo'`
4. **First match wins**: If multiple households have same phone + region, first one is used (edge case)

## Testing Your Actual Data

When you test with your real Kobo data:

```bash
# 1. Check how many households before sync
SELECT COUNT(*) FROM "Household";

# 2. Check backend logs during sync
# Look for ✏️ vs ✅ messages

# 3. Verify count after sync
SELECT COUNT(*) FROM "Household";
# Should be: original_count + (new_kobo_submissions)
# NOT: original_count + (all_kobo_submissions)

# 4. Verify source field
SELECT id, phone, region, source FROM "Household" LIMIT 10;
# Should show source='Kobo' for synced households
```

## Support Information

If you still see issues:
1. **Check backend logs** for ✏️ vs ✅ messages
2. **Verify phone field exists** in both manual import and Kobo
3. **Verify region field exists** in both sources
4. **Check phone format** (no spaces, same format in both)
5. **Check region spelling** (case-sensitive matching)

---

**Status**: ✅ Fixed and Tested  
**Impact**: Manual imports will now be UPDATED by Kobo submissions (no more duplicates)  
**Backwards Compatible**: Yes (new Kobo submissions still work fine)
