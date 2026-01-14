// Simple seed script that can run with node directly (no tsx needed)
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting seed...');
  
  // Create a super admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
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
  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
