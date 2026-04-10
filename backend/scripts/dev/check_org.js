import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    const res = await pool.query('SELECT "organizationId", COUNT(*) FROM "Household" GROUP BY "organizationId"');
    console.log('Organization counts:', res.rows);

    const resUsers = await pool.query('SELECT id, email, "organizationId" FROM "User"');
    console.log('Users:', resUsers.rows);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await pool.end());
