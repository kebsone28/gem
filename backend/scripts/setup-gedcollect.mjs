import { basePrisma as prisma } from '../src/core/utils/prisma.js';

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, phone: true, phoneActivated: true, organizationId: true },
  });
  console.log('=== USERS ===');
  users.forEach((u) => console.log(JSON.stringify(u)));

  const forms = await prisma.koboFormMapping.findMany({
    select: { organizationId: true, koboAssetId: true, version: true, mapping: true },
  });
  console.log('\n=== FORMS ===');
  forms.forEach((f) => {
    const title = f.mapping?.settings?.[0]?.form_title || f.koboAssetId;
    console.log(title + ' (' + f.koboAssetId + ') v' + f.version);
  });

  if (users.length > 0) {
    const user = users[0];
    if (!user.phone) {
      await prisma.user.update({
        where: { id: user.id },
        data: { phone: '771234567', phoneActivated: true },
      });
      console.log('\n✓ Phone set & activated for ' + user.name);
    } else {
      console.log('\nUser already has phone: ' + user.phone);
      if (!user.phoneActivated) {
        await prisma.user.update({
          where: { id: user.id },
          data: { phoneActivated: true },
        });
        console.log('✓ Activated ' + user.name);
      }
    }

    if (forms.length > 0) {
      const orgForms = forms.filter((f) => f.organizationId === user.organizationId);
      for (const f of orgForms) {
        const existing = await prisma.gedcollectAssignment.findFirst({
          where: { organizationId: user.organizationId, userId: user.id, formKey: f.koboAssetId },
        });
        if (!existing) {
          await prisma.gedcollectAssignment.create({
            data: {
              organizationId: user.organizationId,
              userId: user.id,
              formKey: f.koboAssetId,
            },
          });
          console.log('✓ Assigned: ' + (f.mapping?.settings?.[0]?.form_title || f.koboAssetId));
        } else {
          console.log('Already assigned: ' + (f.mapping?.settings?.[0]?.form_title || f.koboAssetId));
        }
      }
    } else {
      console.log('\n⚠ No forms found. Import a form in the admin first (https://ged.proquelec.sn/admin/internal-kobo).');
    }
  }

  const finalUser = await prisma.user.findFirst({ where: { phoneActivated: true } });
  console.log('\n=== LOGIN CREDENTIALS (for mobile app) ===');
  console.log('Server URL: https://ged.proquelec.sn');
  console.log('Phone: ' + (finalUser?.phone || 'N/A'));
  console.log('OTP code (dev mode): 1234');

  const assigns = await prisma.gedcollectAssignment.findMany({
    include: { user: { select: { name: true, phone: true } } },
  });
  console.log('\n=== ASSIGNMENTS ===');
  assigns.forEach((a) => console.log((a.user?.name || '?') + ' → formKey: ' + a.formKey));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
