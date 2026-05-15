import prisma from './src/core/utils/prisma.js';
import bcrypt from 'bcryptjs';

async function diagnose() {
  try {
    console.log('🔍 Checking database connection...');

    // Test DB connection
    const result = await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connected:', result);

    // Check if user exists
    const user = await prisma.user.findFirst({
      where: { email: 'admingem' },
    });

    if (!user) {
      console.log('❌ User "admingem" NOT found in database');
      console.log('\n📋 Creating user now...');

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('suprime', salt);
      const answerHash = await bcrypt.hash('coran', salt);

      // Find or create organization
      let org = await prisma.organization.findFirst({ where: { name: 'PROQUELEC' } });
      if (!org) {
        console.log('Creating organization PROQUELEC...');
        org = await prisma.organization.create({ data: { name: 'PROQUELEC' } });
      }

      // Create user
      const newUser = await prisma.user.create({
        data: {
          email: 'admingem',
          passwordHash,
          name: 'Admin GEM',
          roleLegacy: 'ADMIN_PROQUELEC',
          organizationId: org.id,
          requires2FA: true,
          securityQuestion: 'Votre référence spirituelle',
          securityAnswerHash: answerHash,
        },
      });

      console.log('✅ User created:', newUser.email);
    } else {
      console.log('✅ User "admingem" found in database');
      console.log('   Email:', user.email);
      console.log('   Password Hash exists:', !!user.passwordHash);
      console.log('   Requires 2FA:', user.requires2FA);
      console.log('   Organization ID:', user.organizationId);
    }

    console.log('\n✅ Diagnostics complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

diagnose();
