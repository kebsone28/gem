import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    const res = await pool.query('SELECT COUNT(*) FROM "Household"');
    const count = res.rows[0].count;

    const resGis = await pool.query('SELECT COUNT(*) FROM "Household" WHERE location_gis IS NOT NULL');
    const countGis = resGis.rows[0].count;

    console.log(`Total Households: ${count}`);
    console.log(`Households with GIS: ${countGis}`);

    if (count > 0) {
        const resSample = await pool.query('SELECT id, status, ST_AsText(location_gis) as loc FROM "Household" LIMIT 3');
        console.log('Samples:', resSample.rows);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await pool.end());
