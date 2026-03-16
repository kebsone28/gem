import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function backfill() {
  console.log('🚀 Starting location_gis backfill...');
  
  try {
    // Fetch all households to inspect them manually
    const households = await prisma.household.findMany({
      select: {
        id: true,
        location: true
      }
    });

    console.log(`🔍 Found ${households.length} potential households to process.`);
    
    let updatedCount = 0;
    for (const h of households) {
      const loc = h.location;
      if (loc && Array.isArray(loc.coordinates) && loc.coordinates.length === 2) {
        const [lon, lat] = loc.coordinates;
        if (typeof lon === 'number' && typeof lat === 'number' && !isNaN(lon) && !isNaN(lat)) {
          await prisma.$executeRaw`
            UPDATE "Household"
            SET location_gis = ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)
            WHERE id = ${h.id}
          `;
          updatedCount++;
          if (updatedCount % 100 === 0) console.log(`  ✅ Processed ${updatedCount}...`);
        }
      }
    }

    console.log(`✨ Backfill complete! Updated ${updatedCount} records.`);
  } catch (error) {
    console.error('❌ Backfill failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

backfill();
