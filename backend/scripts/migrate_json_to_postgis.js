import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function migrateToPostGIS() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });

    try {
        await client.connect();
        console.log("Connected to PostgreSQL.");

        // 1. Add column if it doesn't exist
        await client.query(`
      ALTER TABLE "Household" 
      ADD COLUMN IF NOT EXISTS location_gis geometry(Point, 4326);
    `);
        console.log("Added location_gis column to Household table.");

        // 2. Create spatial index for fast rendering
        await client.query(`
      CREATE INDEX IF NOT EXISTS household_location_gis_idx 
      ON "Household" USING GIST(location_gis);
    `);
        console.log("Created GiST spatial index on location_gis.");

        // 3. Migrate JSON data to PostGIS geometry
        console.log("Migrating JSON coordinates to PostGIS geometry...");
        const res = await client.query('SELECT id, location FROM "Household" WHERE location_gis IS NULL');

        let updatedCount = 0;
        for (const row of res.rows) {
            if (row.location && Array.isArray(row.location.coordinates) && row.location.coordinates.length === 2) {
                const lng = row.location.coordinates[0];
                const lat = row.location.coordinates[1];

                if (!isNaN(parseFloat(lng)) && !isNaN(parseFloat(lat))) {
                    await client.query(
                        'UPDATE "Household" SET location_gis = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id=$3',
                        [lng, lat, row.id]
                    );
                    updatedCount++;
                }
            }
        }
        console.log(`Successfully migrated ${updatedCount} households.`);

    } catch (error) {
        console.error("Migration error:", error);
    } finally {
        await client.end();
    }
}

migrateToPostGIS();
