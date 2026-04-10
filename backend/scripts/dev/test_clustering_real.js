import prisma from './src/core/utils/prisma.js';
import { generateDynamicGrappes } from './src/utils/clustering.js';
import dotenv from 'dotenv';
dotenv.config();

async function testClustering() {
    const households = await prisma.household.findMany({
        where: { deletedAt: null }
    });
    console.log(`Found ${households.length} households.`);
    
    // Grouping by region
    const result = generateDynamicGrappes(households);
    console.log('--- Clustering Result ---');
    console.log(`Generated ${result.grappes.length} grappes.`);
    console.log(`Generated ${result.sous_grappes.length} sous-grappes.`);
    
    if (result.grappes.length > 0) {
        console.log('Sample Grappe:', result.grappes[0]);
    }
    
    await prisma.$disconnect();
}
testClustering();
