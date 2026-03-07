import { Router } from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const router = Router();
// Ensure pool doesn't exceed connections, just sharing one connection pool for fast MVT querying
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

router.get('/mvt/households/:z/:x/:y', async (req, res) => {
    const { z, x, y } = req.params;

    try {
        const mvtQuery = `
      WITH mvtgeom AS (
        SELECT 
          id, 
          status,
          ST_AsMVTGeom(location_gis, ST_TileEnvelope($1::int, $2::int, $3::int)) AS geom
        FROM "Household"
        WHERE location_gis IS NOT NULL
        AND ST_Intersects(location_gis, ST_TileEnvelope($1::int, $2::int, $3::int))
      )
      SELECT ST_AsMVT(mvtgeom.*, 'households', 4096, 'geom') AS mvt FROM mvtgeom;
    `;

        const result = await pool.query(mvtQuery, [z, x, y]);

        // Set headers for Mapbox Vector Tile (MVT) format
        res.setHeader('Content-Type', 'application/vnd.mapbox-vector-tile');
        // Enable caching for better performance
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Access-Control-Allow-Origin', '*');

        res.send(result.rows[0].mvt);
    } catch (error) {
        console.error('MVT Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate vector tile' });
    }
});

export default router;
