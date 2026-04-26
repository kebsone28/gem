import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  try {
    const total = await prisma.household.count({ where: { deletedAt: null } });
    const tamba = await prisma.household.findMany({
      where: { 
        region: { contains: 'TAMBA', mode: 'insensitive' },
        deletedAt: null
      },
      select: { village: true, departement: true, region: true }
    });

    const villages = new Set();
    tamba.forEach(h => {
      const v = h.village || h.departement || 'Inconnu';
      villages.add(v);
    });

    // Check Grappes
    const grappes = await prisma.grappe.findMany({
        where: { 
            region: { 
                name: { contains: 'TAMBA', mode: 'insensitive' } 
            } 
        },
        include: { region: true }
    });

    const results = {
        total_households: total,
        tamba_households: tamba.length,
        tamba_villages_detected_in_households: villages.size,
        tamba_grappes_calculated: grappes.length,
        villages_list_sample: Array.from(villages).sort().slice(0, 15),
        grappes_list_sample: grappes.map(g => g.name).sort().slice(0, 15)
    };

    console.log(JSON.stringify(results, null, 2));

  } catch (e) {
    console.error("ERROR:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
