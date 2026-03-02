import pg from 'pg';
import bcrypt from 'bcryptjs';
const { Client } = pg;

const client = new Client({
    connectionString: 'postgresql://proquelec:proquelec_secure_2024@localhost:5435/electrification?schema=public'
});

async function main() {
    await client.connect();
    const passwordHash = await bcrypt.hash('admin123', 10);

    try {
        // 1. Create Organization
        const orgRes = await client.query(
            'INSERT INTO "Organization" (id, name, "createdAt") VALUES (gen_random_uuid(), $1, NOW()) RETURNING id',
            ['PROQUELEC TEST']
        );
        const orgId = orgRes.rows[0].id;

        // 2. Create User
        const userRes = await client.query(
            'INSERT INTO "User" (id, "organizationId", email, "passwordHash", role, "createdAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW()) RETURNING id',
            [orgId, 'admin@proquelec.com', passwordHash, 'admin']
        );
        const userId = userRes.rows[0].id;

        // 3. Create Project
        await client.query(
            'INSERT INTO "Project" (id, "organizationId", name, status, budget, duration, "totalHouses", config, version, "updatedAt", "updatedById") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 1, NOW(), $8)',
            [orgId, 'Projet Test Electrification 2026', 'active', 500000, 12, 150, {}, userId]
        );

        console.log('✅ Seed successful (Direct PG)');
        console.log('User:', 'admin@proquelec.com / admin123');
    } catch (err) {
        console.error('❌ Seed failed:', err.message);
    } finally {
        await client.end();
    }
}

main();
