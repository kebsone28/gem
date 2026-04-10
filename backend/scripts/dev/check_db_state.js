import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
    const households = await p.household.count();
    const regions = await p.region.count();
    const grappes = await p.grappe.count();
    const org = await p.organization.findFirst({ select: { id: true, name: true } });
    
    console.log('=== DB STATUS ===');
    console.log('Households:', households);
    console.log('Regions:', regions);
    console.log('Grappes:', grappes);
    console.log('First Org:', JSON.stringify(org));
    
    if (households > 0) {
        const sample = await p.household.findFirst({ select: { id: true, region: true, location_gis: true } });
        console.log('Sample household:', JSON.stringify(sample));
    }
}

main().catch(console.error).finally(() => p.$disconnect());
