import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const z = 0, x = 0, y = 0;
    const mvtQuery = `
      WITH mvtgeom AS (
        SELECT 
          id, 
          status,
          ST_AsMVTGeom(ST_Transform(location_gis, 3857), ST_TileEnvelope($1::int, $2::int, $3::int)) AS geom
        FROM "Household"
        WHERE location_gis IS NOT NULL
        AND ST_Intersects(location_gis, ST_Transform(ST_TileEnvelope($1::int, $2::int, $3::int), 4326))
      )
      SELECT ST_AsMVT(mvtgeom.*, 'households', 4096, 'geom') AS mvt FROM mvtgeom;
  `;

    const result = await prisma.$queryRawUnsafe(mvtQuery, z, x, y);
    console.log('MVT Result Length:', result[0].mvt.length);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
