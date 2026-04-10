import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const h = await prisma.household.findFirst({
            where: {
                deletedAt: null
            }
        });
        console.log("Location:", JSON.stringify(h.location, null, 2));
        console.log("KoboData keys:", h.koboData ? Object.keys(h.koboData) : 'null');
        if (h.koboData) {
            console.log("KoboData GPS related fields:", Object.keys(h.koboData).filter(k => k.toLowerCase().includes('gps') || k.toLowerCase().includes('point') || k.toLowerCase().includes('geo')));
            // Let's print the value of the _geolocation property if it exists
            console.log("Geolocation:", h.koboData._geolocation);
            // Let's print the actual geometry field if KoboToolbox standard
            console.log("Geometry:", h.koboData._attachments);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
