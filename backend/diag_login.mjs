import prisma from './src/core/utils/prisma.js';

// Test exact du code du login controller
async function simulateLogin(emailInput, passwordInput) {
  console.log(`\n=== LOGIN TEST: "${emailInput}" ===`);
  try {
    const user = await prisma.user.findUnique({
      where: { email: emailInput.trim().toLowerCase() },
      include: {
        organization: true,
        role: {
          include: {
            permissions: {
              include: { permission: true }
            }
          }
        }
      }
    });

    if (!user) {
      console.log('Result: USER NOT FOUND (would return 401)');
      return;
    }

    console.log('User found:', user.email);
    
    // This is the exact line that can crash
    const rolePermissions = user.role?.permissions.map(p => p.permission.key) || [];
    console.log('rolePermissions computed OK:', rolePermissions);
    
    const userOverrides = Array.isArray(user.permissions) ? user.permissions : [];
    user.mergedPermissions = [...new Set([...rolePermissions, ...userOverrides])];
    console.log('mergedPermissions:', user.mergedPermissions);
    
    console.log('Result: LOGIN WOULD SUCCEED (if password matches)');
  } catch(e) {
    console.error('CRASH:', e.message);
    console.error('This would cause a 500 error!');
  }
}

// Test all users
const users = await prisma.user.findMany({ select: { email: true } });
for (const u of users) {
  await simulateLogin(u.email, 'dummy');
}

await prisma.$disconnect();
