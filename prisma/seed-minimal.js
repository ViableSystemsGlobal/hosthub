// Minimal seed script using standard Prisma client (no pg adapter needed)
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');
  
  // Create a super admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  try {
    const superAdmin = await prisma.user.upsert({
      where: { email: 'admin@hosthub.com' },
      update: {},
      create: {
        id: 'admin-user-001',
        email: 'admin@hosthub.com',
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        name: 'Super Admin',
        updatedAt: new Date(),
      },
    });
    console.log('Created super admin:', superAdmin.email);
  } catch (e) {
    console.log('Super admin already exists or error:', e.message);
  }

  try {
    // Create an admin user
    const admin = await prisma.user.upsert({
      where: { email: 'manager@hosthub.com' },
      update: {},
      create: {
        id: 'admin-user-002',
        email: 'manager@hosthub.com',
        password: hashedPassword,
        role: 'ADMIN',
        name: 'Manager',
        updatedAt: new Date(),
      },
    });
    console.log('Created admin:', admin.email);
  } catch (e) {
    console.log('Admin already exists or error:', e.message);
  }

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
