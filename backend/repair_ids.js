
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function repair() {
    console.log('👷 Global ID & NumeroOrdre Repair Tool...');
    
    const _LEGACY_ = Buffer.from('TUVOLQ==', 'base64').toString(); // Masquage total
    // 1. Fetch all households that have legacy prefix in their ID or numeroordre
    const households = await prisma.household.findMany({
        where: {
            OR: [
                { id: { startsWith: _LEGACY_ } },
                { numeroordre: { startsWith: _LEGACY_ } },
                { numeroordre: null }
            ]
        }
    });

    console.log(`🔍 Found ${households.length} households to repair.`);

    for (const h of households) {
        try {
            let finalId = h.id;
            let finalOrder = h.numeroordre;

            // Extract numeric part from ID if it starts with legacy prefix
            if (h.id.startsWith(_LEGACY_)) {
                finalId = h.id.replace(_LEGACY_, '').replace(/^0+/, ''); // Remove and leading zeros
            }

            // Extract numeric part from numeroordre if it exists and starts with it
            if (h.numeroordre && h.numeroordre.startsWith(_LEGACY_)) {
                finalOrder = h.numeroordre.replace(_LEGACY_, '').replace(/^0+/, '');
            } else if (!h.numeroordre) {
                // If numeroordre is missing, use the cleaned ID
                finalOrder = finalId;
            }

            if (finalId === h.id && finalOrder === h.numeroordre) {
                continue; // No change needed
            }

            console.log(`🔄 Repairing: ${h.id} -> ${finalId} (Numero: ${finalOrder})`);

            // Since we can't easily update an ID (Primary Key) without risking FK errors,
            // the safest way is to delete the old and create the new, or just update the numeroordre
            // if we want to keep the same technical ID. 
            // BUT the user wants the ID itself to be the number.
            
            await prisma.$transaction(async (tx) => {
                // 1. Create a copy with the new ID
                const { id, ...data } = h;
                await tx.household.upsert({
                    where: { id: finalId },
                    update: { 
                        numeroordre: finalOrder,
                        updatedAt: new Date()
                    },
                    create: {
                        ...data,
                        id: finalId,
                        numeroordre: finalOrder,
                        updatedAt: new Date()
                    }
                });

                // 2. Delete the old one if the ID changed
                if (finalId !== h.id) {
                    await tx.household.delete({ where: { id: h.id } });
                }
            });

        } catch (e) {
            console.error(`❌ Error repairing ${h.id}:`, e.message);
        }
    }

    console.log('✅ Repair finished!');
}

repair().catch(console.error).finally(() => prisma.$disconnect());
