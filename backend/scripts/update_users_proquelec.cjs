const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function update() {
  console.log(" MISE À JOUR DES EMAILS PROQUELEC...");
  
  const updates = [
    { role: "ADMIN_PROQUELEC", email: "oumarkebe@proquelec.sn" },
    { role: "DIRECTEUR", email: "moustapha.dieye@proquelec.sn" },
    { role: "COMPTABLE", email: "laye.seydi@proquelec.sn" },
    { role: "DG_PROQUELEC", email: "proquelec@proquelec.sn" }
  ];

  for (const up of updates) {
    const user = await p.user.findFirst({ where: { roleLegacy: up.role } });
    if (user) {
      await p.user.update({
        where: { id: user.id },
        data: { email: up.email }
      });
      console.log(` Mis à jour: ${up.role} -> ${up.email}`);
    } else {
      console.log(` Aucun utilisateur trouvé pour le rôle: ${up.role}`);
    }
  }
}
update().finally(() => p.$disconnect());
