import { Router } from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { authProtect } from '../middlewares/auth.js';
import logger from '../../utils/logger.js';
import { validate } from '../../middleware/validate.js';
import Joi from 'joi';
dotenv.config();

const router = Router();
router.use(authProtect);
// Ensure pool doesn't exceed connections, just sharing one connection pool for fast MVT querying
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const mvtParamsSchema = Joi.object({
  z: Joi.number().integer().min(0).max(22).required(),
  x: Joi.number().integer().min(0).required(),
  y: Joi.number().integer().min(0).required(),
}).unknown(false);

const mvtQuerySchema = Joi.object({
  projectId: Joi.string().uuid().required(),
}).unknown(false);

router.get('/mvt/households/:z/:x/:y', validate({ params: mvtParamsSchema }), validate({ query: mvtQuerySchema }), async (req, res) => {
  const { z, x, y } = req.params;
  const { projectId } = req.query;

  let client;
  try {
    if (!projectId || projectId === 'undefined') {
      res.setHeader('Content-Type', 'application/vnd.mapbox-vector-tile');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(Buffer.alloc(0));
    }

    client = await pool.connect();
    
    // ✅ Architecture SIG Pro: Garantir le search_path pour PostGIS
    await client.query('SET search_path TO public');

    const mvtQuery = `
      WITH mvtgeom AS (
        SELECT 
          h.id as household_id, 
          h.numeroordre,
          h.status,
          h."constructionData",
          h.alerts,
          ST_AsMVTGeom(ST_Transform(h.location_gis, 3857), ST_TileEnvelope($1::int, $2::int, $3::int)) AS geom
        FROM "Household" h
        JOIN "Zone" z ON h."zoneId" = z.id
        WHERE h.location_gis IS NOT NULL
        AND z."projectId" = $4
        AND ST_Intersects(h.location_gis, ST_Transform(ST_TileEnvelope($1::int, $2::int, $3::int), 4326))
      )
      SELECT ST_AsMVT(mvtgeom.*, 'households', 4096, 'geom') AS mvt FROM mvtgeom;
    `;

    const result = await client.query(mvtQuery, [z, x, y, projectId]);

    // Set headers for Mapbox Vector Tile (MVT) format
    res.setHeader('Content-Type', 'application/vnd.mapbox-vector-tile');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    // Manual CORS for MVT (echoing origin for credentials support)
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (result.rows && result.rows.length > 0 && result.rows[0].mvt) {
      res.send(result.rows[0].mvt);
    } else {
      res.send(Buffer.alloc(0));
    }
  } catch (error) {
    logger.error('MVT Generation Error:', error);
    res.status(500).json({ error: 'Failed to generate vector tile' });
  } finally {
    if (client) client.release();
  }
});

export default router;
