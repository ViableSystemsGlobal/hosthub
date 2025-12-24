import { PrismaClient, UserRole, Currency, BookingStatus, BookingSource, ExpenseCategory, TaskType, TaskStatus } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import { addDays, subDays, startOfMonth, endOfMonth } from 'date-fns'
import 'dotenv/config'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  // Create a super admin user
  const hashedPassword = await bcrypt.hash('admin123', 10)
  
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@hosthub.com' },
    update: {},
    create: {
      id: 'admin-user-001',
      email: 'admin@hosthub.com',
      password: hashedPassword,
      role: UserRole.SUPER_ADMIN,
      name: 'Super Admin',
      updatedAt: new Date(),
    },
  })

  console.log('Created super admin:', superAdmin.email)

  // Create an admin user
  const admin = await prisma.user.upsert({
    where: { email: 'manager@hosthub.com' },
    update: {},
    create: {
      id: 'admin-user-002',
      email: 'manager@hosthub.com',
      password: hashedPassword,
      role: UserRole.ADMIN,
      name: 'Manager',
      updatedAt: new Date(),
    },
  })

  console.log('Created admin:', admin.email)

  // Check if owner already exists
  const existingOwner = await prisma.owner.findFirst({
    where: { email: 'owner@example.com' }
  })

  let owner
  if (!existingOwner) {
    // Create a sample owner
    owner = await prisma.owner.create({
      data: {
        id: crypto.randomUUID(),
        name: 'John Doe',
        email: 'owner@example.com',
        phoneNumber: '+233123456789',
        preferredCurrency: Currency.GHS,
        status: 'active',
        updatedAt: new Date(),
        // Note: Owner model doesn't have a direct user relation in Prisma 6
        // User must be created separately
      },
    })
    console.log('Created owner:', owner.name)

    // Create a sample property
    const property = await prisma.property.create({
      data: {
        id: crypto.randomUUID(),
        ownerId: owner.id,
        name: 'Beach House',
        nickname: 'Beach House Accra',
        address: '123 Beach Road',
        city: 'Accra',
        country: 'Ghana',
        currency: Currency.GHS,
        defaultCommissionRate: 0.15,
        status: 'active',
        updatedAt: new Date(),
      },
    })
    console.log('Created property:', property.name)

    // Create sample bookings
    const now = new Date()
    const bookings = [
      {
        propertyId: property.id,
        ownerId: owner.id,
        source: BookingSource.AIRBNB,
        guestName: 'Sarah Johnson',
        checkInDate: subDays(now, 10),
        checkOutDate: subDays(now, 7),
        nights: 3,
        baseAmount: 450,
        cleaningFee: 50,
        platformFees: 67.5,
        taxes: 0,
        totalPayout: 450,
        currency: Currency.GHS,
        fxRateToBase: 1.0,
        totalPayoutInBase: 450,
        status: BookingStatus.COMPLETED,
      },
      {
        propertyId: property.id,
        ownerId: owner.id,
        source: BookingSource.BOOKING_COM,
        guestName: 'Michael Chen',
        checkInDate: subDays(now, 5),
        checkOutDate: subDays(now, 2),
        nights: 3,
        baseAmount: 480,
        cleaningFee: 50,
        platformFees: 72,
        taxes: 0,
        totalPayout: 480,
        currency: Currency.GHS,
        fxRateToBase: 1.0,
        totalPayoutInBase: 480,
        status: BookingStatus.COMPLETED,
      },
      {
        propertyId: property.id,
        ownerId: owner.id,
        source: BookingSource.DIRECT,
        guestName: 'Emma Williams',
        checkInDate: addDays(now, 5),
        checkOutDate: addDays(now, 8),
        nights: 3,
        baseAmount: 420,
        cleaningFee: 50,
        platformFees: 0,
        taxes: 0,
        totalPayout: 420,
        currency: Currency.GHS,
        fxRateToBase: 1.0,
        totalPayoutInBase: 420,
        status: BookingStatus.UPCOMING,
      },
      {
        propertyId: property.id,
        ownerId: owner.id,
        source: BookingSource.INSTAGRAM,
        guestName: 'David Brown',
        checkInDate: addDays(now, 15),
        checkOutDate: addDays(now, 18),
        nights: 3,
        baseAmount: 400,
        cleaningFee: 50,
        platformFees: 0,
        taxes: 0,
        totalPayout: 400,
        currency: Currency.GHS,
        fxRateToBase: 1.0,
        totalPayoutInBase: 400,
        status: BookingStatus.UPCOMING,
      },
    ]

    for (const bookingData of bookings) {
      await prisma.booking.create({ 
        data: {
          ...bookingData,
          id: crypto.randomUUID(),
          updatedAt: new Date(),
        }
      })
    }
    console.log(`Created ${bookings.length} bookings`)

    // Create sample expenses
    const expenses = [
      {
        propertyId: property.id,
        category: ExpenseCategory.CLEANING,
        description: 'Deep cleaning after checkout',
        date: subDays(now, 8),
        amount: 120,
        currency: Currency.GHS,
        amountInBase: 120,
      },
      {
        propertyId: property.id,
        category: ExpenseCategory.REPAIRS,
        description: 'Fixed leaking faucet in bathroom',
        date: subDays(now, 12),
        amount: 80,
        currency: Currency.GHS,
        amountInBase: 80,
      },
      {
        propertyId: property.id,
        category: ExpenseCategory.UTILITIES,
        description: 'Electricity bill - January',
        date: subDays(now, 15),
        amount: 200,
        currency: Currency.GHS,
        amountInBase: 200,
      },
      {
        propertyId: property.id,
        category: ExpenseCategory.SUPPLIES,
        description: 'Toiletries and cleaning supplies',
        date: subDays(now, 3),
        amount: 150,
        currency: Currency.GHS,
        amountInBase: 150,
      },
      {
        propertyId: property.id,
        category: ExpenseCategory.INTERNET,
        description: 'Internet subscription - January',
        date: subDays(now, 20),
        amount: 100,
        currency: Currency.GHS,
        amountInBase: 100,
      },
    ]

    for (const expenseData of expenses) {
      await prisma.expense.create({ 
        data: {
          ...expenseData,
          id: crypto.randomUUID(),
          ownerId: owner.id,
          updatedAt: new Date(),
        }
      })
    }
    console.log(`Created ${expenses.length} expenses`)

    // Create sample tasks
    const tasks = [
      {
        propertyId: property.id,
        type: TaskType.CLEANING,
        title: 'Deep clean before next guest',
        description: 'Full deep clean including windows and appliances',
        dueAt: addDays(now, 4),
        status: TaskStatus.PENDING,
      },
      {
        propertyId: property.id,
        type: TaskType.REPAIR,
        title: 'Check AC unit',
        description: 'Inspect and service air conditioning unit',
        dueAt: addDays(now, 7),
        status: TaskStatus.PENDING,
      },
      {
        propertyId: property.id,
        type: TaskType.INSPECTION,
        title: 'Monthly property inspection',
        description: 'Routine inspection of all rooms and facilities',
        dueAt: addDays(now, 10),
        status: TaskStatus.PENDING,
      },
      {
        propertyId: property.id,
        type: TaskType.CLEANING,
        title: 'Regular maintenance cleaning',
        description: 'Weekly cleaning and maintenance',
        dueAt: subDays(now, 2),
        status: TaskStatus.COMPLETED,
      },
    ]

    for (const taskData of tasks) {
      await prisma.task.create({ 
        data: {
          ...taskData,
          id: crypto.randomUUID(),
          updatedAt: new Date(),
        }
      })
    }
    console.log(`Created ${tasks.length} tasks`)
  } else {
    owner = existingOwner
    console.log('Owner already exists:', existingOwner.email)
    
    // Check if property exists
    const existingProperty = await prisma.property.findFirst({
      where: { ownerId: owner.id }
    })
    
    if (!existingProperty) {
      // Create property if it doesn't exist
      const property = await prisma.property.create({
        data: {
          ownerId: owner.id,
          name: 'Beach House',
          nickname: 'Beach House Accra',
          address: '123 Beach Road',
          city: 'Accra',
          country: 'Ghana',
          currency: Currency.GHS,
          defaultCommissionRate: 0.15,
          status: 'active',
        },
      })
      console.log('Created property:', property.name)
    }
  }
}

main()
  .then(async () => {
    await pool.end()
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await pool.end()
    await prisma.$disconnect()
    process.exit(1)
  })
