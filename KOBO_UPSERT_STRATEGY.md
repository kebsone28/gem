# 🔄 Kobo UPSERT Strategy - Fixed

## Problem (Before)
- Manual imports created households with UUID IDs (e.g., `a10cf1b0-9ea3-4791...`)
- Kobo submissions used their own `_id` field 
- UPSERT `WHERE { id: kobo._id }` never matched → **always CREATE**, never UPDATE
- Result: Kobo changes didn't update existing manual imports

## Solution (Now Implemented)
Use **phone + region** as the matching key instead of ID:

```javascript
// NEW LOGIC in syncKoboToDatabase():

// Step 1: Check if household with same phone + region exists
const existingHousehold = await prisma.household.findFirst({
    where: {
        phone: household.phone,
        region: household.region,
        organizationId: organizationId
    },
    select: { id: true }
});

// Step 2: If found, use existing ID for UPSERT (will UPDATE)
//         If not found, use Kobo _id for UPSERT (will CREATE)
const upsertId = existingHousehold ? existingHousehold.id : household.id;

// Step 3: UPSERT using matched ID
await prisma.household.upsert({
    where: { id: upsertId },
    update: { /* updates manual import with Kobo data */ },
    create: { /* creates new household */ }
});
```

## Benefits
✅ Kobo submissions **UPDATE** manually-imported households (if phone + region match)
✅ New Kobo submissions still **CREATE** new households if no match
✅ Phone + region is stable across import sources
✅ Avoids duplicate households
✅ Marks updated households with `source: 'Kobo'`

## Test Case
1. Import 1 manual household with:
   - phone: `784050111`
   - region: `Tambacounda`

2. Submit same household via Kobo form with:
   - telephone: `784050111`
   - region_key: `Tambacounda`
   - status: `COMPLETED` (new value)

3. After sync:
   - Household count: **1** (not 2) ✅
   - Status: **COMPLETED** (updated) ✅
   - Source: **Kobo** ✅

## Code Changes
**File**: `backend/src/services/kobo.service.js`
**Function**: `syncKoboToDatabase() → UPSERT block`
**Lines**: ~253-315

Changes:
1. Added pre-UPSERT lookup by phone + region (lines 259-278)
2. Determine `upsertId` for matching households vs new creation
3. Use `upsertId` in WHERE clause instead of `household.id`
4. Mark updated records with `source: 'Kobo'` in update block
5. Added logging for debugging (✏️ UPDATING vs ✅ CREATING)

## Logging Output
When Kobo sync updates an existing household:
```
[KOBO-SYNC] ✏️ Updating existing household phone=784050111 region=Tambacounda (id=a10cf1b0-...)
```

When Kobo sync creates a new household:
```
[KOBO-SYNC] ✅ Creating new household phone=784050111 region=Tambacounda
```

## Next Steps for Testing
1. User should test with real Kobo data
2. Monitor backend logs for ✏️ vs ✅ messages
3. Verify household count stays constant (not increasing on re-sync)
4. Verify changed fields are actually updated (check DB directly if needed)

## Edge Cases Handled
- **Missing phone**: Falls back to original behavior (Kobo _id matching)
- **Missing region**: Falls back to original behavior
- **Multiple households same phone**: Will match first one (should be rare in real scenario)
- **Null phone in manual import**: Treated as unknown, creates new Kobo household
