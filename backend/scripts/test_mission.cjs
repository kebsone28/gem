const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function testAll() {
  const results = [];
  try {
    const org = await p.organization.findFirst();
    results.push({ test: "Connexion DB", ok: !!org, detail: org?.name });

    const users = await p.user.findMany({ select: { email: true, roleLegacy: true } });
    const roles = users.map(u => u.roleLegacy);
    const hasAllRoles = roles.includes("CHEF_PROJET") && roles.includes("COMPTABLE") && roles.includes("DIRECTEUR");
    results.push({ test: "Roles utilisateurs", ok: hasAllRoles, detail: roles.join(", ") });

    const missions = await p.mission.findMany({ take: 5, orderBy: { createdAt: "desc" } });
    results.push({ test: "Missions en base", ok: true, detail: missions.length + " mission(s)" });

    const wfs = await p.missionApprovalWorkflow.findMany({ take: 5, include: { approvalSteps: true } });
    results.push({ test: "Workflows", ok: true, detail: wfs.length + " workflow(s), " + wfs.reduce((s,w) => s + w.approvalSteps.length, 0) + " etape(s) total" });

    console.log("\n========= RAPPORT DE TEST MISSION =========");
    results.forEach(r => console.log("[" + (r.ok ? "OK " : "ERR") + "] " + r.test.padEnd(28) + " | " + r.detail));
    const failed = results.filter(r => !r.ok);
    console.log("-------------------------------------------");
    console.log(failed.length === 0 ? "TOUS LES TESTS PASSES" : failed.length + " PROBLEME(S): " + failed.map(f=>f.test).join(", "));
  } catch(e) {
    console.error("ERREUR:", e.message);
  } finally {
    await p.$disconnect();
  }
}
testAll();
