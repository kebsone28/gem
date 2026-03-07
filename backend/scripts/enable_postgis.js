import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function enablePostGIS() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log("Connected to PostgreSQL.");

        await client.query('CREATE EXTENSION IF NOT EXISTS postgis;');
        console.log("PostGIS extension enabled.");

        const res = await client.query('SELECT PostGIS_Version();');
        console.log("PostGIS Version:", res.rows[0].postgis_version);
    } catch (error) {
        console.error("Error enabling PostGIS:", error);
    } finally {
        await client.end();
    }
}

enablePostGIS();
