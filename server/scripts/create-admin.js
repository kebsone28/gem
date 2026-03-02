/**
 * setup-admin.js — Set admin password directly in the database
 */
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

async function main() {
    const password = process.argv[2] || 'admin123';
    const hash = await bcrypt.hash(password, 10);

    const pool = new Pool({
        host: process.env.DB_HOST || 'db',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'electrification',
        user: process.env.DB_USER || 'proquelec',
        password: process.env.DB_PASSWORD || 'proquelec_secure_2024'
    });

    try {
        // Check if admin exists
        const check = await pool.query("SELECT id FROM users WHERE username = 'admin'");
        if (check.rows.length === 0) {
            await pool.query(
                "INSERT INTO users (username, password_hash, display_name, role) VALUES ('admin', $1, 'Administrateur', 'admin')",
                [hash]
            );
            console.log('Admin user created with password:', password);
        } else {
            await pool.query("UPDATE users SET password_hash = $1 WHERE username = 'admin'", [hash]);
            console.log('Admin password updated to:', password);
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

main();
