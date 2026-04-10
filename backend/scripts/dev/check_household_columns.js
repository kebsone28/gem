import prisma from './src/core/utils/prisma.js';

async function checkColumns() {
    try {
        // Query the actual database schema
        const result = await prisma.$queryRaw`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name='Household' 
            AND column_name LIKE '%kobo%'
            ORDER BY column_name
        `;
        
        console.log('=== Colonnes Household contenant "kobo" ===\n');
        if (result.length === 0) {
            console.log('❌ Aucune colonne "kobo*" trouvée');
        } else {
            result.forEach(row => {
                console.log(`✓ ${row.column_name}: ${row.data_type}`);
            });
        }

        // Also check all household columns
        const allCols = await prisma.$queryRaw`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name='Household'
            ORDER BY ordinal_position
        `;

        console.log('\n=== Toutes les colonnes Household ===\n');
        allCols.forEach(row => {
            console.log(`- ${row.column_name}: ${row.data_type}`);
        });

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkColumns();
